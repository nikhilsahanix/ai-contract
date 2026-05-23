"use client";

import { useState } from "react";
import api from "@/lib/api";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address."); return; }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setError(msg ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4 overflow-hidden">
      <div className="fixed inset-0 hero-mesh bg-grid pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none"><div className="bg-noise w-full h-full" /></div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-primary-gold/40 to-transparent" />

          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={24} className="text-green-400" />
              </div>
              <h1 className="text-lg font-bold text-white mb-2">Check your inbox</h1>
              <p className="text-sm text-zinc-500 leading-relaxed mb-6">
                If <span className="text-zinc-300">{email}</span> has an account,
                you'll receive a password reset link shortly.
              </p>
              <p className="text-xs text-zinc-600 mb-4">Didn't receive it? Check your spam folder.</p>
              <Link href="/login" className="text-xs text-primary-gold hover:text-gold-light transition-colors">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <Link href="/" className="font-display text-lg font-semibold italic text-primary-gold">
                  ContractIQ
                </Link>
                <h1 className="text-xl font-bold text-white mt-4 mb-1">Forgot your password?</h1>
                <p className="text-sm text-zinc-500">Enter your email and we'll send a reset link.</p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      autoFocus
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@lawfirm.com"
                      className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-primary-gold/40 transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-primary-gold hover:bg-[#5254d4] disabled:opacity-50 text-black font-bold py-2.5 rounded-xl transition-all text-sm cursor-pointer"
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : "Send reset link"}
                </button>
              </form>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 mt-5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <ArrowLeft size={12} /> Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
