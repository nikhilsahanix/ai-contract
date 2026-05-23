import { z } from "zod";

export const createApiKeyBodySchema = z
  .object({
    name: z.string().min(2),
    expiresAt: z.string().datetime().optional(),
    rateLimit: z.coerce.number().int().min(1).max(500).default(100)
  })
  .strict();
