import { randomUUID } from "node:crypto";
import { ContractStatus, type ContractType } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { analysisQueue } from "../../lib/queue.js";
import { uploadPrivateObject, deleteObject } from "../../services/storage/s3.js";
import { AppError } from "../../lib/errors.js";
import { getPdfPageCount, getDocxEstimatedPageCount } from "../../services/pdf/parser.js";

// ─── Plan page limits ─────────────────────────────────────────────────────────

const PAGE_LIMITS: Record<string, number> = {
  SOLO:       50,
  FIRM:       200,
  MAX:        500,
  ENTERPRISE: Infinity,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g,  "_")
    .replace(/[^\w.-]/g, "_");
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadContract(input: {
  orgId:             string;
  uploadedByUserId?: string;
  fileName:          string;
  fileBytes:         Buffer;
  mimeType:          string;
  contractType:      ContractType;
  jurisdiction?:     string;
}) {
  // ── Size check ───────────────────────────────────────────────────────────
  if (input.fileBytes.byteLength > 50 * 1024 * 1024) {
    throw new AppError("File exceeds 50MB limit.", 413, "UPLOAD_TOO_LARGE");
  }

  // ── MIME check ───────────────────────────────────────────────────────────
  const allowed = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(input.mimeType)) {
    throw new AppError("Only PDF and DOCX files are supported.", 415, "UNSUPPORTED_FILE_TYPE");
  }

  // ── Magic bytes ──────────────────────────────────────────────────────────
  if (
    input.mimeType === "application/pdf" &&
    input.fileBytes.subarray(0, 4).toString() !== "%PDF"
  ) {
    throw new AppError("File is not a valid PDF.", 415, "UNSUPPORTED_FILE_TYPE");
  }
  if (
    input.mimeType.includes("wordprocessingml") &&
    !(input.fileBytes[0] === 0x50 && input.fileBytes[1] === 0x4b)
  ) {
    throw new AppError("File is not a valid DOCX.", 415, "UNSUPPORTED_FILE_TYPE");
  }

  // ── Page count ───────────────────────────────────────────────────────────
  const pageCount = input.mimeType === "application/pdf"
    ? getPdfPageCount(input.fileBytes)
    : getDocxEstimatedPageCount(input.fileBytes);

  // ── Fetch org — single DB call for all plan checks ───────────────────────
  const org = await prisma.org.findUniqueOrThrow({
    where:  { id: input.orgId },
    select: { plan: true, analysisCount: true, analysisLimit: true },
  });

  // ── Quota check — only count COMPLETED analyses (never failed) ───────────
 if ((org.plan as string) !== "ENTERPRISE" && org.analysisCount >= org.analysisLimit) {
    throw new AppError(
      `You have used all ${org.analysisLimit} analyses on your ${org.plan} plan this month. ` +
      `Upgrade your plan or wait for your monthly reset.`,
      429,
      "ANALYSIS_LIMIT_REACHED"
    );
  }

  // ── Page limit per plan ───────────────────────────────────────────────────
  const pageLimit = PAGE_LIMITS[org.plan] ?? 50;
  if (pageCount > 0 && pageCount > pageLimit) {
    throw new AppError(
      `Your ${org.plan} plan supports contracts up to ${pageLimit} pages. ` +
      `This document has ${pageCount} pages. ` +
      (org.plan === "SOLO"
        ? "Upgrade to Firm or Max to analyze larger contracts."
        : org.plan === "FIRM"
        ? "Upgrade to Max for larger contracts."
        : "Contact support for very large documents."),
      413,
      "FILE_TOO_LARGE_FOR_PLAN"
    );
  }

  // ── Upload to S3/R2 ───────────────────────────────────────────────────────
  const storageKey = `contracts/${input.orgId}/${randomUUID()}/${sanitizeFileName(input.fileName)}`;
  await uploadPrivateObject({
    key:         storageKey,
    body:        input.fileBytes,
    contentType: input.mimeType,
  });

  // ── Create DB records ─────────────────────────────────────────────────────
  const contract = await prisma.contract.create({
    data: {
      orgId:            input.orgId,
      uploadedByUserId: input.uploadedByUserId,
      originalName:     input.fileName,
      contractType:     input.contractType,
      jurisdiction:     input.jurisdiction,
      storageKey,
      fileSizeBytes:    input.fileBytes.byteLength,
      pageCount:        pageCount > 0 ? pageCount : null,
      status:           ContractStatus.PENDING,
    },
  });

  // Enqueue the analysis job
  const job = await analysisQueue.add("analyze", {
    contractId:   contract.id,
    orgId:        contract.orgId,
    contractType: contract.contractType,
    jurisdiction: contract.jurisdiction ?? null,
    pageCount,
  });

  // Create the analysis record linked to the BullMQ job
  const analysis = await prisma.analysis.create({
    data: {
      contractId: contract.id,
      jobId:      String(job.id),
      // counted starts false — worker sets it true only on COMPLETED
    },
  });

  // !! DO NOT increment analysisCount here !!
  // analysisCount is incremented ONLY in the worker on successful completion.
  // Failed analyses never count against the user's quota.

  return {
    contractId: contract.id,
    jobId:      String(job.id),
    status:     "QUEUED",
    pageCount:  pageCount > 0 ? pageCount : null,
  };
}

// ─── Remove ───────────────────────────────────────────────────────────────────

export async function removeContract(
  orgId:      string,
  contractId: string,
  hardDelete: boolean
) {
  const contract = await prisma.contract.findFirst({
    where:   { id: contractId, orgId },
    include: { analyses: true },
  });

  if (!contract) throw new AppError("Contract not found.", 404, "NOT_FOUND");

  // Delete files from storage
  await deleteObject(contract.storageKey).catch(() => undefined);
  for (const a of contract.analyses) {
    if (a.redlineKey) await deleteObject(a.redlineKey).catch(() => undefined);
  }

  if (hardDelete) {
    await prisma.contract.delete({ where: { id: contract.id } });
  } else {
    await prisma.contract.update({
      where: { id: contract.id },
      data:  { deletedAt: new Date() },
    });
  }
}