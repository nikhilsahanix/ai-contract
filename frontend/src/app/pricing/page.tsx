"use client";

import { useAuthStore } from "@/store/authStore";
import { useRouter }    from "next/navigation";
import { useState, useRef } from "react";
import api from "@/lib/api";
import { Check, Loader2, Zap, ArrowRight, ShieldCheck, Clock, Mail } from "lucide-react";
import Link from "next/link";

// ─── Plans ────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id:           "SOLO",
    name:         "Solo",
    monthlyPrice: 29,
    annualPrice:  23,
    tagline:      "For independent attorneys",
    analysisLimit: 25,
    features: [
      "25 contract analyses / month",
      "AI risk scoring + clause flagging",
      "PDF & DOCX redline export",
      "Email notifications",
      "14-day free trial",
    ],
    cta:       "Start free trial",
    highlight: false,
    enterprise: false,
  },
  {
    id:           "FIRM",
    name:         "Firm",
    monthlyPrice: 99,
    annualPrice:  79,
    tagline:      "For growing practices",
    analysisLimit: 100,
    badge:        "Most Popular",
    features: [
      "100 contract analyses / month",
      "Everything in Solo",
      "Custom firm logo on redlines",
      "Missing clause detection",
      "Multi-user workspace",
      "Priority processing queue",
      "Full audit logs + webhooks",
    ],
    cta:       "Start free trial",
    highlight: true,
    enterprise: false,
  },
  {
    id:           "MAX",
    name:         "Max",
    monthlyPrice: 249,
    annualPrice:  199,
    tagline:      "For high-volume firms",
    analysisLimit: 250,
    features: [
      "250 contract analyses / month",
      "Everything in Firm",
      "REST API + API key management",
      "White-label branding",
      "HMAC-signed webhook payloads",
      "Dedicated account manager",
      "99.9% uptime SLA",
    ],
    cta:       "Start free trial",
    highlight: false,
    enterprise: false,
  },
  {
    id:           "ENTERPRISE",
    name:         "Enterprise",
    monthlyPrice: null,
    annualPrice:  null,
    tagline:      "Custom volume & integrations",
    analysisLimit: null,
    features: [
      "Unlimited analyses",
      "Everything in Max",
      "Custom AI fine-tuning",
      "On-premise deployment",
      "Custom data retention",
      "SSO / SAML",
      "Bespoke SLA",
    ],
    cta:       "Contact sales",
    highlight: false,
    enterprise: true,
  },
];

const FAQS = [
  { q: "What counts as one analysis?",     a: "One analysis = one contract uploaded. Failed analyses never count against your quota — you're only charged for successful completions." },
  { q: "Can I change plans anytime?",      a: "Yes. Upgrades are instant; downgrades take effect at the end of your billing period. Your monthly quota resets on every billing cycle." },
  { q: "Are my contracts private?",        a: "Completely. Contracts are encrypted at rest (AES-256) and in transit. Row-level security ensures your firm's data is isolated from all others." },
  { q: "What file types are supported?",   a: "PDF and DOCX files up to 50 MB. Solo plans support up to 50 pages, Firm up to 200 pages, Max and Enterprise up to 500 pages." },
  { q: "Is there a free trial?",           a: "Yes — all self-serve plans include a 14-day free trial. No credit card required to start." },
  { q: "What happens if I hit my limit?",  a: "You'll receive a warning at 80% usage. Once the limit is reached, uploads are paused until your next billing cycle or you upgrade." },
];

// ─── Plan label map for display ───────────────────────────────────────────────
export const PLAN_DISPLAY: Record<string, { name: string; colour: string }> = {
  SOLO:       { name: "Solo",       colour: "text-zinc-400"    },
  FIRM:       { name: "Firm",       colour: "text-blue-400"    },
  MAX:        { name: "Max",        colour: "text-primary-gold"},
  ENTERPRISE: { name: "Enterprise", colour: "text-purple-400"  },
};

