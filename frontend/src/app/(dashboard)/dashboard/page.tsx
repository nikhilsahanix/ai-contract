"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  FileUp, FileText, Loader2, Clock, AlertCircle,
  CheckCircle2, ChevronRight, X, Shield, Zap,
  TrendingUp, AlertTriangle, BarChart2, Activity,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contract {
  id:           string;
  originalName: string;
  contractType: string;
  jurisdiction?: string;
  status:       "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  createdAt:    string;
  analyses?:    { status: string; riskLevel?: string; riskScore?: number }[];
}

const CONTRACT_TYPES = [
  { value: "NDA",               label: "NDA"              },
  { value: "SERVICE_AGREEMENT", label: "Service Agreement"},
  { value: "EMPLOYMENT",        label: "Employment"       },
  { value: "SOFTWARE_LICENSE",  label: "Software License" },
  { value: "REAL_ESTATE",       label: "Real Estate"      },
  { value: "PARTNERSHIP",       label: "Partnership"      },
  { value: "UNKNOWN",           label: "Auto-detect"      },
];

const RISK_CONFIG = {
  LOW:      { color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/20",  label: "Low Risk"      },
  MEDIUM:   { color: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/20",  label: "Medium Risk"   },
  HIGH:     { color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", label: "High Risk"     },
  CRITICAL: { color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/20",    label: "Critical Risk" },
};

const STATUS_CONFIG = {
  COMPLETED:  { color: "text-green-400",    label: "Completed",  spin: false },
  PROCESSING: { color: "text-primary-gold", label: "Analyzing…", spin: true  },
  PENDING:    { color: "text-zinc-500",     label: "Queued",     spin: false },
  FAILED:     { color: "text-red-400",      label: "Failed",     spin: false },
};

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (c: Contract) => void }) {
  const [file,         setFile]         = useState<File | null>(null);
  const [contractType, setContractType] = useState("UNKNOWN");
  const [jurisdiction, setJurisdiction] = useState("");
  const [uploading,    setUploading]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [error,        setError]        = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  const validateAndSet = (f: File) => {
    setError("");
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(f.type)) { setError("Only PDF and DOCX files are supported."); return; }
    if (f.size > 50 * 1024 * 1024) { setError("File must be under 50MB."); return; }
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("contractType", contractType);
    if (jurisdiction.trim()) form.append("jurisdiction", jurisdiction.trim());
    try {
      const tick = setInterval(() => setProgress(p => Math.min(p + 8, 85)), 200);
      const res  = await api.post("/contracts/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      clearInterval(tick);
      setProgress(100);
      setTimeout(() => { onSuccess(res.data?.data); onClose(); }, 400);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Upload failed. Please try again.");
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-primary-gold/60 to-transparent" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-gold/10 border border-primary-gold/20 flex items-center justify-center">
              <Shield size={14} className="text-primary-gold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Upload Contract</h2>
              <p className="text-[10px] text-zinc-600">AI analysis starts immediately</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div
            ref={dropRef}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) validateAndSet(f); }}
            onClick={() => !file && document.getElementById("file-input")?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
              ${file ? "border-primary-gold/40 bg-primary-gold/5" : "border-border-mid hover:border-border-mid/70 hover:bg-white/1"}`}
          >
            <input id="file-input" type="file" accept=".pdf,.docx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSet(f); }} />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText size={20} className="text-primary-gold shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white truncate max-w-70">{file.name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setFile(null); setProgress(0); }} className="ml-2 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <FileUp size={24} className="text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-400 font-medium">Drop your contract here</p>
                <p className="text-[10px] text-zinc-600 mt-1">PDF or DOCX · up to 50MB</p>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Contract Type</label>
              <select value={contractType} onChange={e => setContractType(e.target.value)}
                className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-primary-gold/40 transition-colors">
                {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Jurisdiction <span className="text-zinc-700">(optional)</span>
              </label>
              <input value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}
                placeholder="e.g. US-CA, UK, EU"
                className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-primary-gold/40 transition-colors" />
            </div>
          </div>
          {uploading && (
            <div className="space-y-2">
              <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary-gold transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[10px] text-zinc-600 text-center">
                {progress < 90 ? "Uploading and queuing analysis…" : "Almost ready…"}
              </p>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2.5 rounded-lg text-xs">
              <AlertCircle size={12} className="shrink-0" />{error}
            </div>
          )}
          <button onClick={upload} disabled={!file || uploading}
            className="w-full bg-primary-gold hover:bg-gold-hover disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer">
            {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Zap size={14} /> Analyze Contract</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Contract Row ─────────────────────────────────────────────────────────────

function ContractRow({ contract, onClick }: { contract: Contract; onClick: () => void }) {
  const status   = STATUS_CONFIG[contract.status] ?? STATUS_CONFIG.PENDING;
  const analysis = contract.analyses?.[0];
  const risk     = analysis?.riskLevel ? RISK_CONFIG[analysis.riskLevel as keyof typeof RISK_CONFIG] : null;

  return (
    <div onClick={onClick}
      className="group flex items-center gap-4 bg-surface border border-border hover:border-border-mid rounded-xl p-4 transition-all duration-200 cursor-pointer hover:-translate-y-px">
      <div className="w-10 h-10 rounded-xl bg-primary-gold/8 border border-primary-gold/15 flex items-center justify-center shrink-0">
        <FileText size={15} className="text-primary-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{contract.originalName ?? "Untitled"}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-zinc-600">{contract.contractType?.replace(/_/g, " ") ?? "Unknown"}</span>
          {contract.jurisdiction && <><span className="text-zinc-800">·</span><span className="text-[10px] text-zinc-600">{contract.jurisdiction}</span></>}
          <span className="text-zinc-800">·</span>
          <span className="text-[10px] text-zinc-600">
            {new Date(contract.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>
      {risk && (
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${risk.color} ${risk.bg} ${risk.border}`}>
          {risk.label}
        </div>
      )}
      {analysis?.riskScore != null && (
        <div className="hidden md:flex flex-col items-center">
          <span className={`text-lg font-black tabular-nums ${risk?.color ?? "text-zinc-400"}`}>{analysis.riskScore.toFixed(1)}</span>
          <span className="text-[9px] text-zinc-700 uppercase tracking-wider">/ 10</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 shrink-0">
        {status.spin
          ? <Loader2 size={12} className={`${status.color} animate-spin`} />
          : contract.status === "COMPLETED"
            ? <CheckCircle2 size={12} className={status.color} />
            : contract.status === "FAILED"
              ? <AlertCircle size={12} className={status.color} />
              : <Clock size={12} className={status.color} />
        }
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${status.color}`}>{status.label}</span>
      </div>
      <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router   = useRouter();
  const { user } = useAuthStore();

  const [contracts,  setContracts]  = useState<Contract[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [dragging,   setDragging]   = useState(false);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

  const fetchContracts = useCallback(async () => {
    try {
      const res  = await api.get("/contracts");
      const data = res.data?.data?.data ?? res.data?.data ?? [];
      const list = Array.isArray(data) ? data : [];
      setContracts(list);
      const processing = list.filter((c: Contract) => c.status === "PROCESSING" || c.status === "PENDING");
      if (processing.length > 0) setPollingIds(new Set(processing.map((c: Contract) => c.id)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  useEffect(() => {
    if (pollingIds.size === 0) return;
    const interval = setInterval(async () => {
      const updates = await Promise.allSettled(
        Array.from(pollingIds).map(id => api.get(`/contracts/${id}/analysis/status`))
      );
      let anyChange = false;
      const stillPolling = new Set<string>();
      updates.forEach((result, i) => {
        const id = Array.from(pollingIds)[i];
        if (result.status === "fulfilled") {
          if (result.value.data?.data?.isTerminal) anyChange = true;
          else stillPolling.add(id);
        } else { stillPolling.add(id); }
      });
      if (anyChange) { fetchContracts(); setPollingIds(stillPolling); }
      else setPollingIds(stillPolling);
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingIds, fetchContracts]);

  const handleUploadSuccess = (newContract: Contract) => {
    setContracts(prev => [newContract, ...prev]);
    setPollingIds(prev => new Set([...prev, newContract.id]));
  };

  // Derived stats
  const processing   = contracts.filter(c => c.status === "PROCESSING" || c.status === "PENDING");
  const completed    = contracts.filter(c => c.status === "COMPLETED");
  const failed       = contracts.filter(c => c.status === "FAILED");
  const withScore    = completed.filter(c => c.analyses?.[0]?.riskScore != null);
  const avgRisk      = withScore.length
    ? (withScore.reduce((s, c) => s + (c.analyses![0].riskScore ?? 0), 0) / withScore.length).toFixed(1)
    : null;
  const criticalCount = completed.filter(c => c.analyses?.[0]?.riskLevel === "CRITICAL" || c.analyses?.[0]?.riskLevel === "HIGH").length;

  const analysisCount  = user?.org?.analysisCount ?? 0;
  const analysisLimit  = user?.org?.analysisLimit ?? 25;
  const quotaRemaining = Math.max(0, analysisLimit - analysisCount);

  const recentContracts = contracts.slice(0, 5);

  return (
    <div className="space-y-6"
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setShowUpload(true); }}
    >
      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="border-2 border-dashed border-primary-gold rounded-2xl p-16 text-center">
            <FileUp size={40} className="text-primary-gold mx-auto mb-4" />
            <p className="text-white font-bold text-lg">Drop to upload</p>
            <p className="text-zinc-400 text-sm mt-1">PDF or DOCX</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {user?.org?.name ?? "Your workspace"} · {user?.org?.plan?.toLowerCase().replace("_", " ")} plan
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-primary-gold hover:bg-gold-hover text-black px-4 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-primary-gold/15 cursor-pointer"
        >
          <FileUp size={14} /> Upload Contract
        </button>
      </div>

      {/* ── Analytics stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Contracts</span>
            <div className="w-7 h-7 rounded-lg bg-primary-gold/10 flex items-center justify-center">
              <FileText size={12} className="text-primary-gold" />
            </div>
          </div>
          <p className="text-3xl font-black text-white tabular-nums">{loading ? "—" : contracts.length}</p>
          <p className="text-[10px] text-zinc-600 mt-1">
            {completed.length} analyzed · {processing.length} in queue
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Avg. Risk Score</span>
            <div className="w-7 h-7 rounded-lg bg-amber-400/10 flex items-center justify-center">
              <BarChart2 size={12} className="text-amber-400" />
            </div>
          </div>
          <p className={`text-3xl font-black tabular-nums ${avgRisk && parseFloat(avgRisk) >= 7 ? "text-red-400" : avgRisk && parseFloat(avgRisk) >= 4 ? "text-amber-400" : "text-green-400"}`}>
            {loading ? "—" : avgRisk ?? "—"}
          </p>
          <p className="text-[10px] text-zinc-600 mt-1">out of 10 · {withScore.length} scored</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">High Risk</span>
            <div className="w-7 h-7 rounded-lg bg-red-400/10 flex items-center justify-center">
              <AlertTriangle size={12} className="text-red-400" />
            </div>
          </div>
          <p className={`text-3xl font-black tabular-nums ${criticalCount > 0 ? "text-red-400" : "text-zinc-300"}`}>
            {loading ? "—" : criticalCount}
          </p>
          <p className="text-[10px] text-zinc-600 mt-1">critical or high risk flags</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Quota Left</span>
            <div className="w-7 h-7 rounded-lg bg-blue-400/10 flex items-center justify-center">
              <Activity size={12} className="text-blue-400" />
            </div>
          </div>
          <p className={`text-3xl font-black tabular-nums ${quotaRemaining <= 5 ? "text-red-400" : quotaRemaining <= 10 ? "text-amber-400" : "text-blue-400"}`}>
            {(user?.org?.plan as string) === "ENTERPRISE" ? "∞" : quotaRemaining}
          </p>
          <p className="text-[10px] text-zinc-600 mt-1">{analysisCount}/{analysisLimit} used this month</p>
          {/* Mini quota bar */}
          <div className="mt-2 w-full h-1 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (analysisCount / analysisLimit) * 100)}%`,
                background: quotaRemaining <= 5 ? "#ef4444" : quotaRemaining <= 10 ? "#f59e0b" : "#6366F1",
              }} />
          </div>
        </div>
      </div>

      {/* ── Processing banner ── */}
      {processing.length > 0 && (
        <div className="flex items-center gap-3 bg-primary-gold/5 border border-primary-gold/15 px-4 py-3 rounded-xl">
          <Loader2 size={14} className="text-primary-gold animate-spin shrink-0" />
          <p className="text-xs text-zinc-400">
            <span className="text-primary-gold font-semibold">{processing.length} contract{processing.length > 1 ? "s" : ""}</span> being analyzed · auto-refreshing every 3s
          </p>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-4">
          <Loader2 size={24} className="text-zinc-700 animate-spin" />
          <p className="text-xs text-zinc-600">Loading workspace…</p>
        </div>

      ) : contracts.length === 0 ? (
        <div onClick={() => setShowUpload(true)}
          className="relative border-2 border-dashed border-border hover:border-primary-gold/30 rounded-2xl p-16 text-center transition-all cursor-pointer group">
          <div className="flex flex-col items-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl border border-border bg-surface group-hover:border-primary-gold/20 flex items-center justify-center mb-6 transition-all">
              <FileText size={24} className="text-zinc-600 group-hover:text-zinc-500 transition-colors" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No contracts yet</h3>
            <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
              Upload a PDF or DOCX to get an AI-powered risk analysis, clause-by-clause flagging, and a professional redline report.
            </p>
            <div className="flex items-center gap-2 text-xs font-bold text-primary-gold bg-primary-gold/8 border border-primary-gold/20 px-4 py-2 rounded-lg">
              <FileUp size={12} /> Click to upload · or drag & drop
            </div>
            <p className="text-[10px] text-zinc-700 mt-3">PDF, DOCX · Up to 50 MB</p>
          </div>
        </div>

      ) : (
        <div className="space-y-4">
          {/* Recent contracts header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-zinc-600" />
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Recent Contracts</span>
            </div>
            <button onClick={() => router.push("/contracts")} className="text-xs text-primary-gold hover:text-gold-light transition-colors cursor-pointer">
              View all →
            </button>
          </div>

          {/* Processing first */}
          {processing.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest px-1">Analyzing</p>
              {processing.slice(0, 3).map(c => (
                <ContractRow key={c.id} contract={c} onClick={() => router.push(`/contracts/${c.id}`)} />
              ))}
            </div>
          )}

          {/* Recent completed + failed */}
          {recentContracts.filter(c => c.status === "COMPLETED" || c.status === "FAILED").length > 0 && (
            <div className="space-y-2">
              {processing.length > 0 && (
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest px-1 pt-2">Recent</p>
              )}
              {recentContracts
                .filter(c => c.status === "COMPLETED" || c.status === "FAILED")
                .map(c => <ContractRow key={c.id} contract={c} onClick={() => router.push(`/contracts/${c.id}`)} />)}
            </div>
          )}

          {contracts.length > 5 && (
            <button
              onClick={() => router.push("/contracts")}
              className="w-full flex items-center justify-center gap-2 border border-border hover:border-primary-gold/20 text-zinc-500 hover:text-zinc-300 text-xs font-medium py-3 rounded-xl transition-all cursor-pointer"
            >
              View all {contracts.length} contracts <ChevronRight size={12} />
            </button>
          )}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={handleUploadSuccess} />}
    </div>
  );
}
