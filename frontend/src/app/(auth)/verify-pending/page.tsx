// frontend/src/app/(auth)/verify-pending/page.tsx
"use client";

import { MailOpen, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VerifyPendingContent() {
  const email = useSearchParams().get("email") || "your email";

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4 relative overflow-hidden">
      <div className="fixed inset-0 hero-mesh bg-grid pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none"><div className="bg-noise w-full h-full" /></div>

      {/* Glow orb */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-125 h-125 bg-primary-gold/4 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md anim-fade-up">
        <div className="relative bg-card-dark border border-border rounded-2xl p-10 text-center shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-8 right-8 h-px bg-linear-to-r from-transparent via-primary-gold/40 to-transparent" />

          {/* Icon */}
          <div className="relative inline-flex items-center justify-center mb-8">
            <div className="absolute w-20 h-20 bg-primary-gold/10 rounded-full animate-ping opacity-30" />
            <div className="relative w-16 h-16 rounded-2xl bg-primary-gold/10 border border-primary-gold/30 flex items-center justify-center">
              <MailOpen className="w-8 h-8 text-primary-gold anim-float" />
            </div>
          </div>

          <h1 className="font-display text-3xl font-semibold text-white mb-3">Check your inbox</h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            We sent a secure verification link to{" "}
            <span className="text-white font-semibold">{email}</span>.
            <br />Click it to activate your ContractIQ workspace.
          </p>

          <div className="bg-surface/60 border border-border/60 rounded-xl p-4 mb-8 text-left">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">Can't find it?</p>
            <ul className="space-y-1.5 text-xs text-zinc-500">
              <li>· Check your spam / junk folder</li>
              <li>· Make sure you entered the right email</li>
              <li>· Allow 1–2 minutes for delivery</li>
            </ul>
          </div>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full border border-border hover:border-primary-gold/40 text-zinc-300 hover:text-white font-medium py-3 rounded-xl transition-all duration-200"
          >
            Return to login <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPendingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-dark" />}>
      <VerifyPendingContent />
    </Suspense>
  );
}