export default function PricingPage() {
  const { user }   = useAuthStore();
  const router     = useRouter();
  const [annual,      setAnnual]      = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [openFaq,     setOpenFaq]     = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const currentPlan = user?.org?.plan ?? null;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, i: number) => {
    const card = cardRefs.current[i];
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    card.style.setProperty("--mouse-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };

  const loadRazorpayScript = (): Promise<boolean> =>
    new Promise(resolve => {
      if ((window as any).Razorpay) { resolve(true); return; }
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload  = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handleSubscribe = async (planId: string, isEnterprise: boolean) => {
    if (isEnterprise) {
      window.location.href = "mailto:sales@contractiq.com?subject=Enterprise%20Plan%20Enquiry";
      return;
    }
    if (!user) { router.push("/register"); return; }

    setLoadingPlan(planId);
    setError(null);
    try {
      // Step 1 — create Razorpay order on backend
      const res = await api.post("/billing/checkout", { plan: planId });
      const { orderId, amount, currency, keyId } = res.data?.data ?? {};

      if (!orderId) { setError("Failed to create payment order."); return; }

      // Step 2 — load Razorpay checkout script
      const loaded = await loadRazorpayScript();
      if (!loaded) { setError("Failed to load payment gateway. Check your connection."); return; }

      // Step 3 — open Razorpay modal
      const rzp = new (window as any).Razorpay({
        key:         keyId,
        amount,
        currency,
        order_id:    orderId,
        name:        "ContractIQ",
        description: `${planId} Plan — Monthly`,
        prefill:     { email: user.email },
        theme:       { color: "#6366F1" },
        handler: async (payment: any) => {
          // Step 4 — verify HMAC on backend and activate plan
          try {
            await api.post("/billing/verify", {
              razorpay_order_id:   payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature:  payment.razorpay_signature,
              planId,
            });
            router.push("/dashboard?upgraded=1");
          } catch {
            setError("Payment received but verification failed. Contact support.");
          }
        },
        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
      });
      rzp.open();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Failed to initiate checkout.";
      setError(msg);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark text-zinc-300 overflow-x-hidden">
      <div className="fixed inset-0 hero-mesh bg-grid pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto border-b border-border/40">
        <Link href="/" className="font-display text-xl font-semibold italic text-primary-gold">ContractIQ</Link>
        <div className="flex items-center gap-4 text-sm">
          {user
            ? <Link href="/dashboard" className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors">Dashboard <ArrowRight size={12} /></Link>
            : <>
                <Link href="/login"    className="text-zinc-400 hover:text-white transition-colors">Sign in</Link>
                <Link href="/register" className="bg-primary-gold hover:bg-[#a68626] text-black font-bold px-4 py-2 rounded-lg transition-colors">Start Free Trial</Link>
              </>
          }
        </div>
      </nav>

      <div className="relative z-10 pt-20 pb-32 px-6">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 text-xs text-primary-gold uppercase tracking-widest font-semibold border border-primary-gold/20 bg-primary-gold/5 px-4 py-1.5 rounded-full mb-6">
            <ShieldCheck size={11} /> Simple, transparent pricing
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-medium text-white mb-4 leading-tight">
            Plans for every<br />
            <span className="italic text-primary-gold">practice size.</span>
          </h1>
          <p className="text-zinc-400 text-lg mb-8">
            Start with a 14-day free trial. No credit card required.
            <br />
            <span className="text-sm text-zinc-600">Failed analyses never count against your quota.</span>
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-[#111] border border-[#222] rounded-xl p-1">
            {(["Monthly", "Annual"] as const).map((label) => {
              const isAnnual = label === "Annual";
              const active   = annual === isAnnual;
              return (
                <button
                  key={label}
                  onClick={() => setAnnual(isAnnual)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                    ${active ? "bg-primary-gold text-black" : "text-zinc-400 hover:text-white"}`}
                >
                  {label}
                  {isAnnual && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                      ${active ? "bg-black/20 text-black" : "bg-green-500/15 text-green-400 border border-green-500/20"}`}>
                      Save 20%
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 inline-block bg-red-950/40 border border-red-800/40 text-red-400 px-6 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {PLANS.map((plan, i) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isLoading     = loadingPlan === plan.id;

            return (
              <div
                key={plan.id}
                ref={(el) => { cardRefs.current[i] = el; }}
                onMouseMove={(e) => handleMouseMove(e, i)}
                className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1
                  ${plan.highlight
                    ? "bg-[#111] border-2 border-primary-gold shadow-xl shadow-primary-gold/10"
                    : "bg-[#111] border border-[#222] hover:border-[#333]"
                  }`}
              >
                {/* Top line */}
                <div className={`absolute top-0 left-6 right-6 h-px
                  ${plan.highlight
                    ? "bg-linear-to-r from-primary-gold/60 via-[#e8bc50]/80 to-primary-gold/60"
                    : "bg-linear-to-r from-transparent via-primary-gold/15 to-transparent"
                  }`}
                />

                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-gold text-black text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}

                {/* Current plan badge */}
                {isCurrentPlan && (
                  <div className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                    Current
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-5">
                  <h3 className="font-display text-lg font-semibold text-white mb-0.5">{plan.name}</h3>
                  <p className="text-[11px] text-zinc-500">{plan.tagline}</p>
                </div>

                {/* Price */}
                <div className="mb-5">
                  {plan.enterprise ? (
                    <div className="flex items-end gap-1">
                      <span className="font-display text-3xl font-medium text-white">Custom</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-end gap-1">
                        <span className="font-display text-4xl font-medium text-white leading-none">
                          ${annual ? plan.annualPrice : plan.monthlyPrice}
                        </span>
                        <span className="text-zinc-500 text-sm mb-1">/mo</span>
                      </div>
                      {annual && (
                        <p className="text-[10px] text-green-400 mt-1">
                          Billed ${(plan.annualPrice ?? 0) * 12}/yr · save ${((plan.monthlyPrice ?? 0) - (plan.annualPrice ?? 0)) * 12}
                        </p>
                      )}
                      {plan.analysisLimit && (
                        <p className="text-[10px] text-zinc-600 mt-1">
                          {plan.analysisLimit} analyses / month
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleSubscribe(plan.id, plan.enterprise)}
                  disabled={loadingPlan !== null || isCurrentPlan}
                  className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex justify-center items-center gap-2 mb-6 disabled:opacity-50 disabled:cursor-not-allowed
                    ${plan.highlight
                      ? "bg-primary-gold hover:bg-[#a68626] text-black"
                      : plan.enterprise
                        ? "bg-transparent border border-purple-500/40 hover:border-purple-500/70 text-purple-400"
                        : isCurrentPlan
                          ? "bg-green-400/10 border border-green-400/20 text-green-400 cursor-default"
                          : "bg-border border border-[#2a2a2a] hover:border-primary-gold/30 text-white"
                    }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrentPlan ? (
                    "Current plan"
                  ) : plan.enterprise ? (
                    <><Mail size={13} /> Contact sales</>
                  ) : !user ? (
                    plan.cta
                  ) : (
                    <><Zap size={13} /> Subscribe now</>
                  )}
                </button>

                {/* Features */}
                <ul className="space-y-2.5 mt-auto">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check size={12} className="text-primary-gold mt-0.5 shrink-0" />
                      <span className="text-[11px] text-zinc-400 leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Trust bar */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-[#222] mb-20">
          {[
            { icon: ShieldCheck, title: "AES-256 encryption",  desc: "Contracts encrypted at rest and in transit" },
            { icon: Clock,       title: "60-second analysis",   desc: "Upload to risk report in under a minute"   },
            { icon: Zap,         title: "Failed = no charge",   desc: "Only successful analyses count toward quota" },
          ].map((t) => (
            <div key={t.title} className="flex items-center gap-4 px-6 py-5 bg-[#111] hover:bg-card-dark transition-colors">
              <t.icon size={16} className="text-primary-gold shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">{t.title}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl font-medium text-white text-center mb-8">
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={faq.q} className="border border-[#222] rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-card-dark transition-colors"
                >
                  <span className="text-sm font-medium text-white">{faq.q}</span>
                  <span className={`text-primary-gold transition-transform duration-200 text-lg leading-none shrink-0 ml-4 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-40" : "max-h-0"}`}>
                  <p className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed border-t border-border pt-3">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}