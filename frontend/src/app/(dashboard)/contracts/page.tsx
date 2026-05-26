"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  FileText, Loader2, Clock, AlertCircle, CheckCircle2,
  ChevronRight, Search, Filter,
} from "lucide-react";

interface Contract {
  id: string;
  originalName: string;
  contractType: string;
  jurisdiction?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  createdAt: string;
  analyses?: { status: string; riskLevel?: string; riskScore?: number }[];
}

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  LOW:      { color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/20",  label: "Low"      },
  MEDIUM:   { color: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/20",  label: "Medium"   },
  HIGH:     { color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", label: "High"     },
  CRITICAL: { color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/20",    label: "Critical" },
};

const STATUS_ICON: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  COMPLETED:  { icon: CheckCircle2, color: "text-green-400",    label: "Completed"  },
  PROCESSING: { icon: Loader2,      color: "text-primary-gold", label: "Analyzingâ€¦" },
  PENDING:    { icon: Clock,        color: "text-zinc-500",     label: "Queued"     },
  FAILED:     { icon: AlertCircle,  color: "text-red-400",      label: "Failed"     },
};

export default function ContractsListPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchContracts = useCallback(async () => {
    try {
      const res = await api.get("/contracts");
      const data = res.data?.data?.data ?? res.data?.data ?? [];
      setContracts(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const filtered = contracts.filter(c => {
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    if (search && !c.originalName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">All Contracts</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{contracts.length} total documents</p>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contractsâ€¦"
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-primary-gold/40 transition-colors"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-surface border border-border rounded-xl pl-9 pr-8 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-primary-gold/40 transition-colors appearance-none cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="PROCESSING">Processing</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={24} className="text-zinc-700 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><p className="text-zinc-500 text-sm">{search || statusFilter !== "ALL" ? "No contracts match your filters." : "No contracts uploaded yet."}</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const st = STATUS_ICON[c.status] ?? STATUS_ICON.PENDING;
            const Icon = st.icon;
            const risk = c.analyses?.[0]?.riskLevel ? RISK_CONFIG[c.analyses[0].riskLevel] : null;
            return (
              <div key={c.id} onClick={() => router.push(`/contracts/${c.id}`)} className="group flex items-center gap-4 bg-surface border border-border hover:border-border rounded-xl p-4 transition-all cursor-pointer hover:-translate-y-px">
                <div className="w-10 h-10 rounded-xl bg-primary-gold/8 border border-primary-gold/15 flex items-center justify-center shrink-0"><FileText size={15} className="text-primary-gold" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.originalName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-600">{c.contractType?.replace(/_/g, " ")}</span>
                    <span className="text-zinc-800">Â·</span>
                    <span className="text-[10px] text-zinc-600">{new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                </div>
                {risk && <span className={`hidden sm:inline text-[10px] font-bold px-2.5 py-1 rounded-lg border ${risk.color} ${risk.bg} ${risk.border}`}>{risk.label}</span>}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Icon size={12} className={`${st.color} ${c.status === "PROCESSING" ? "animate-spin" : ""}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${st.color}`}>{st.label}</span>
                </div>
                <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
