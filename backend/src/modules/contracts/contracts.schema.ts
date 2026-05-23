import { ContractStatus, ContractType } from "@prisma/client";
import { z } from "zod";

export const listContractsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.nativeEnum(ContractStatus).optional(),
    contractType: z.nativeEnum(ContractType).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  })
  .strict();
