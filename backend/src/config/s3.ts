import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

function createStorageClient(): S3Client {
  if (env.STORAGE_PROVIDER === "r2") {
    // R2 is S3-compatible. Endpoint: https://<accountId>.r2.cloudflarestorage.com
    // Region must be the string "auto" — R2 ignores it but the SDK requires a value.
    return new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  return new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export const s3Client = createStorageClient();

// Single source of truth — import this everywhere instead of reading
// provider-specific env vars scattered across the codebase.
export const storageBucket =
  env.STORAGE_PROVIDER === "r2" ? env.R2_BUCKET_NAME! : env.S3_BUCKET_NAME!;