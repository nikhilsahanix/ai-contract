// frontend/src/app/(auth)/verify-email/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token        = searchParams.get("token");
  const router       = useRouter();
  const setAuth      = useAuthStore((s) => s.setAuth);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    const verify = async () => {
      try {
        const res = await api.get(`/auth/verify-email?token=${token}`);
        if (res.data?.data?.accessToken) {
          const { user, accessToken, refreshToken } = res.data.data;
          setAuth(user, accessToken, refreshToken);
        }
        setStatus("success");
        setTimeout(() => router.push("/dashboard"), 2400);
      } catch {
        setStatus("error");
      }
    };
    verify();
  }, [token, router, setAuth]);

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4 relative overflow-hidden">
      <div className="fixed inset-0 hero-mesh bg-grid pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none"><div className="bg-noise w-full h-full" /></div>

      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`rounded-full blur-3xl transition-all duration-1000 ${status === "success" ? "w-96 h-96 bg-primary-gold/8" : status === "error" ? "w-64 h-64 bg-red-500/5" : "w-48 h-48 bg-primary-gold/4"}`} />
      </div>

      <div className="relative z-10 w-full max-w-md anim-fade-up">
        <div className="relative bg-card-dark border border-border rounded-2xl p-10 text-center shadow-2xl overflow-hidden">
          <div className={`absolute top-0 left-8 right-8 h-px bg-linear-to-r from-transparent ${status === "error" ? "via-red-500/30" : "via-primary-gold/40"} to-transparent`} />

          {/* ─── LOADING ─── */}
          {status === "loading" && (
            <div className="flex flex-col items-center anim-fade-in">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-2 border-primary-gold/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-primary-gold border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-2 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-primary-gold animate-spin" />
                </div>
              </div>
              <h2 className="font-display text-2xl font-semibold text-white mb-2">Verifying your email</h2>
              <p className="text-zinc-500 text-sm">Hold tight just a moment…</p>
              <div className="flex gap-2 mt-6">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </div>
            </div>
          )}

          {/* ─── SUCCESS ─── */}
          {status === "success" && (
            <div className="flex flex-col items-center anim-fade-up">
              <div className="relative w-20 h-20 mb-6">
                <span className="absolute inset-0 rounded-full bg-green-500/10 animate-ping opacity-40" />
                <div className="relative w-full h-full rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
              </div>
              <h2 className="font-display text-3xl font-semibold text-white mb-2">Email Verified!</h2>
              <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                Your account is active. Taking you to the dashboard…
              </p>
              {/* Progress bar */}
              <div className="w-full h-1 bg-border rounded-full overflow-hidden mb-2">
                <div className="h-full bg-primary-gold rounded-full anim-progress" />
              </div>
              <p className="text-[10px] text-zinc-600">Redirecting automatically</p>
            </div>
          )}

          {/* ─── ERROR ─── */}
          {status === "error" && (
            <div className="flex flex-col items-center anim-fade-up">
              <div className="w-20 h-20 rounded-full bg-red-950/30 border border-red-900/40 flex items-center justify-center mb-6">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="font-display text-3xl font-semibold text-white mb-2">Link Expired</h2>
              <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                This link is invalid or has expired.<br />
                Request a new one from the login page.
              </p>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 w-full border border-border hover:border-primary-gold/40 text-zinc-300 hover:text-white font-medium py-3 rounded-xl transition-all"
              >
                Back to Login <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-dark" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
