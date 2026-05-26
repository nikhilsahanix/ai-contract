"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Lock, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import Link from "next/link";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token  = params.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)  { setError("Passwords do not match."); return; }
    if (!token)                { setError("Invalid or missing reset token."); return; }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setError(msg ?? "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-zinc-400 mb-4">Invalid or expired reset link.</p>
        <Link href="/forgot-password" className="text-xs text-primary-gold hover:text-gold-light">Request a new link â†’</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={24} className="text-green-400" />
        </div>
        <h2 className="text-sm font-bold text-white mb-2">Password updated!</h2>
        <p className="text-xs text-zinc-500">Redirecting you to sign inâ€¦</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <Link href="/" className="font-display text-lg font-semibold italic text-primary-gold">ContractIQ</Link>
        <h1 className="text-xl font-bold text-white mt-4 mb-1">Set new password</h1>
        <p className="text-sm text-zinc-500">Choose a strong password for your account.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">New Password</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              autoFocus
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full bg-bg-dark border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-primary-gold/40 transition-colors"
            />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 cursor-pointer">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type={showPw ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your new password"
              className="w-full bg-bg-dark border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-primary-gold/40 transition-colors"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary-gold hover:bg-gold-hover disabled:opacity-50 text-black font-bold py-2.5 rounded-xl transition-all text-sm cursor-pointer"
        >
          {loading ? <><Loader2 size={14} className="animate-spin" /> Updatingâ€¦</> : "Update password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4 overflow-hidden">
      <div className="fixed inset-0 hero-mesh bg-grid pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none"><div className="bg-noise w-full h-full" /></div>

      <div className="relative w-full max-w-sm">
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-primary-gold/40 to-transparent" />
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 size={20} className="text-zinc-700 animate-spin" /></div>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
