import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../config/database.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import { createApiKeyBodySchema } from "./apikeys.schema.js";
import { createApiKey } from "./apikeys.service.js";

const apiKeysRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: [requireAuth, requireOrg] }, async (req) => {
    const keys = await prisma.apiKey.findMany({
      where: { orgId: req.org!.id },
      select: { id: true, keyPrefix: true, name: true, lastUsedAt: true, expiresAt: true, isActive: true }
    });
    return { success: true, data: keys };
  });

  app.post("/", { preHandler: [requireAuth, requireOrg] }, async (req) => {
    if (req.user?.role !== "ADMIN") return { success: false, error: { code: "FORBIDDEN", message: "admin required" } };
    const body = createApiKeyBodySchema.parse(req.body);
    const data = await createApiKey(req.org!.id, body);
    return { success: true, data };
  });

  app.delete("/:id", { preHandler: [requireAuth, requireOrg] }, async (req) => {
    if (req.user?.role !== "ADMIN") return { success: false, error: { code: "FORBIDDEN", message: "admin required" } };
    const { id } = req.params as { id: string };
    await prisma.apiKey.updateMany({ where: { id, orgId: req.org!.id }, data: { isActive: false } });
    return { success: true, data: { success: true } };
  });
};

export default apiKeysRoutes;
