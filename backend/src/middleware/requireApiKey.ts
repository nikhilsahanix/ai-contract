import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../config/database.js";
import { redis } from "../config/redis.js";
import { AuthError } from "../lib/errors.js";

export async function requireApiKey(req: FastifyRequest, _reply: FastifyReply) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ciq_live_")) {
    throw new AuthError("AUTH_REQUIRED", "api key required", 401);
  }
  const fullKey = auth.replace("Bearer ", "");
  const keyPrefix = fullKey.slice(0, 12);
  const keys = await prisma.apiKey.findMany({
    where: { isActive: true, keyPrefix, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
  });
  for (const key of keys) {
    if (await bcrypt.compare(fullKey, key.keyHash)) {
      const now = Date.now();
      const bucket = `rate:apikey:${key.id}:${Math.floor(now / 60000)}`;
      const count = await redis.incr(bucket);
      if (count === 1) await redis.expire(bucket, 61);
      if (count > key.rateLimit) {
        throw new AuthError("RATE_LIMITED", "api key rate limit exceeded", 429);
      }
      await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
      const org = await prisma.org.findUnique({
        where: { id: key.orgId },
        select: { id: true, slug: true, plan: true }
      });
      if (!org) throw new AuthError("FORBIDDEN", "organization not found", 403);
      req.apiKey = { id: key.id, orgId: key.orgId, name: key.name, rateLimit: key.rateLimit };
      req.org = org;
      return;
    }
  }
  throw new AuthError("AUTH_INVALID_TOKEN", "invalid api key", 401);
}
