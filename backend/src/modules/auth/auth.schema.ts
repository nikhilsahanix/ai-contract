import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10)
  .regex(/[A-Z]/, "must include uppercase")
  .regex(/[0-9]/, "must include number")
  .regex(/[^A-Za-z0-9]/, "must include special char");

export const registerBodySchema = z
  .object({
    orgName: z.string().min(2),
    orgSlug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
    email: z.string().email(),
    password: passwordSchema
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1)
  })
  .strict();

export const refreshBodySchema = z.object({ refreshToken: z.string().min(1) }).strict();
export const logoutBodySchema = z.object({ refreshToken: z.string().min(1) }).strict();
export const verifyEmailQuerySchema = z.object({ token: z.string().min(1) }).strict();
