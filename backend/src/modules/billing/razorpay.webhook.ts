import type { FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";

export async function razorpayWebhookHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const rawBody  = (req as any).rawBody as string | undefined;
  const received = req.headers["x-razorpay-signature"] as string | undefined;

  if (!rawBody || !received) {
    return reply.status(400).send({ error: "Missing body or signature" });
  }

  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    req.log.warn("[Razorpay Webhook] Invalid signature");
    return reply.status(400).send({ error: "Invalid signature" });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return reply.status(400).send({ error: "Invalid JSON" });
  }

  const eventType: string = event?.event ?? "";
  req.log.info(`[Razorpay Webhook] ${eventType}`);

  // payment.captured — payment collected successfully
  if (eventType === "payment.captured") {
    const payment = event?.payload?.payment?.entity;
    const notes   = payment?.notes ?? {};
    const planId  = (notes.planId as string | undefined)?.toUpperCase();
    const orgId   = notes.orgId as string | undefined;

    if (planId && orgId) {
      const planLimits: Record<string, number> = { SOLO: 25, FIRM: 100, MAX: 250 };
      try {
        await prisma.org.update({
          where: { id: orgId },
          data: {
            plan:          planId as any,
            analysisLimit: planLimits[planId] ?? 25,
            analysisCount: 0,
          },
        });
        req.log.info(`[Razorpay Webhook] Org ${orgId} upgraded to ${planId}`);
      } catch (err) {
        req.log.error({ err }, "[Razorpay Webhook] Failed to update org plan");
      }
    }
  }

  // subscription.cancelled — downgrade to SOLO
  if (eventType === "subscription.cancelled") {
    const sub   = event?.payload?.subscription?.entity;
    const notes = sub?.notes ?? {};
    const orgId = notes.orgId as string | undefined;

    if (orgId) {
      try {
        await prisma.org.update({
          where: { id: orgId },
          data: { plan: "SOLO", analysisLimit: 25 },
        });
        req.log.info(`[Razorpay Webhook] Org ${orgId} subscription cancelled → SOLO`);
      } catch (err) {
        req.log.error({ err }, "[Razorpay Webhook] Failed to handle cancellation");
      }
    }
  }

  return reply.status(200).send({ received: true });
}
