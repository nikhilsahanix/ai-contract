"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2, Loader2, User, Building2, CreditCard,
  Zap, ShieldCheck, AlertTriangle, Lock, Key, Monitor,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tab = "profile" | "billing" | "security";

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "profile",  label: "Profile",  icon: User        },
  { id: "billing",  label: "Billing",  icon: CreditCard  },
  { id: "security", label: "Security", icon: ShieldCheck },
];

const PLAN_META: Record<string, {
  label: string; colour: string; bg: string; border: string;
  limit: number | null; description: string;
}> = {
  SOLO:       { label: "Solo",       colour: "text-zinc-300",    bg: "bg-zinc-400/10",    border: "border-zinc-400/20",    limit: 25,   description: "Independent attorney plan"     },
  FIRM:       { label: "Firm",       colour: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20",    limit: 100,  description: "Growing practice plan"         },
  MAX:        { label: "Max",        colour: "text-primary-gold",bg: "bg-primary-gold/10",border: "border-primary-gold/20",limit: 250,  description: "High-volume firm plan"         },
  ENTERPRISE: { label: "Enterprise", colour: "text-purple-400",  bg: "bg-purple-400/10",  border: "border-purple-400/20",  limit: null, description: "Custom volume & integrations" },
};

export default function SettingsPage() {
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const router = useRouter();

  const [tab,           setTab]           = useState<Tab>("profile");
  const [loading,       setLoading]       = useState(false);
  const [success,       setSuccess]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [refreshing,    setRefreshing]    = useState(true);

  // Editable profile fields
  const [displayName,   setDisplayName]   = useState("");
  const [currentPw,     setCurrentPw]     = useState("");
  const [newPw,         setNewPw]         = useState("");
  const [pwSuccess,     setPwSuccess]     = useState(false);
  const [pwError,       setPwError]       = useState<string | null>(null);
  const [pwLoading,     setPwLoading]     = useState(false);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res   = await api.get("/me");
        const fresh = res.data?.data;
        if (fresh && accessToken && refreshToken) {
          setAuth(fresh, accessToken, refreshToken);
          setDisplayName(fresh.name ?? "");
        }
      } catch { /* silent */ } finally { setRefreshing(false); }
    };
    fetchMe();
  }, []); // eslint-disable-line

  const planKey      = (user?.org?.plan ?? "SOLO") as string;
  const planMeta     = PLAN_META[planKey] ?? PLAN_META.SOLO;
  const isEnterprise = planKey === "ENTERPRISE";

  const analysisCount = user?.org?.analysisCount ?? 0;
  const analysisLimit = user?.org?.analysisLimit ?? 25;
  const quotaPercent  = isEnterprise ? 0 : Math.min(Math.round((analysisCount / analysisLimit) * 100), 100);
  const quotaWarning  = !isEnterprise && quotaPercent >= 80;
  const quotaCritical = !isEnterprise && quotaPercent >= 95;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);
    try {
      await api.patch("/me", { name: displayName.trim() || undefined });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPw || !newPw) { setPwError("All fields are required."); return; }
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    setPwLoading(true);
    setPwSuccess(false);
    setPwError(null);
    try {
      await api.patch("/me/password", { currentPassword: currentPw, newPassword: newPw });
      setPwSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      setPwError(err?.response?.data?.error?.message ?? "Failed to change password.");
    } finally {
      setPwLoading(false);
    }
  };

  const Field = ({ label, value, disabled = false, onChange, type = "text", placeholder = "" }: {
    label: string; value: string; disabled?: boolean;
    onChange?: (v: string) => void; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        disabled={disabled}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors
          ${disabled
            ? "bg-[#0a0a0a] border-[#1a1a1a] text-zinc-600 cursor-not-allowed"
            : "bg-[#0d0d0d] border-[#222] text-zinc-300 focus:border-primary-gold/40 placeholder-zinc-700"
          }`}
      />
    </div>
  );

  return (
    <div className="max-w-3xl pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Workspace Settings</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Manage your account, firm details, and billing</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#1e1e1e] mb-8">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setError(null); }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all duration-200 -mb-px cursor-pointer
              ${tab === id ? "border-primary-gold text-primary-gold" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
          >
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* ── PROFILE ── */}
      {tab === "profile" && (
        <div className="space-y-6">
          {/* Profile card */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-px bg-linear-to-r from-transparent via-primary-gold/20 to-transparent" />
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary-gold/10 border border-primary-gold/25 flex items-center justify-center text-primary-gold text-lg font-bold">
                {user?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div>
                <p className="font-semibold text-white text-sm">{user?.email}</p>
                <p className="text-xs text-zinc-500 mt-0.5 capitalize">{user?.role?.toLowerCase()} · {user?.org?.name}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <Field
                label="Display Name"
                value={displayName}
                onChange={setDisplayName}
                placeholder="Your full name"
              />
              <Field label="Email Address" value={user?.email ?? ""} disabled />
              <Field label="Role"          value={user?.role  ?? ""} disabled />
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-primary-gold hover:bg-[#5254d4] disabled:opacity-50 text-black font-bold px-4 py-2 rounded-xl transition-all text-sm cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
                </button>
              </div>
            </form>

            {success && (
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl mt-4">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p className="text-sm">Profile saved.</p>
              </div>
            )}
            {error && <p className="text-sm text-red-400 mt-4 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-xl">{error}</p>}
          </div>

          {/* Firm card */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <Building2 size={14} className="text-zinc-500" />
              <h3 className="font-semibold text-white text-sm">Firm Details</h3>
            </div>
            <div className="space-y-4">
              <Field label="Organization Name" value={user?.org?.name ?? ""} disabled />
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Workspace URL</label>
                <div className="flex items-center bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden opacity-60">
                  <span className="text-zinc-600 text-xs pl-3 pr-2 bg-[#111] border-r border-[#222] py-2.5 shrink-0">contractiq.com/</span>
                  <input disabled defaultValue={user?.org?.slug ?? ""} className="w-full bg-transparent px-3 py-2.5 text-zinc-600 outline-none text-sm cursor-not-allowed" />
                </div>
              </div>
            </div>
          </div>

          {/* Change password */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <Lock size={14} className="text-zinc-500" />
              <h3 className="font-semibold text-white text-sm">Change Password</h3>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Field label="Current Password" type="password" value={currentPw} onChange={setCurrentPw} placeholder="••••••••" />
              <Field label="New Password"     type="password" value={newPw}     onChange={setNewPw}     placeholder="Min. 8 characters" />
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex items-center gap-2 border border-[#2a2a2a] hover:border-primary-gold/30 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
                </button>
              </div>
            </form>
            {pwSuccess && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl mt-4">
                <CheckCircle2 size={14} className="shrink-0" /><p className="text-sm">Password updated.</p>
              </div>
            )}
            {pwError && <p className="text-sm text-red-400 mt-4 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-xl">{pwError}</p>}
          </div>
        </div>
      )}

      {/* ── BILLING ── */}
      {tab === "billing" && (
        <div className="space-y-5">
          {/* Current plan card */}
          <div className={`bg-[#111] border rounded-2xl p-6 relative overflow-hidden ${planMeta.border}`}>
            <div className={`absolute top-0 left-8 right-8 h-px bg-linear-to-r from-transparent via-current to-transparent opacity-40 ${planMeta.colour}`} />
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary-gold/3 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <CreditCard size={15} className="text-primary-gold" />
                <h3 className="font-semibold text-white text-sm">Subscription</h3>
              </div>
              {refreshing && <Loader2 className="w-3 h-3 text-zinc-600 animate-spin" />}
            </div>

            <div className="flex items-center gap-3 mb-2">
              <span className={`text-4xl font-black tracking-tight ${planMeta.colour}`}>{planMeta.label}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${planMeta.colour} ${planMeta.bg} ${planMeta.border}`}>Active</span>
            </div>
            <p className="text-xs text-zinc-600 mb-6">{planMeta.description}</p>

            {/* Quota bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="text-zinc-500">Analyses used this month</span>
                <span className={`font-bold tabular-nums ${quotaCritical ? "text-red-400" : quotaWarning ? "text-amber-400" : "text-white"}`}>
                  {isEnterprise ? `${analysisCount} used · unlimited` : `${analysisCount} / ${analysisLimit}`}
                </span>
              </div>
              {!isEnterprise && (
                <>
                  <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${quotaPercent}%`, background: quotaCritical ? "#ef4444" : quotaWarning ? "#f59e0b" : "#6366F1" }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-700 mt-1.5">
                    <span>{quotaPercent}% used</span>
                    <span>{Math.max(0, analysisLimit - analysisCount)} remaining</span>
                  </div>
                </>
              )}
              {isEnterprise && <div className="w-full h-2 bg-linear-to-r from-purple-400/30 to-purple-400/10 rounded-full" />}
              {quotaWarning && !quotaCritical && (
                <div className="flex items-center gap-2 mt-3 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-lg">
                  <AlertTriangle size={12} className="shrink-0" />You've used {quotaPercent}% of your monthly analyses.
                </div>
              )}
              {quotaCritical && (
                <div className="flex items-center gap-2 mt-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">
                  <AlertTriangle size={12} className="shrink-0" />Almost at your limit. Upgrade now to avoid interruption.
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              {!isEnterprise && (
                <Link
                  href="/pricing"
                  className="group relative flex items-center justify-center gap-2 w-full bg-primary-gold hover:bg-[#5254d4] text-black font-bold py-2.5 rounded-xl transition-all text-sm"
                >
                  <Zap className="w-4 h-4 fill-black" />
                  {planKey === "MAX" ? "Manage Plan" : "Upgrade Plan"}
                </Link>
              )}
              {isEnterprise && (
                <a
                  href="mailto:billing@contractiq.com"
                  className="flex items-center justify-center gap-2 w-full border border-[#2a2a2a] hover:border-[#3a3a3a] text-zinc-400 hover:text-white text-sm font-medium py-2.5 rounded-xl transition-all"
                >
                  Contact billing team
                </a>
              )}
            </div>
          </div>

          {/* Plan comparison */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4">All Plans</p>
            <div className="space-y-2">
              {[
                { id: "SOLO",       limit: "25 analyses / mo",  price: "₹2,400/mo" },
                { id: "FIRM",       limit: "100 analyses / mo", price: "₹8,200/mo" },
                { id: "MAX",        limit: "250 analyses / mo", price: "₹20,500/mo" },
                { id: "ENTERPRISE", limit: "Unlimited",         price: "Custom"     },
              ].map(p => {
                const meta      = PLAN_META[p.id];
                const isCurrent = planKey === p.id;
                return (
                  <div key={p.id} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${isCurrent ? `${meta.bg} ${meta.border}` : "border-transparent hover:border-[#222]"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${isCurrent ? meta.colour : "text-zinc-600"}`}>{meta.label}</span>
                      {isCurrent && <span className="text-[9px] font-black uppercase tracking-widest text-green-400">← current</span>}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <span className="text-[11px] text-zinc-600">{p.limit}</span>
                      <span className={`text-xs font-semibold ${isCurrent ? meta.colour : "text-zinc-500"}`}>{p.price}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === "security" && (
        <div className="space-y-3">
          {[
            {
              title:  "Two-factor authentication",
              desc:   "Add an extra layer of security to your account with TOTP.",
              action: "Enable 2FA",
              badge:  "Disabled",
              badgeColour: "text-red-400 bg-red-400/10 border-red-400/20",
              icon:   Lock,
              onClick: () => alert("2FA setup coming soon."),
            },
            {
              title:  "Active sessions",
              desc:   "Review and revoke sessions where you are signed in.",
              action: "View sessions",
              badge:  null,
              badgeColour: "",
              icon:   Monitor,
              onClick: () => alert("Session management coming soon."),
            },
            {
              title:  "API key management",
              desc:   "Create and revoke API keys for programmatic access.",
              action: "Manage keys",
              badge:  null,
              badgeColour: "",
              icon:   Key,
              onClick: () => router.push("/api-keys"),
            },
          ].map((item) => (
            <div key={item.title} className="flex items-center justify-between bg-[#111] border border-[#1e1e1e] rounded-xl px-5 py-4">
              <div className="flex items-start gap-3">
                <item.icon size={15} className="text-zinc-600 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    {item.badge && (
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${item.badgeColour}`}>{item.badge}</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-600">{item.desc}</p>
                </div>
              </div>
              <button
                onClick={item.onClick}
                className="text-xs font-medium text-zinc-500 hover:text-primary-gold transition-colors border border-[#2a2a2a] hover:border-primary-gold/30 px-3 py-1.5 rounded-lg ml-4 shrink-0 cursor-pointer"
              >
                {item.action}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
