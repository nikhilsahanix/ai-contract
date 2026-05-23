import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrg } from "../../middleware/requireOrg.js";
import { listPlans, createOrder, verifyPayment } from "./billing.service.js";

const billingRoutes: FastifyPluginAsync = async (app) => {

  // Public — plan listing
  app.get("/plans", async () => ({ success: true, data: listPlans() }));

  // ── /billing/webhook is registered in app.ts — rawBody required ──────────

  // Create Razorpay order → frontend opens checkout modal
  app.post("/checkout", { preHandler: [requireAuth, requireOrg] }, async (req) => {
    const { plan, planId } = req.body as { plan?: string; planId?: string };
    const resolvedPlan = (plan ?? planId ?? "").trim();

    if (!resolvedPlan) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: "plan is required" } };
    }

    const user   = (req as any).user;
    const result = await createOrder(resolvedPlan, user.orgId);
    return { success: true, data: result };
  });

  // Verify payment after checkout modal success
  app.post("/verify", { preHandler: [requireAuth, requireOrg] }, async (req) => {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
    } = req.body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      planId: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: "Missing payment fields" } };
    }

    const user   = (req as any).user;
    const result = await verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      user.orgId
    );
    return { success: true, data: result };
  });
};

export default billingRoutes;
