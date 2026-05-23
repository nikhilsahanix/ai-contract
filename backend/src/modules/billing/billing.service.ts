import Razorpay from "razorpay";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../config/database.js";

export const razorpay = new Razorpay({
  key_id:     env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

// INR prices in paise (1 INR = 100 paise)
const PLAN_PRICES_INR: Record<string, number> = {
  SOLO: 2400_00,   // ₹2,400/mo
  FIRM: 8200_00,   // ₹8,200/mo
  MAX:  20500_00,  // ₹20,500/mo
};

// ─── Plans ────────────────────────────────────────────────────────────────────

export function listPlans() {
  return [
    {
      id:            "SOLO",
      name:          "Solo",
      description:   "Perfect for independent attorneys",
      price:         2400,
      currency:      "INR",
      interval:      "month",
      analysisLimit: 25,
      highlight:     false,
      features: [
        "25 contract analyses / month",
        "PDF & DOCX support",
        "AI risk scoring & clause flagging",
        "Redline PDF generation",
        "Email notifications",
      ],
    },
    {
      id:            "FIRM",
      name:          "Firm",
      description:   "For growing practices",
      price:         8200,
      currency:      "INR",
      interval:      "month",
      analysisLimit: 100,
      highlight:     true,
      features: [
        "100 contract analyses / month",
        "Everything in Solo",
        "Multi-user workspace",
        "Priority processing queue",
        "Full audit logs",
        "Webhook delivery",
      ],
    },
    {
      id:            "MAX",
      name:          "Max",
      description:   "High-volume firms and agencies",
      price:         20500,
      currency:      "INR",
      interval:      "month",
      analysisLimit: 250,
      highlight:     false,
      features: [
        "250 contract analyses / month",
        "Everything in Firm",
        "API key access",
        "White-label branding",
        "Dedicated account manager",
        "SLA guarantee",
      ],
    },
    {
      id:            "ENTERPRISE",
      name:          "Enterprise",
      description:   "Custom volume and integrations",
      price:         null,
      currency:      "INR",
      interval:      "month",
      analysisLimit: null,
      highlight:     false,
      features: [
        "Unlimited analyses",
        "Everything in Max",
        "Custom AI model fine-tuning",
        "On-premise deployment option",
        "Custom data retention policy",
        "SSO / SAML",
        "Dedicated SLA",
      ],
    },
  ];
}

// ─── Create Razorpay Order ────────────────────────────────────────────────────

export async function createOrder(planIdRaw: string, orgId: string) {
  const planId = planIdRaw.toUpperCase().trim();

  if (planId === "ENTERPRISE") {
    throw new AppError(
      "Enterprise plans require a sales conversation. Please contact us at sales@contractiq.com.",
      400,
      "ENTERPRISE_CONTACT_REQUIRED"
    );
  }

  const amountPaise = PLAN_PRICES_INR[planId];
  if (!amountPaise) {
    throw new AppError(
      `No price configured for plan "${planId}". Valid plans: ${Object.keys(PLAN_PRICES_INR).join(", ")}`,
      400,
      "BILLING_MISCONFIGURED"
    );
  }

  let order: any;
  try {
    order = await razorpay.orders.create({
      amount:          amountPaise,
      currency:        "INR",
      receipt:         `org_${orgId.slice(0, 8)}_${Date.now()}`,
      notes:           { planId, orgId },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Razorpay Order Error]", msg);
    throw new AppError(`Razorpay error: ${msg}`, 502, "RAZORPAY_ERROR");
  }

  return {
    orderId:  order.id,
    amount:   amountPaise,
    currency: "INR",
    planId,
    keyId:    env.RAZORPAY_KEY_ID,
  };
}

// ─── Verify Payment & Activate Plan ──────────────────────────────────────────

export async function verifyPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  planId: string,
  orgId: string
) {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    throw new AppError("Payment signature verification failed.", 400, "PAYMENT_SIGNATURE_INVALID");
  }

  const plan = planId.toUpperCase().trim() as any;
  const planLimits: Record<string, number> = { SOLO: 25, FIRM: 100, MAX: 250 };

  await prisma.org.update({
    where: { id: orgId },
    data: {
      plan,
      analysisLimit: planLimits[plan] ?? 25,
      analysisCount: 0,
    },
  });

  console.log(`[Razorpay] Payment verified. Org ${orgId} upgraded to ${plan}.`);
  return { success: true, plan };
}
