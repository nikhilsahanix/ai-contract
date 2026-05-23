import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../config/database.js";
import { AuthError } from "../lib/errors.js";

export async function requireOrg(req: FastifyRequest, _reply: FastifyReply) {
  const orgId = req.user?.orgId ?? req.apiKey?.orgId;
  if (!orgId) {
    throw new AuthError("AUTH_REQUIRED", "organization context required", 401);
  }
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { id: true, slug: true, plan: true }
  });
  if (!org) {
    throw new AuthError("FORBIDDEN", "organization not found", 403);
  }
  req.org = org;
  await prisma.$executeRawUnsafe(`SELECT set_config('app.current_org_id', '${orgId}', true)`);
}
