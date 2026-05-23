import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    API_BASE_URL: z.string().url(),
    FRONTEND_URL: z.string().url(),
    API_WHITELIST_ORIGINS: z.string().optional(),

    DATABASE_URL: z.string().startsWith("postgresql://"),
    REDIS_URL: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),

    // Storage — pick one provider
    STORAGE_PROVIDER: z.enum(["s3", "r2"]).default("s3"),

    // AWS S3 (optional at schema level — enforced below in superRefine)
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),

    // Cloudflare R2 (optional at schema level — enforced below in superRefine)
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),

    AI_PROVIDER: z.enum(["anthropic", "google"]).default("anthropic"),
    ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),
    GOOGLE_API_KEY: z.string().optional(),

    // Razorpay billing
    RAZORPAY_KEY_ID: z.string().min(1),
    RAZORPAY_KEY_SECRET: z.string().min(1),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(1),

    RESEND_API_KEY: z.string().min(1),
    EMAIL_FROM: z
      .string()
      .regex(
        /^(.+\s)?<?[^\s@]+@[^\s@]+\.[^\s@]+>?$/,
        "EMAIL_FROM must be a valid email or 'Display Name <email@domain.com>'"
      ),

    ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),

    POSTGRES_PASSWORD: z.string().optional(),
    REDIS_PASSWORD: z.string().optional()
  })
  .superRefine((val, ctx) => {
    if (val.STORAGE_PROVIDER === "s3") {
      if (!val.AWS_ACCESS_KEY_ID)
        ctx.addIssue({ code: "custom", path: ["AWS_ACCESS_KEY_ID"],     message: "Required when STORAGE_PROVIDER=s3" });
      if (!val.AWS_SECRET_ACCESS_KEY)
        ctx.addIssue({ code: "custom", path: ["AWS_SECRET_ACCESS_KEY"], message: "Required when STORAGE_PROVIDER=s3" });
      if (!val.AWS_REGION)
        ctx.addIssue({ code: "custom", path: ["AWS_REGION"],            message: "Required when STORAGE_PROVIDER=s3" });
      if (!val.S3_BUCKET_NAME)
        ctx.addIssue({ code: "custom", path: ["S3_BUCKET_NAME"],        message: "Required when STORAGE_PROVIDER=s3" });
    }

    if (val.STORAGE_PROVIDER === "r2") {
      if (!val.R2_ACCESS_KEY_ID)
        ctx.addIssue({ code: "custom", path: ["R2_ACCESS_KEY_ID"],      message: "Required when STORAGE_PROVIDER=r2" });
      if (!val.R2_SECRET_ACCESS_KEY)
        ctx.addIssue({ code: "custom", path: ["R2_SECRET_ACCESS_KEY"],  message: "Required when STORAGE_PROVIDER=r2" });
      if (!val.R2_ACCOUNT_ID)
        ctx.addIssue({ code: "custom", path: ["R2_ACCOUNT_ID"],         message: "Required when STORAGE_PROVIDER=r2" });
      if (!val.R2_BUCKET_NAME)
        ctx.addIssue({ code: "custom", path: ["R2_BUCKET_NAME"],        message: "Required when STORAGE_PROVIDER=r2" });
    }

    if (val.AI_PROVIDER === "anthropic" && !val.ANTHROPIC_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["ANTHROPIC_API_KEY"], message: "Required when AI_PROVIDER=anthropic" });
    }
    if (val.AI_PROVIDER === "google" && !val.GOOGLE_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["GOOGLE_API_KEY"], message: "Required when AI_PROVIDER=google" });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:\n",
    parsed.error.flatten().fieldErrors
  );
  process.exit(1);
}

export const env = parsed.data;
