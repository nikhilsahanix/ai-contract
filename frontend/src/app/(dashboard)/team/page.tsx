"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Users, UserPlus, Loader2, X, AlertCircle, Mail,
  ShieldCheck, Eye, User as UserIcon,
} from "lucide-react";

interface Member {
  id:            string;
  email:         string;
  role:          "ADMIN" | "ATTORNEY" | "VIEWER";
  emailVerified: boolean;
  createdAt:     string;
}

const ROLE_META = {
  ADMIN:    { label: "Admin",    color: "text-primary-gold bg-primary-gold/10 border-primary-gold/20", icon: ShieldCheck },
  ATTORNEY: { label: "Attorney", color: "text-blue-400 bg-blue-400/10 border-blue-400/20",            icon: UserIcon    },
  VIEWER:   { label: "Viewer",   color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",            icon: Eye         },
};

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email,   setEmail]   = useState("");
  const [role,    setRole]    = useState<"ATTORNEY" | "VIEWER">("ATTORNEY");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  const submit = async () => {
    if (!email.trim()) { setError("Email is required."); return; }
    setLoading(true);
    setError("");
    try {
      await api.post("/invitations", { email: email.trim(), role });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to send invitation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#111] border border-[#222] rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-primary-gold/60 to-transparent" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-gold/10 border border-primary-gold/20 flex items-center justify-center">
              <UserPlus size={14} className="text-primary-gold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Invite Team Member</h2>
              <p className="text-[10px] text-zinc-600">They'll receive an email to join your workspace</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto mb-3">
                <Mail size={20} className="text-green-400" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">Invitation sent!</p>
              <p className="text-xs text-zinc-500">{email} will receive an email shortly.</p>
              <button onClick={onClose} className="mt-4 text-xs text-primary-gold hover:text-gold-light transition-colors cursor-pointer">Close</button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="colleague@lawfirm.com"
                  className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-primary-gold/40 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["ATTORNEY", "VIEWER"] as const).map(r => {
                    const meta = ROLE_META[r];
                    return (
                      <button
                        key={r}
                        onClick={() => setRole(r)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${role === r ? "border-primary-gold/30 bg-primary-gold/5" : "border-[#222] hover:border-[#333]"}`}
                      >
                        <meta.icon size={13} className={role === r ? "text-primary-gold" : "text-zinc-600"} />
                        <div>
                          <p className={`text-xs font-semibold ${role === r ? "text-white" : "text-zinc-400"}`}>{meta.label}</p>
                          <p className="text-[10px] text-zinc-700">
                            {r === "ATTORNEY" ? "Can upload & analyze" : "View only"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">
                  <AlertCircle size={12} />{error}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">Cancel</button>
                <button
                  onClick={submit}
                  disabled={loading}
                  className="flex items-center gap-2 bg-primary-gold hover:bg-[#5254d4] disabled:opacity-50 text-black font-bold px-4 py-2 rounded-xl transition-all text-sm cursor-pointer"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Send invite
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuthStore();
  const [members,    setMembers]    = useState<Member[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    api.get("/members")
      .then(res => setMembers(res.data?.data ?? []))
      .catch(() => {/* admin-only or no route yet */})
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="max-w-3xl pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Team</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{user?.org?.name ?? "Your workspace"} · {members.length || "—"} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-primary-gold hover:bg-[#5254d4] text-black px-4 py-2.5 rounded-xl font-bold transition-all text-sm cursor-pointer"
          >
            <UserPlus size={14} /> Invite Member
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40"><Loader2 size={20} className="text-zinc-700 animate-spin" /></div>
      ) : members.length === 0 ? (
        <div className="border-2 border-dashed border-[#222] rounded-2xl p-12 text-center">
          <Users size={28} className="text-zinc-700 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-white mb-1">Just you so far</h3>
          <p className="text-xs text-zinc-600 mb-4">Invite colleagues to collaborate on contract reviews</p>
          {isAdmin && (
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 text-xs font-bold text-primary-gold bg-primary-gold/8 border border-primary-gold/20 px-4 py-2 rounded-lg cursor-pointer"
            >
              <UserPlus size={12} /> Invite first member
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(member => {
            const meta = ROLE_META[member.role] ?? ROLE_META.VIEWER;
            const isSelf = member.id === user?.id;
            return (
              <div key={member.id} className="flex items-center gap-4 bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
                <div className="w-9 h-9 rounded-full bg-primary-gold/10 border border-primary-gold/20 flex items-center justify-center text-primary-gold text-sm font-bold shrink-0">
                  {member.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{member.email}</p>
                    {isSelf && <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">you</span>}
                    {!member.emailVerified && (
                      <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">unverified</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    Joined {new Date(member.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${meta.color}`}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
