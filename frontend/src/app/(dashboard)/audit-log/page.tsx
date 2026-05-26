"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { History, Loader2, Search, RefreshCw, Shield, User, LogIn, Key, FileText } from "lucide-react";

interface AuditEntry {
  id:        string;
  action:    string;
  userId:    string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; icon: typeof LogIn; color: string }> = {
  "user.login":          { label: "Sign in",             icon: LogIn,    color: "text-green-400"       },
  "user.login.failed":   { label: "Failed sign in",      icon: LogIn,    color: "text-red-400"         },
  "user.logout":         { label: "Sign out",            icon: User,     color: "text-zinc-400"        },
  "user.register":       { label: "Account created",     icon: User,     color: "text-blue-400"        },
  "contract.upload":     { label: "Contract uploaded",   icon: FileText, color: "text-primary-gold"    },
  "contract.delete":     { label: "Contract deleted",    icon: FileText, color: "text-red-400"         },
  "analysis.completed":  { label: "Analysis complete",   icon: Shield,   color: "text-green-400"       },
  "analysis.failed":     { label: "Analysis failed",     icon: Shield,   color: "text-red-400"         },
  "apikey.created":      { label: "API key created",     icon: Key,      color: "text-primary-gold"    },
  "apikey.revoked":      { label: "API key revoked",     icon: Key,      color: "text-amber-400"       },
};

export default function AuditLogPage() {
  const [logs,    setLogs]    = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/audit-logs");
      setLogs(res.data?.data ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter(l =>
    !query ||
    l.action.includes(query.toLowerCase()) ||
    (l.ipAddress ?? "").includes(query) ||
    (l.userId ?? "").includes(query.toLowerCase())
  );

  return (
    <div className="max-w-5xl pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Audit Log</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Security and access events for your organization</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 text-zinc-400 hover:text-white border border-border hover:border-border-mid px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by action, IP addressâ€¦"
          className="w-full bg-bg-dark border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-primary-gold/40 transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40"><Loader2 size={20} className="text-zinc-700 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <History size={28} className="text-zinc-700 mx-auto mb-4" />
          <p className="text-sm text-zinc-500">{query ? "No matching events." : "No audit events recorded yet."}</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-border bg-bg-dark">
            <span className="col-span-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Event</span>
            <span className="col-span-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">User</span>
            <span className="col-span-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">IP</span>
            <span className="col-span-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Time</span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map(log => {
              const meta = ACTION_META[log.action] ?? { label: log.action, icon: History, color: "text-zinc-400" };
              const Icon = meta.icon;
              return (
                <div key={log.id} className="grid grid-cols-12 gap-4 px-5 py-3.5 hover:bg-white/1.5 transition-colors">
                  <div className="col-span-4 flex items-center gap-2.5">
                    <Icon size={13} className={`shrink-0 ${meta.color}`} />
                    <span className="text-xs font-medium text-zinc-300">{meta.label}</span>
                  </div>
                  <div className="col-span-3 text-xs text-zinc-500 font-mono truncate self-center">
                    {log.userId ? log.userId.slice(0, 8) + "â€¦" : "â€”"}
                  </div>
                  <div className="col-span-2 text-xs text-zinc-600 font-mono self-center">
                    {log.ipAddress ?? "â€”"}
                  </div>
                  <div className="col-span-3 text-[11px] text-zinc-600 self-center">
                    {new Date(log.createdAt).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
