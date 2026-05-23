import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import { prisma } from "../../config/database.js";
import { getPresignedReadUrl } from "../../services/storage/s3.js";
import { AppError } from "../../lib/errors.js";

const analysisRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /contracts/:id/analysis — full analysis result ─────────────────
  app.get(
    "/:id/analysis",
    { preHandler: [requireAuth, requireOrg] },
    async (req) => {
      const { id } = req.params as { id: string };
      const orgId  = req.user!.orgId;

      const contract = await prisma.contract.findUnique({
        where: { id },
        select: {
          id:           true,
          orgId:        true,
          originalName: true,
          contractType: true,
          jurisdiction: true,
          status:       true,
          pageCount:    true,
          createdAt:    true,
          analyses: {
            orderBy: { createdAt: "desc" },
            take:    1,
            select: {
              id:               true,
              jobId:            true,
              status:           true,
              riskScore:        true,
              riskLevel:        true,
              flagsJson:        true,
              summaryText:      true,
              redlineKey:       true,
              aiModel:          true,
              promptTokens:     true,
              completionTokens: true,
              processingMs:     true,
              errorMessage:     true,
              retryCount:       true,
              createdAt:        true,
              updatedAt:        true,
            },
          },
        },
      });

      if (!contract) throw new AppError("Contract not found", 404, "NOT_FOUND");
      if (contract.orgId !== orgId)
        throw new AppError("Access denied", 403, "FORBIDDEN");

      const analysis = contract.analyses[0] ?? null;

      // Unpack flagsJson into structured fields for the API response
      const flagsData = analysis?.flagsJson as any;

      return {
        success: true,
        data: {
          contract: {
            id:           contract.id,
            name:         contract.originalName,
            type:         contract.contractType,
            jurisdiction: contract.jurisdiction,
            status:       contract.status,
            pageCount:    contract.pageCount,
            uploadedAt:   contract.createdAt,
          },
          analysis: analysis
            ? {
                id:                  analysis.id,
                jobId:               analysis.jobId,
                status:              analysis.status,
                riskScore:           analysis.riskScore,
                riskLevel:           analysis.riskLevel,
                executiveSummary:    analysis.summaryText,
                executiveTakeaway:   flagsData?.executiveTakeaway    ?? null,
                favoursParty:        flagsData?.favoursParty         ?? null,
                flags:               flagsData?.flags                ?? [],
                missingClauses:      flagsData?.missingClauses       ?? [],
                positives:           flagsData?.positives            ?? [],
                negotiationPriority: flagsData?.negotiationPriority  ?? [],
                jurisdictionNotes:   flagsData?.jurisdictionNotes    ?? [],
                extractionMeta:      flagsData?.extractionMeta       ?? null,
                hasRedline:          !!analysis.redlineKey,
                model:               analysis.aiModel,
                processingMs:        analysis.processingMs,
                errorMessage:        analysis.errorMessage,
                retryCount:          analysis.retryCount,
                completedAt:         analysis.updatedAt,
              }
            : null,
        },
      };
    }
  );

  // ── GET /contracts/:id/analysis/status — lightweight polling ───────────
  app.get(
    "/:id/analysis/status",
    { preHandler: [requireAuth, requireOrg] },
    async (req) => {
      const { id } = req.params as { id: string };
      const orgId  = req.user!.orgId;

      const contract = await prisma.contract.findUnique({
        where: { id },
        select: {
          orgId:  true,
          status: true,
          analyses: {
            orderBy: { createdAt: "desc" },
            take:    1,
            select: {
              id:           true,
              jobId:        true,
              status:       true,
              riskScore:    true,
              riskLevel:    true,
              retryCount:   true,
              errorMessage: true,
              processingMs: true,
              updatedAt:    true,
            },
          },
        },
      });

      if (!contract) throw new AppError("Contract not found", 404, "NOT_FOUND");
      if (contract.orgId !== orgId)
        throw new AppError("Access denied", 403, "FORBIDDEN");

      const analysis = contract.analyses[0] ?? null;

      return {
        success: true,
        data: {
          contractStatus:  contract.status,
          analysisStatus:  analysis?.status      ?? "QUEUED",
          jobId:           analysis?.jobId        ?? null,
          riskScore:       analysis?.riskScore    ?? null,
          riskLevel:       analysis?.riskLevel    ?? null,
          processingMs:    analysis?.processingMs ?? null,
          retryCount:      analysis?.retryCount   ?? 0,
          errorMessage:    analysis?.errorMessage ?? null,
          lastUpdated:     analysis?.updatedAt    ?? null,
          // Tell the frontend when to stop polling
          isTerminal:
            analysis?.status === "COMPLETED" || analysis?.status === "FAILED",
        },
      };
    }
  );

  // ── GET /contracts/:id/redline — pre-signed S3 URL (15 min expiry) ─────
  app.get(
    "/:id/redline",
    { preHandler: [requireAuth, requireOrg] },
    async (req) => {
      const { id } = req.params as { id: string };
      const orgId  = req.user!.orgId;

      const contract = await prisma.contract.findUnique({
        where: { id },
        select: {
          orgId:   true,
          analyses: {
            orderBy: { createdAt: "desc" },
            take:    1,
            select:  { redlineKey: true, status: true },
          },
        },
      });

      if (!contract) throw new AppError("Contract not found", 404, "NOT_FOUND");
      if (contract.orgId !== orgId)
        throw new AppError("Access denied", 403, "FORBIDDEN");

      const analysis = contract.analyses[0];
      if (!analysis?.redlineKey) {
        throw new AppError(
          "Redline not available — analysis may still be processing",
          404,
          "REDLINE_NOT_READY"
        );
      }

      // Security: verify storage key belongs to this org
      if (!analysis.redlineKey.includes(orgId)) {
        throw new AppError("Access denied", 403, "FORBIDDEN");
      }

      const url = await getPresignedReadUrl(analysis.redlineKey);

      return {
        success: true,
        data: {
          url,
          expiresInSeconds: 900,    // 15 minutes
          key: analysis.redlineKey,
        },
      };
    }
  );
};

export default analysisRoutes;