// backend\src\workers\analysis.worker.ts

import { Worker, type Job } from "bullmq";
import { redis } from "../config/redis.js";
import { prisma } from "../config/database.js";
import { logger } from "../lib/logger.js";
import { extractContractText } from "../services/pdf/parser.js";
import { analyzeContract, AIError } from "../services/ai/index.js";
import { getObject, uploadPrivateObject } from "../services/storage/s3.js";
import { generateRedlinePdf } from "../services/pdf/redline.js";
import { AppError } from "../lib/errors.js";
import type { AnalysisJobPayload } from "../lib/queue.js";

// ─── Worker ──────────────────────────────────────────────────────────────────
//
// lockDuration: 10 minutes — BullMQ auto-renews the lock every 5 minutes.
// For very large documents we additionally call job.extendLock() proactively
// at the start of the job so the lock never expires mid-extraction or mid-AI-call.
//
export const analysisWorker = new Worker<AnalysisJobPayload>(
  "contract-analysis",
  processJob,
  {
    connection:   redis,
    concurrency:  3,
    lockDuration: 600_000,   // 10 minutes (was 5 min)
    limiter: {
      max:      10,          // max jobs per window
      duration: 60_000,      // 60-second window
    },
  }
);

// ─── Job processor ───────────────────────────────────────────────────────────
//
// BullMQ passes `token` as the second argument — required for job.extendLock().
//
async function processJob(job: Job<AnalysisJobPayload>, token?: string): Promise<void> {
  const { contractId, orgId, contractType, jurisdiction, pageCount } = job.data;

  const jobLogger = logger.child({
    jobId:      job.id,
    contractId,
    orgId,
    pageCount:  pageCount ?? "unknown",
  });

  jobLogger.info("Analysis job started");

  // ── Dynamic lock extension for large documents ─────────────────────────────
  //
  // For contracts over 100 pages we proactively extend the lock before any
  // slow work begins (S3 download, OCR, multi-chunk AI calls).
  // Formula: 3 seconds per page, capped at 30 minutes.
  // This runs once at startup — BullMQ's auto-renewal handles the rest.
  //
  if (pageCount && pageCount > 100 && token) {
    const extraMs = Math.min(pageCount * 3_000, 1_800_000); // max 30 min
    try {
      await job.extendLock(token, extraMs);
      jobLogger.info({ pageCount, extraMs }, "Lock extended for large document");
    } catch (lockErr) {
      // Not fatal — BullMQ's auto-renewal will still run every 5 min
      jobLogger.warn({ lockErr }, "Could not extend lock — continuing with default renewal");
    }
  }

  // ── Step 1: Fetch contract from DB ────────────────────────────────────────
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id:           true,
      orgId:        true,
      storageKey:   true,
      originalName: true,
      contractType: true,
      jurisdiction: true,
      status:       true,
    },
  });

  if (!contract) {
    throw new AppError(`Contract ${contractId} not found`, 404, "NOT_FOUND");
  }

  // Guard against duplicate processing
  if (contract.status === "PROCESSING" || contract.status === "COMPLETED") {
    jobLogger.warn({ status: contract.status }, "Contract already processed — skipping");
    return;
  }

  // Verify org isolation — never process another org's contract
  if (contract.orgId !== orgId) {
    throw new AppError("Org mismatch on contract", 403, "FORBIDDEN");
  }

  // ── Step 2: Fetch analysis record + mark as PROCESSING ───────────────────
  const analysis = await prisma.analysis.findFirst({
    where:   { contractId, jobId: String(job.id) },
    orderBy: { createdAt: "desc" },
  });

  if (!analysis) {
    throw new AppError(`Analysis record not found for job ${job.id}`, 404, "NOT_FOUND");
  }

  await prisma.$transaction([
    prisma.analysis.update({
      where: { id: analysis.id },
      data:  { status: "PROCESSING" },
    }),
    prisma.contract.update({
      where: { id: contractId },
      data:  { status: "PROCESSING" },
    }),
  ]);

  jobLogger.info("Marked as PROCESSING — downloading file from S3");
  await job.updateProgress(10);

  // ── Step 3: Download file from S3 ────────────────────────────────────────
  let fileBuffer: Buffer;
  let mimeType: string;

  try {
    const s3Object = await getObject(contract.storageKey);

    if (!s3Object.Body) {
      throw new AppError("S3 object has no body", 500, "STORAGE_ERROR");
    }

    fileBuffer = await streamToBuffer(s3Object.Body as NodeJS.ReadableStream);

    mimeType = contract.storageKey.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    jobLogger.info({ bytes: fileBuffer.length, mimeType }, "File downloaded from S3");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "S3 download failed";
    jobLogger.error({ err }, msg);
    throw new AppError(msg, 500, "STORAGE_ERROR");
  }

  await job.updateProgress(20);

  // ── Step 4: Extract text ──────────────────────────────────────────────────
  let extraction;
  try {
    extraction = await extractContractText(fileBuffer, mimeType);
    jobLogger.info(
      {
        method:     extraction.method,
        charCount:  extraction.charCount,
        pageCount:  extraction.pageCount,
        confidence: extraction.confidence,
        warnings:   extraction.warnings.length,
      },
      "Text extraction complete"
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Text extraction failed";
    jobLogger.error({ err }, msg);
    await markFailed(analysis.id, contractId, msg);
    throw new AppError(msg, 500, "EXTRACTION_ERROR");
  } finally {
    // Release the raw file buffer as soon as extraction is done.
    // The extracted text is a fraction of the PDF size.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fileBuffer as any) = null;
  }

  // Fail fast if extraction yielded nothing useful
  if (extraction.charCount < 100) {
    const msg =
      "Could not extract readable text from this document. " +
      "It may be a scanned image without OCR, corrupt, or password-protected.";
    jobLogger.error({ charCount: extraction.charCount }, msg);
    await markFailed(analysis.id, contractId, msg);
    return; // Don't throw — don't retry, this won't improve
  }

  // Log a warning for large documents so operators can monitor timing
  if (extraction.pageCount > 100) {
    jobLogger.warn(
      { pageCount: extraction.pageCount, charCount: extraction.charCount },
      "Large document — multi-chunk AI analysis will run. Expect 3–10 minutes."
    );
  }

  await job.updateProgress(40);

  // ── Step 5: AI analysis ───────────────────────────────────────────────────
  let aiResult;
  try {
    aiResult = await analyzeContract({
      text:                 extraction.text,
      contractType:         contractType || contract.contractType || "UNKNOWN",
      jurisdiction:         jurisdiction ?? contract.jurisdiction ?? null,
      extractionConfidence: extraction.confidence,
    });

    jobLogger.info(
      {
        riskScore:    aiResult.riskScore,
        riskLevel:    aiResult.riskLevel,
        flags:        aiResult.flags.length,
        missing:      aiResult.missingClauses.length,
        chunks:       aiResult._meta?.chunks,
        processingMs: aiResult._meta?.processingMs,
      },
      "AI analysis complete"
    );
  } catch (err) {
    const msg = err instanceof AIError
      ? err.message
      : "AI analysis service unavailable";

    jobLogger.error({ err }, "AI analysis failed");

    // If retryable (rate limit, overloaded) — rethrow so BullMQ retries with backoff
    if (err instanceof AIError && err.retryable) {
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: {
          retryCount:   (analysis.retryCount ?? 0) + 1,
          errorMessage: msg,
        },
      });
      throw err;
    }

    await markFailed(analysis.id, contractId, msg);
    return;
  }

  await job.updateProgress(80);

  // ── Step 5.5: Generate & upload PDF redline ───────────────────────────────
  let redlineKey: string | null = null;
  try {
    jobLogger.info("Generating PDF redline report");
    const pdfBuffer = await generateRedlinePdf({
      contractName:     contract.originalName,
      contractType:     aiResult.contractType || contract.contractType || "UNKNOWN",
      riskScore:        aiResult.riskScore,
      riskLevel:        aiResult.riskLevel as any,
      executiveSummary: aiResult.executiveSummary,
      flags:            aiResult.flags,
      missingClauses:   aiResult.missingClauses,
      positives:        aiResult.positives,
    });

    redlineKey = `redlines/${orgId}/${job.id}.pdf`;

    jobLogger.info({ redlineKey }, "Uploading redline PDF to S3/R2");
    await uploadPrivateObject({
      key:         redlineKey,
      body:        pdfBuffer,
      contentType: "application/pdf",
    });
  } catch (pdfErr) {
    // PDF redline failure is non-fatal — the JSON analysis is the primary deliverable.
    // The dashboard can still show all risk data; the download button will be unavailable.
    jobLogger.error({ err: pdfErr }, "Failed to generate or upload redline PDF — continuing");
  }

  await job.updateProgress(90);

  // ── Step 6: Save results to DB ────────────────────────────────────────────
  // ── Step 6: Save results to DB ────────────────────────────────────────────
  await prisma.$transaction([
    prisma.analysis.update({
      where: { id: analysis.id },
      data: {
        status:           "COMPLETED",
        counted:          true,          // mark as counted — prevents double-count on retry
        riskScore:        aiResult.riskScore,
        riskLevel:        aiResult.riskLevel,
        summaryText:      aiResult.executiveSummary,
        redlineKey,
        aiModel:          aiResult._meta?.model,
        promptTokens:     aiResult._meta?.promptTokens,
        completionTokens: aiResult._meta?.completionTokens,
        processingMs:     aiResult._meta?.processingMs,
        errorMessage:     null,
        flagsJson: {
          flags:               aiResult.flags,
          missingClauses:      aiResult.missingClauses,
          positives:           aiResult.positives,
          negotiationPriority: aiResult.negotiationPriority,
          jurisdictionNotes:   aiResult.jurisdictionNotes,
          executiveTakeaway:   aiResult.executiveTakeaway,
          favoursParty:        aiResult.favoursParty,
          contractType:        aiResult.contractType,
          extractionMeta: {
            method:     extraction.method,
            confidence: extraction.confidence,
            pageCount:  extraction.pageCount,
            warnings:   extraction.warnings,
          },
        } as any,
      },
    }),
    prisma.contract.update({
      where: { id: contractId },
      data: {
        status:       "COMPLETED",
        pageCount:    extraction.pageCount,
        contractType: aiResult.contractType as any,
      },
    }),
    // ✅ Increment ONLY on success AND only if not already counted (idempotent)
    // analysis.counted is read at job start — false means this is the first completion
    ...(analysis.counted === false
      ? [prisma.org.update({
          where: { id: orgId },
          data:  { analysisCount: { increment: 1 } },
        })]
      : []
    ),
  ]);

  await job.updateProgress(100);

  jobLogger.info(
    {
      riskLevel: aiResult.riskLevel,
      flags:     aiResult.flags.length,
      chunks:    aiResult._meta?.chunks,
      tokens:    (aiResult._meta?.promptTokens ?? 0) + (aiResult._meta?.completionTokens ?? 0),
    },
    "Analysis job completed successfully"
  );
}

// ─── Mark failed ─────────────────────────────────────────────────────────────

async function markFailed(
  analysisId: string,
  contractId: string,
  errorMessage: string
): Promise<void> {
  // ❌ analysisCount is NOT touched here — failed jobs never cost a credit
  await prisma.$transaction([
    prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status:       "FAILED",
        counted:      false,   // explicit — failed = never counted
        errorMessage: errorMessage.slice(0, 1000),
      },
    }),
    prisma.contract.update({
      where: { id: contractId },
      data:  { status: "FAILED" },
    }),
  ]);
}

// ─── Worker event handlers ────────────────────────────────────────────────────

analysisWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job completed");
});

analysisWorker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, attempt: job?.attemptsMade, err },
    "Job failed"
  );
});

analysisWorker.on("stalled", (jobId) => {
  logger.warn({ jobId }, "Job stalled — will be retried");
});

analysisWorker.on("error", (err) => {
  logger.error({ err }, "Worker error");
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data",  (chunk: Buffer) => chunks.push(chunk));
    stream.on("end",   ()              => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}