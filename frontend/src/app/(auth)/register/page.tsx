// frontend/src/app/(auth)/register/page.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useState, useMemo } from "react";
import { Loader2, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

const registerSchema = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string()
    .min(10, "At least 10 characters")
    .regex(/[A-Z]/, "One uppercase letter")
    .regex(/[0-9]/, "One number")
    .regex(/[^A-Za-z0-9]/, "One special character"),
  orgName:  z.string().min(2, "Firm name is required"),
  orgSlug:  z.string().min(2, "Required").regex(/^[a-z0-9-]+$/, "Lowercase, numbers & hyphens only"),
});

const PASSWORD_RULES = [
  { label: "10+ characters",       test: (p: string) => p.length >= 10 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number",           test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character",test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", orgName: "", orgSlug: "" },
  });

  const password = watch("password") ?? "";
  const strength = useMemo(() => PASSWORD_RULES.filter((r) => r.test(password)).length, [password]);

  const strengthColor = strength <= 1 ? "#ef4444" : strength <= 2 ? "#f97316" : strength <= 3 ? "#eab308" : "#22c55e";
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength] ?? "";

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setValue("orgName", name);
    setValue("orgSlug", name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/register", data);
      router.push(`/verify-pending?email=${encodeURIComponent(data.email)}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark flex overflow-hidden">
      {/* Backgrounds */}
      <div className="fixed inset-0 hero-mesh bg-grid pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none"><div className="bg-noise w-full h-full" /></div>

      {/* ─── LEFT: Steps visual ─── */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] p-12 border-r border-border/40">
        <Link href="/" className="font-display text-2xl font-semibold italic text-primary-gold">ContractIQ</Link>

        <div>
          <p className="text-xs text-primary-gold uppercase tracking-[0.2em] font-semibold mb-6">Set up in 2 minutes</p>
          <div className="space-y-6">
            {[
              { n: 1, t: "Create your workspace",    d: "Name your firm and get a unique workspace URL." },
              { n: 2, t: "Verify your email",         d: "One click in your inbox to activate." },
              { n: 3, t: "Upload your first contract",d: "Drop any PDF — AI analysis starts in seconds." },
            ].map((s, i) => (
              <div key={s.n} className={`flex gap-5 ${i > 0 ? "opacity-50" : ""}`}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${i === 0 ? "border-primary-gold text-primary-gold bg-primary-gold/10" : "border-border text-zinc-600"}`}>
                    {i === 0 ? "●" : s.n}
                  </div>
                  {i < 2 && <div className="w-px flex-1 bg-border mt-2" />}
                </div>
                <div className="pb-6">
                  <p className="text-sm font-semibold text-white mb-1">{s.t}</p>
                  <p className="text-xs text-zinc-500">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* decoration */}
        <div className="anim-float absolute right-6 bottom-1/3 w-40 h-40 rounded-full bg-primary-gold/4 border border-primary-gold/10 -z-10" />
        <p className="text-xs text-zinc-700">No credit card required · Cancel anytime</p>
      </div>

      {/* ─── RIGHT: Form ─── */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-8 py-5 border-b border-border/30 lg:border-0">
          <Link href="/" className="font-display text-xl font-semibold italic text-primary-gold lg:hidden">ContractIQ</Link>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-zinc-500 hidden sm:block">Already have an account?</span>
            <Link href="/login" className="text-primary-gold hover:text-gold-light transition-colors font-medium flex items-center gap-1">
              Sign in <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md anim-fade-up">
            <div className="relative bg-card-dark border border-border rounded-2xl p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-8 right-8 h-px bg-linear-to-r from-transparent via-primary-gold/40 to-transparent" />

              <div className="mb-7">
                <h1 className="font-display text-3xl font-semibold text-white mb-1">Start your free trial</h1>
                <p className="text-xs text-primary-gold font-semibold uppercase tracking-widest">14 days · No credit card</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Org Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Law Firm / Org Name
                  </label>
                  <input
                    {...register("orgName")}
                    onChange={handleOrgNameChange}
                    className="input-premium w-full bg-bg-dark border border-border rounded-xl px-4 py-2.5 text-zinc-200 outline-none placeholder:text-zinc-600 text-sm"
                    placeholder="Smith & Associates"
                  />
                  {errors.orgName && <p className="text-red-400 text-xs mt-1">{errors.orgName.message as string}</p>}
                </div>

                {/* Workspace slug */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Workspace URL
                  </label>
                  <div className="flex items-center bg-bg-dark border border-border rounded-xl overflow-hidden focus-within:border-primary-gold/60 focus-within:shadow-[0_0_0_3px_rgba(184,149,42,0.08)] transition-all">
                    <span className="text-zinc-600 text-xs pl-3 pr-1 bg-surface border-r border-border py-2.5 whitespace-nowrap">
                      contractiq.com/
                    </span>
                    <input
                      {...register("orgSlug")}
                      className="w-full bg-transparent px-2 py-2.5 text-zinc-200 outline-none text-sm"
                      placeholder="smith-law"
                    />
                  </div>
                  {errors.orgSlug && <p className="text-red-400 text-xs mt-1">{errors.orgSlug.message as string}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Work Email</label>
                  <input
                    {...register("email")}
                    type="email"
                    className="input-premium w-full bg-bg-dark border border-border rounded-xl px-4 py-2.5 text-zinc-200 outline-none placeholder:text-zinc-600 text-sm"
                    placeholder="attorney@firm.com"
                  />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message as string}</p>}
                </div>

                {/* Password + strength */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Password</label>
                  <input
                    {...register("password")}
                    type="password"
                    className="input-premium w-full bg-bg-dark border border-border rounded-xl px-4 py-2.5 text-zinc-200 outline-none placeholder:text-zinc-700 text-sm"
                    placeholder="••••••••••••"
                  />

                  {/* Strength bar */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-2 anim-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1 flex-1 mr-3">
                          {[1,2,3,4].map((n) => (
                            <div
                              key={n}
                              className="h-1 flex-1 rounded-full transition-all duration-300"
                              style={{ background: n <= strength ? strengthColor : "#1a1a1a" }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: strengthColor }}>{strengthLabel}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {PASSWORD_RULES.map((r) => {
                          const ok = r.test(password);
                          return (
                            <div key={r.label} className="flex items-center gap-1.5">
                              {ok
                                ? <CheckCircle2 size={10} className="text-green-500 shrink-0" />
                                : <Circle size={10} className="text-zinc-700 shrink-0" />
                              }
                              <span className={`text-[10px] ${ok ? "text-zinc-400" : "text-zinc-600"}`}>{r.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message as string}</p>}
                </div>

                {error && (
                  <div className="anim-fade-in p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-xs">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full bg-primary-gold hover:bg-gold-light disabled:opacity-60 text-black font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mt-2 overflow-hidden"
                >
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 overflow-hidden rounded-xl pointer-events-none">
                    <span className="absolute top-0 bottom-0 w-1/3 bg-white/15 skew-x-[-20deg] translate-x-[-200%] group-hover:translate-x-[400%] transition-transform duration-500" />
                  </span>
                  {loading
                    ? <><Loader2 className="animate-spin w-4 h-4" /> Creating workspace…</>
                    : <><ArrowRight size={15} /> Create Account</>
                  }
                </button>
              </form>

              <p className="text-center text-zinc-600 text-xs mt-5">
                Already have an account?{" "}
                <Link href="/login" className="text-primary-gold hover:text-gold-light transition-colors">Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
