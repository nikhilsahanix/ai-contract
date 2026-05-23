import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import { s3Client, storageBucket } from "../../config/s3.js";

export async function uploadPrivateObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const input: PutObjectCommandInput = {
    Bucket: storageBucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    // R2 encrypts everything at rest automatically and rejects this param.
    // Only send it when talking to real AWS S3.
    ...(env.STORAGE_PROVIDER === "s3" && { ServerSideEncryption: "AES256" }),
  };

  await s3Client.send(new PutObjectCommand(input));
}

export async function getPresignedReadUrl(key: string): Promise<string> {
  return await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: storageBucket, Key: key }),
    { expiresIn: 900 } // 15 minutes
  );
}

export async function getObject(key: string): Promise<GetObjectCommandOutput> {
  return await s3Client.send(
    new GetObjectCommand({ Bucket: storageBucket, Key: key })
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: storageBucket, Key: key })
  );
}

// ─── ADDED THIS FUNCTION FOR THE WORKER ─────────────────────────────────
export async function getFileFromS3(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: storageBucket, Key: key })
  );

  if (!response.Body) {
    throw new Error(`Failed to retrieve file from S3: Body is empty for key ${key}`);
  }

  const byteArray = await response.Body.transformToByteArray();
  return Buffer.from(byteArray);
}