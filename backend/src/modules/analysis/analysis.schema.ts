import { z } from "zod";

export const contractIdParamSchema = z.object({ id: z.string().uuid() }).strict();
