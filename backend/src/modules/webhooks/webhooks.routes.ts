import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";

const createWebhookSchema = z
  .object({
    url: z.string().url(),
    secret: z.string().min(16),
    events: z.array(z.enum(["analysis.completed", "analysis.failed"])).min(1)
  })
  .strict();

const webhooksRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: [requireAuth, requireOrg] }, async (req) => {
    if (req.user?.role !== "ADMIN") return { success: false, error: { code: "FORBIDDEN", message: "admin required" } };
    const hooks = await prisma.orgWebhook.findMany({ where: { orgId: req.org!.id } });
    return { success: true, data: hooks };
  });

  app.post("/", { preHandler: [requireAuth, requireOrg] }, async (req) => {
    if (req.user?.role !== "ADMIN") return { success: false, error: { code: "FORBIDDEN", message: "admin required" } };
    const body = createWebhookSchema.parse(req.body);
    const created = await prisma.orgWebhook.create({ data: { ...body, orgId: req.org!.id } });
    return { success: true, data: created };
  });

  app.delete("/:id", { preHandler: [requireAuth, requireOrg] }, async (req) => {
    if (req.user?.role !== "ADMIN") return { success: false, error: { code: "FORBIDDEN", message: "admin required" } };
    const { id } = req.params as { id: string };
    await prisma.orgWebhook.deleteMany({ where: { id, orgId: req.org!.id } });
    return { success: true, data: { success: true } };
  });
};

export default webhooksRoutes;
