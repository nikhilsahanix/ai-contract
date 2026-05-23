// frontend/src/app/(auth)/login/page.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useState } from "react";
import { Loader2, ArrowRight, ShieldCheck, FileSearch, Zap } from "lucide-react";
import Link from "next/link";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "AES-256 encrypted storage" },
  { icon: FileSearch,  text: "Row-level firm isolation" },
  { icon: Zap,         text: "AI redlines in 60 seconds" },
];

export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", data);
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark flex overflow-hidden">
      {/* Mesh background */}
      <div className="fixed inset-0 hero-mesh bg-grid pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none"><div className="bg-noise w-full h-full" /></div>

      {/* ─── LEFT: Brand panel ─── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] relative p-12 border-r border-border/40">
        <Link href="/" className="font-display text-2xl font-semibold italic text-primary-gold">
          ContractIQ
        </Link>

        <div className="space-y-8">
          <div>
            <p className="text-xs text-primary-gold uppercase tracking-[0.2em] font-semibold mb-4">Why attorneys trust us</p>
            <h2 className="font-display text-4xl font-medium text-white leading-snug mb-6">
              Review contracts{" "}
              <span className="italic text-primary-gold">10× faster.</span><br />
              Miss nothing.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
              ContractIQ analyses every clause in under 60 seconds — flagging unlimited liability exposure,
              missing protections, and unfair terms before your client signs.
            </p>
          </div>

          <div className="space-y-4">
            {TRUST_POINTS.map((t) => (
              <div key={t.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-gold/10 border border-primary-gold/20 flex items-center justify-center">
                  <t.icon size={14} className="text-primary-gold" />
                </div>
                <span className="text-sm text-zinc-300">{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Floating decoration */}
        <div className="anim-float absolute right-8 top-1/3 w-48 h-48 rounded-2xl bg-primary-gold/4 border border-primary-gold/10 rotate-12 -z-10" />
        <div className="anim-float delay-300 absolute right-20 top-1/2 w-24 h-24 rounded-xl bg-primary-gold/3 border border-primary-gold/8 -rotate-6 -z-10" />

        <p className="text-xs text-zinc-700">© {new Date().getFullYear()} ContractIQ</p>
      </div>

      {/* ─── RIGHT: Form panel ─── */}
      <div className="flex-1 flex flex-col">
        {/* Top nav */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-border/30 lg:border-0">
          <Link href="/" className="font-display text-xl font-semibold italic text-primary-gold lg:hidden">
            ContractIQ
          </Link>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-zinc-500 hidden sm:inline">New here?</span>
            <Link href="/register" className="flex items-center gap-1.5 text-zinc-300 hover:text-primary-gold transition-colors font-medium">
              Create account <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Form centred */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md anim-fade-up">

            {/* Card */}
            <div className="relative bg-card-dark border border-border rounded-2xl p-8 shadow-2xl overflow-hidden">
              {/* Top gold accent */}
              <div className="absolute top-0 left-8 right-8 h-px bg-linear-to-r from-transparent via-primary-gold/50 to-transparent" />
              {/* Scanline */}
              <div className="scanline" />

              <div className="mb-8">
                <h1 className="font-display text-3xl font-semibold text-white mb-2">Welcome back</h1>
                <p className="text-zinc-500 text-sm">Sign in to your secure workspace</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Work Email
                  </label>
                  <input
                    {...register("email")}
                    type="email"
                    autoComplete="email"
                    className="input-premium w-full bg-bg-dark border border-border rounded-xl px-4 py-3 text-zinc-200 outline-none placeholder:text-zinc-600 text-sm"
                    placeholder="attorney@firm.com"
                  />
                  {errors.email && <p className="text-red-400 text-xs">{errors.email.message as string}</p>}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
                    <Link href="/forgot-password" className="text-[11px] text-primary-gold hover:text-gold-light transition-colors">
                      Forgot?
                    </Link>
                  </div>
                  <input
                    {...register("password")}
                    type="password"
                    autoComplete="current-password"
                    className="input-premium w-full bg-bg-dark border border-border rounded-xl px-4 py-3 text-zinc-200 outline-none placeholder:text-zinc-700 text-sm"
                    placeholder="••••••••••••"
                  />
                  {errors.password && <p className="text-red-400 text-xs">{errors.password.message as string}</p>}
                </div>

                {/* Error */}
                {error && (
                  <div className="anim-fade-in p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-xs text-center">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full bg-primary-gold hover:bg-gold-light disabled:opacity-60 text-black font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mt-2 overflow-hidden"
                >
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 overflow-hidden rounded-xl pointer-events-none">
                    <span className="absolute top-0 bottom-0 w-1/3 bg-white/15 skew-x-[-20deg] translate-x-[-200%] group-hover:translate-x-[400%] transition-transform duration-500" />
                  </span>
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Sign in to Workspace"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-zinc-500">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary-gold hover:text-gold-light transition-colors font-medium">
                  Start 14-day free trial
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
