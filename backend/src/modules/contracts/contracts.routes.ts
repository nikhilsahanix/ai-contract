// backend\src\modules\contracts\contracts.routes.ts

import type { FastifyPluginAsync } from "fastify";
import { ContractType } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireApiKey } from "../../middleware/requireApiKey.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import { prisma } from "../../config/database.js";
import { listContractsQuerySchema } from "./contracts.schema.js";
import { removeContract, uploadContract } from "./contracts.service.js";

const contractsRoutes: FastifyPluginAsync = async (app) => {
  const authOrApiKey = async (req: any, reply: any) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ciq_live_")) {
      await requireApiKey(req, reply);
    } else {
      await requireAuth(req, reply);
    }
  };

  app.get("/", { preHandler: [authOrApiKey, requireOrg] }, async (req) => {
    const query = listContractsQuerySchema.parse(req.query);
    const where = {
      orgId: req.org!.id,
      deletedAt: null,
      status: query.status,
      contractType: query.contractType,
      createdAt: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      },
    };
    const [items, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.contract.count({ where }),
    ]);
    return { success: true, data: items, meta: { page: query.page, total } };
  });

  app.post("/upload", { preHandler: [authOrApiKey, requireOrg] }, async (req, reply) => {
    const file = await req.file();
    if (!file)
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "file required" },
      });

    const bytes               = await file.toBuffer();
    const contractTypeField   = file.fields.contractType as any;
    const jurisdictionField   = file.fields.jurisdiction as any;
    const contractType        = (contractTypeField?.value as ContractType | undefined) ?? ContractType.UNKNOWN;
    const jurisdiction        = jurisdictionField?.value as string | undefined;

    const data = await uploadContract({
      orgId:            req.org!.id,
      uploadedByUserId: req.user?.id,
      fileName:         file.filename,
      fileBytes:        bytes,
      mimeType:         file.mimetype,
      contractType,
      jurisdiction,
    });

    return reply.status(202).send({ success: true, data });
  });

  app.get("/:id", { preHandler: [authOrApiKey, requireOrg] }, async (req) => {
    const { id } = req.params as { id: string };
    const contract = await prisma.contract.findFirst({
      where:   { id, orgId: req.org!.id, deletedAt: null },
      include: { analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!contract)
      return { success: false, error: { code: "NOT_FOUND", message: "not found" } };
    return { success: true, data: contract };
  });

  app.delete("/:id", { preHandler: [requireAuth, requireOrg] }, async (req) => {
    if (req.user?.role !== "ADMIN") {
      return { success: false, error: { code: "FORBIDDEN", message: "admin required" } };
    }
    const { id } = req.params as { id: string };
    const hardDelete = (req.org?.plan as string) === "API_WHITELABEL";
    await removeContract(req.org!.id, id, hardDelete);
    return { success: true, data: { success: true } };
  });

  // ── /redline, /analysis, /analysis/status are all in analysis.routes.ts ──
};

export default contractsRoutes;