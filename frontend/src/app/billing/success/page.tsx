// frontend/src/app/billing/success/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";

/* ── Particle canvas ── */
function ParticleBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;
    const GOLD = ["#B8952A", "#D4AB3A", "#e5c158", "#f0d070", "#fff5c0"];

    const particles = Array.from({ length: 120 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 3,
        life: 1,
        decay: 0.012 + Math.random() * 0.012,
        size: 3 + Math.random() * 5,
        color: GOLD[Math.floor(Math.random() * GOLD.length)],
        gravity: 0.08 + Math.random() * 0.05,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        isRect: Math.random() > 0.5,
      };
    });

    let rafId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.life -= p.decay;
        p.rotation += p.rotSpeed;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        if (p.isRect) {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (alive) rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full z-10"
      aria-hidden="true"
    />
  );
}

/* ── Plan meta ── */
const PLAN_LABELS: Record<string, { name: string; limit: number; color: string }> = {
  SOLO:           { name: "Solo Practitioner", limit: 25,  color: "text-zinc-300"    },
  FIRM:           { name: "Law Firm",           limit: 150, color: "text-primary-gold" },
  API_WHITELABEL: { name: "API & White-Label",  limit: 500, color: "text-blue-400"    },
};

const PLAN_FEATURES: Record<string, string[]> = {
  SOLO: [
    "25 contract analyses per month",
    "AI risk scoring + clause-level flagging",
    "Redline PDF generation, ready to share",
    "Email notifications on completion",
  ],
  FIRM: [
    "150 contract analyses per month",
    "Everything in Solo",
    "Multi-user workspace enabled",
    "Custom firm logo on redlines",
    "Full audit logs",
    "Priority processing queue",
  ],
  API_WHITELABEL: [
    "Unlimited analyses (usage billed)",
    "Everything in Firm",
    "Full REST API + webhook delivery",
    "API key management",
    "White-label branding support",
    "99.9% uptime SLA",
  ],
};

/* ── Page ── */
export default function BillingSuccessPage() {
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [attempts,   setAttempts]   = useState(0);
  const attemptsRef  = useRef(0);
  const originalPlan = useRef(user?.org?.plan ?? "SOLO");
  const MAX_ATTEMPTS = 12;

  useEffect(() => {
    const poll = async () => {
      attemptsRef.current += 1;
      setAttempts(attemptsRef.current);
      try {
        const res   = await api.get("/me");
        const fresh = res.data?.data;
        if (fresh) {
          const newPlan = (fresh.org?.plan as string) ?? "SOLO";
          if (accessToken && refreshToken) setAuth(fresh, accessToken, refreshToken);
          if (newPlan !== originalPlan.current) {
            setActivePlan(newPlan);
            setRefreshing(false);
            return;
          }
        }
      } catch { /* keep polling */ }
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        setActivePlan(user?.org?.plan ?? "SOLO");
        setRefreshing(false);
        return;
      }
      setTimeout(poll, 2000);
    };
    const t = setTimeout(poll, 1000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  const planInfo     = PLAN_LABELS[activePlan ?? "SOLO"];
  const planFeatures = PLAN_FEATURES[activePlan ?? "SOLO"] ?? PLAN_FEATURES.SOLO;
  const progress     = Math.min(Math.round((attempts / MAX_ATTEMPTS) * 100), 95);

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Backgrounds */}
      <div className="fixed inset-0 hero-mesh bg-grid pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none"><div className="bg-noise w-full h-full" /></div>

      {/* Particle burst fires when plan confirmed */}
      <ParticleBurst active={!refreshing} />

      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`rounded-full blur-3xl transition-all duration-1000 ${!refreshing ? "w-150 h-150 bg-primary-gold/8" : "w-64 h-64 bg-primary-gold/3"}`} />
      </div>

      <div className="relative z-20 max-w-lg w-full text-center anim-fade-up">

        {/* Icon */}
        <div className="relative inline-flex items-center justify-center mb-8">
          {!refreshing && (
            <>
              <span className="absolute w-36 h-36 rounded-full border border-primary-gold/20 animate-ping opacity-20" />
              <span className="absolute w-28 h-28 rounded-full border border-primary-gold/30 animate-ping opacity-30" style={{ animationDelay: "200ms" }} />
            </>
          )}
          <div className={`relative w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${!refreshing ? "bg-primary-gold/15 border-primary-gold/50 shadow-lg shadow-primary-gold/20" : "bg-card-dark border-border"}`}>
            {refreshing
              ? <Loader2 className="w-10 h-10 text-primary-gold animate-spin" />
              : <CheckCircle2 className="w-12 h-12 text-primary-gold anim-fade-in" />
            }
          </div>
        </div>

        {/* Heading */}
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-white mb-3 anim-fade-up delay-100">
          {refreshing ? "Activating your plan…" : "You're all set! 🎉"}
        </h1>

        {refreshing ? (
          <div className="space-y-6 anim-fade-in">
            <p className="text-zinc-400 text-sm leading-relaxed">
              Confirming your subscription with Stripe.<br />
              This usually takes under 10 seconds.
            </p>
            <div className="w-full max-w-xs mx-auto h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-gold rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-center gap-2">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
          </div>

        ) : (
          <div className="anim-fade-in">
            <p className="text-zinc-400 mb-1 text-sm">
              Welcome to{" "}
              <span className={`font-bold ${planInfo?.color}`}>{planInfo?.name}</span>.
            </p>
            <p className="text-zinc-500 text-sm mb-8">
              You now have{" "}
              <span className="text-white font-semibold">{planInfo?.limit} analyses/month</span>.
            </p>

            {/* Features */}
            <div className="bg-card-dark border border-border-gold rounded-2xl p-6 mb-8 text-left space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-6 right-6 h-px bg-linear-to-r from-transparent via-primary-gold/30 to-transparent" />
              {planFeatures.map((feat) => (
                <div key={feat} className="flex items-center gap-3">
                  <Sparkles className="w-3.5 h-3.5 text-primary-gold shrink-0" />
                  <span className="text-sm text-zinc-300">{feat}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard"
                className="group flex items-center justify-center gap-2 bg-primary-gold hover:bg-gold-light text-black font-bold px-8 py-3.5 rounded-xl transition-all duration-200 overflow-hidden relative"
              >
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 overflow-hidden rounded-xl pointer-events-none">
                  <span className="absolute top-0 bottom-0 w-1/3 bg-white/15 skew-x-[-20deg] translate-x-[-200%] group-hover:translate-x-[400%] transition-transform duration-500" />
                </span>
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/settings"
                className="flex items-center justify-center gap-2 border border-border hover:border-border-mid text-zinc-400 hover:text-white font-medium px-8 py-3.5 rounded-xl transition-all duration-200"
              >
                View Settings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
