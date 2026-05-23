import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import { prisma } from "../config/database.js";

export const notificationWorker = new Worker(
  "webhook-delivery",
  async (job) => {
    const payload = job.data as { url: string; payload: unknown; signature: string; orgId: string };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(payload.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ContractIQ-Signature": `sha256=${payload.signature}`
        },
        body: JSON.stringify(payload.payload),
        signal: controller.signal
      });
      await prisma.auditLog.create({
        data: {
          orgId: payload.orgId,
          action: "webhook.delivery",
          metadata: { statusCode: res.status }
        }
      });
      if (!res.ok) throw new Error(`webhook failed: ${res.status}`);
    } finally {
      clearTimeout(timeout);
    }
  },
  { connection: redis }
);
