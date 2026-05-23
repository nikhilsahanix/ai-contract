import fp from "fastify-plugin";
import { prisma } from "../config/database.js";

export default fp(async (app) => {
  app.addHook("onResponse", async (req, reply) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return;
    const orgId = req.org?.id ?? req.user?.orgId ?? req.apiKey?.orgId;
    if (!orgId) return;
    await prisma.auditLog
      .create({
        data: {
          orgId,
          userId: req.user?.id,
          apiKeyId: req.apiKey?.id,
          action: `${req.method.toLowerCase()}.${req.routerPath ?? req.url}`,
          resourceId: undefined,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] ?? null,
          metadata: { statusCode: reply.statusCode }
        }
      })
      .catch(() => undefined);
  });
});
