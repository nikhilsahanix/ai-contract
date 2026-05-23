import bcrypt from "bcryptjs";
import { prisma } from "../../config/database.js";
import { randomBase58 } from "../../lib/crypto.js";
import { AppError } from "../../lib/errors.js";

export async function createApiKey(orgId: string, input: { name: string; expiresAt?: string; rateLimit: number }) {
  const active = await prisma.apiKey.count({ where: { orgId, isActive: true } });
  if (active >= 5) throw new AppError("FORBIDDEN", 403, "max active API keys reached");
  const key = `ciq_live_${randomBase58(44)}`;
  const keyHash = await bcrypt.hash(key, 12);
  const created = await prisma.apiKey.create({
    data: {
      orgId,
      name: input.name,
      keyHash,
      keyPrefix: key.slice(0, 12),
      rateLimit: input.rateLimit,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    }
  });
  return { id: created.id, key, keyPrefix: created.keyPrefix, name: created.name };
}
