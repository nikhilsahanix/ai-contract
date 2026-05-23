import crypto from "node:crypto";
import { webhookQueue } from "../../lib/queue.js";
import { prisma } from "../../config/database.js";

export interface WebhookPayload {
  event: "analysis.completed" | "analysis.failed";
  timestamp: string;
  data: {
    contractId: string;
    analysisId: string;
    status: string;
    riskScore?: number;
    riskLevel?: string;
  };
}

export async function queueWebhookDeliveries(orgId: string, payload: WebhookPayload) {
  const hooks = await prisma.orgWebhook.findMany({
    where: { orgId, isActive: true, events: { has: payload.event } }
  });
  for (const hook of hooks) {
    const signature = crypto
      .createHmac("sha256", hook.secret)
      .update(JSON.stringify(payload))
      .digest("hex");
    await webhookQueue.add(
      "deliver",
      { url: hook.url, payload, signature, orgId },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 } }
    );
  }
}
