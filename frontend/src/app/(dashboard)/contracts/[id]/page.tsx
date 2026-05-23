"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  ArrowLeft, Download, Loader2, AlertCircle, CheckCircle2,
  Clock, Shield, AlertTriangle, ChevronDown, ChevronUp,
  FileText, TrendingUp, XCircle, Sparkles, Flag, Scale,
  Trash2
} from "lucide-react";

interface FlagItem { id: string; severity: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"; clauseRef: string; title: string; issue: string; marketStandard: string; recommendation: string; suggestedText?: string|null; affectedParty: "CLIENT"|"COUNTERPARTY"|"BOTH"; }
interface MissingClause { clauseType: string; importance: "RECOMMENDED"|"CRITICAL"; whyItMatters: string; suggestedText: string; }
interface Positive { clauseRef: string; title: string; why: string; }
interface Analysis { id: string; status: string; riskScore: number|null; riskLevel: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"|null; executiveSummary: string|null; executiveTakeaway: string|null; favoursParty: string|null; flags: FlagItem[]; missingClauses: MissingClause[]; positives: Positive[]; negotiationPriority: string[]; jurisdictionNotes: string[]; hasRedline: boolean; model?: string; processingMs: number|null; errorMessage: string|null; retryCount: number; extractionMeta?: { method: string; confidence: number; pageCount: number; warnings: string[]; }; }
interface ContractDetail { id: string; name: string; type: string; jurisdiction?: string; status: string; pageCount?: number; uploadedAt: string; }

const RISK_COLORS = {
  LOW:      { text: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/25" },
  MEDIUM:   { text: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/25" },
  HIGH:     { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/25" },
  CRITICAL: { text: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/25" },
};
const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function RiskMeter({ score, level }: { score: number; level: keyof typeof RISK_COLORS }) {
  const cfg = RISK_COLORS[level];
  const angle = (score / 10) * 180;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-20 overflow-hidden">
        <svg viewBox="0 0 120 60" className="w-full">
          <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#1a1a1a" strokeWidth="8" strokeLinecap="round" />
          <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray="157" strokeDashoffset={157 - (score / 10) * 157} className={cfg.text} style={{ transition: "stroke-dashoffset 1s ease" }} />
          <line x1="60" y1="60" x2={60 + 38 * Math.cos((180 - angle) * Math.PI / 180)} y2={60 - 38 * Math.sin((180 - angle) * Math.PI / 180)} stroke="#888" strokeWidth="1.5" strokeLinecap="round" style={{ transition: "all 1s ease" }} />
          <circle cx="60" cy="60" r="3" fill="#888" />
        </svg>
      </div>
      <p className={`text-4xl font-black tabular-nums -mt-2 ${cfg.text}`}>{score.toFixed(1)}</p>
      <p className="text-xs text-zinc-600 mt-0.5">out of 10</p>
      <div className={`mt-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${cfg.text} ${cfg.bg} ${cfg.border}`}>{level} RISK</div>
    </div>
  );
}

function FlagCard({ flag }: { flag: FlagItem }) {
  const [open, setOpen] = useState(flag.severity === "CRITICAL" || flag.severity === "HIGH");
  const SEV = { CRITICAL: { color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/25", dot: "bg-red-400" }, HIGH: { color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/25", dot: "bg-orange-400" }, MEDIUM: { color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/25", dot: "bg-amber-400" }, LOW: { color: "text-zinc-400", bg: "bg-zinc-400/5", border: "border-zinc-400/15", dot: "bg-zinc-500" } };
  const cfg = SEV[flag.severity];
  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${cfg.border}`}>
      <button onClick={() => setOpen(x => !x)} className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/1 transition-colors">
        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${cfg.color} ${cfg.bg} ${cfg.border}`}>{flag.severity}</span>
            <span className="text-[10px] text-zinc-600 font-mono">{flag.clauseRef}</span>
          </div>
          <p className="text-sm font-semibold text-white mt-1">{flag.title}</p>
          {!open && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{flag.issue}</p>}
        </div>
        {open ? <ChevronUp size={14} className="text-zinc-600 shrink-0 mt-0.5" /> : <ChevronDown size={14} className="text-zinc-600 shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          <div className="pt-3"><p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Issue</p><p className="text-sm text-zinc-300 leading-relaxed">{flag.issue}</p></div>
          <div className="bg-[#0d0d0d] border border-border rounded-lg p-3"><p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Market Standard</p><p className="text-xs text-zinc-400 leading-relaxed">{flag.marketStandard}</p></div>
          <div><p className="text-[10px] font-bold text-primary-gold uppercase tracking-widest mb-1">Recommendation</p><p className="text-sm text-zinc-300 leading-relaxed">{flag.recommendation}</p></div>
          {flag.suggestedText && (<div className="bg-primary-gold/5 border border-primary-gold/15 rounded-lg p-3"><p className="text-[10px] font-bold text-primary-gold uppercase tracking-widest mb-2">Suggested Language</p><p className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">{flag.suggestedText}</p></div>)}
          <div className="flex items-center gap-1.5"><p className="text-[10px] text-zinc-700">Affects:</p><span className="text-[10px] font-semibold text-zinc-500">{flag.affectedParty}</span></div>
        </div>
      )}
    </div>
  );
}

function MissingClauseCard({ clause }: { clause: MissingClause }) {
  const [open, setOpen] = useState(clause.importance === "CRITICAL");
  const isCritical = clause.importance === "CRITICAL";
  return (
    <div className={`border rounded-xl overflow-hidden ${isCritical ? "border-red-400/20" : "border-[#222]"}`}>
      <button onClick={() => setOpen(x => !x)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/1 transition-colors">
        <XCircle size={14} className={isCritical ? "text-red-400 shrink-0" : "text-zinc-600 shrink-0"} />
        <div className="flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-white">{clause.clauseType}</p><span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isCritical ? "text-red-400 bg-red-400/10 border-red-400/25" : "text-zinc-500 bg-zinc-500/10 border-zinc-500/20"}`}>{clause.importance}</span></div></div>
        {open ? <ChevronUp size={14} className="text-zinc-600" /> : <ChevronDown size={14} className="text-zinc-600" />}
      </button>
      {open && (<div className="px-4 pb-4 space-y-3 border-t border-border"><div className="pt-3"><p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Why It Matters</p><p className="text-sm text-zinc-300 leading-relaxed">{clause.whyItMatters}</p></div>{clause.suggestedText && (<div className="bg-[#0d0d0d] border border-border rounded-lg p-3"><p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Suggested Clause</p><p className="text-xs text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap">{clause.suggestedText}</p></div>)}</div>)}
    </div>
  );
}

function ProcessingState({ contractName }: { contractName: string }) {
  const steps = ["Extracting text", "Detecting contract type", "Running AI analysis", "Generating report"];
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep(s => (s + 1) % steps.length), 3000); return () => clearInterval(t); }, []);
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-2 border-primary-gold/20" />
        <div className="absolute inset-0 rounded-full border-2 border-primary-gold/60 border-t-transparent animate-spin" />
        <div className="absolute inset-3 rounded-full bg-primary-gold/10 flex items-center justify-center"><Shield size={16} className="text-primary-gold" /></div>
      </div>
      <div className="text-center"><p className="text-white font-bold text-lg">Analyzing Contract</p><p className="text-zinc-500 text-sm mt-1 truncate max-w-xs">{contractName}</p></div>
      <div className="flex flex-col gap-2 w-64">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${i < step ? "bg-primary-gold border-primary-gold" : i === step ? "border-primary-gold animate-pulse" : "border-[#333]"}`}>{i < step && <CheckCircle2 size={10} className="text-black" />}</div>
            <span className={`text-xs transition-colors ${i === step ? "text-white" : i < step ? "text-zinc-500" : "text-zinc-700"}`}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ContractDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [activeTab, setActiveTab] = useState<"flags"|"missing"|"positives"|"priority">("flags");
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(`/contracts/${id}/analysis`);
      const d = res.data?.data;
      setContract(d?.contract ?? null);
      setAnalysis(d?.analysis ?? null);
      const isTerminal = d?.analysis?.status === "COMPLETED" || d?.analysis?.status === "FAILED";
      setPolling(!isTerminal && !!d?.contract);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to load contract.");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (!polling) return; const interval = setInterval(fetchData, 3000); return () => clearInterval(interval); }, [polling, fetchData]);

  const downloadRedline = async () => {
    setDownloading(true);
    try { const res = await api.get(`/contracts/${id}/redline`); const url = res.data?.data?.url; if (url) window.open(url, "_blank"); }
    catch { alert("Redline not available yet."); }
    finally { setDownloading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this contract? This will permanently remove the file from our servers and cannot be undone.")) {
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/contracts/${id}`);
      router.push("/dashboard");
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to delete contract.");
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="text-zinc-700 animate-spin" /></div>;
  if (error) return (<div className="flex flex-col items-center justify-center h-64 gap-4"><AlertCircle size={32} className="text-red-400" /><p className="text-zinc-400 text-sm">{error}</p><button onClick={() => router.back()} className="text-xs text-zinc-600 hover:text-zinc-400 underline">Go back</button></div>);

  // Reusable Top Navigation Bar
  const TopNav = () => (
    <div className="flex items-center justify-between mb-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 text-sm transition-colors">
        <ArrowLeft size={14} /> Back to contracts
      </button>
      <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 text-red-500/70 hover:text-red-400 text-sm transition-colors disabled:opacity-50">
        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        Delete
      </button>
    </div>
  );

  if (!analysis || analysis.status === "PROCESSING" || analysis.status === "QUEUED") {
    return (
      <div>
        <TopNav />
        <ProcessingState contractName={contract?.name ?? "Contract"} />
      </div>
    );
  }

  if (analysis.status === "FAILED") {
    return (
      <div>
        <TopNav />
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-full bg-red-400/10 border border-red-400/20 flex items-center justify-center">
            <AlertCircle size={24} className="text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">Analysis Failed</p>
            <p className="text-zinc-500 text-sm mt-2 max-w-sm">{analysis.errorMessage ?? "The analysis could not be completed. Please try uploading again."}</p>
            {analysis.retryCount > 0 && <p className="text-zinc-700 text-xs mt-2">{analysis.retryCount} retries attempted</p>}
          </div>
          <button onClick={() => router.push("/dashboard")} className="text-sm text-primary-gold hover:text-[#a68626] underline transition-colors">
            Upload a new contract
          </button>
        </div>
      </div>
    );
  }

  const riskCfg = analysis.riskLevel ? RISK_COLORS[analysis.riskLevel] : RISK_COLORS.MEDIUM;
  const criticalFlags = analysis.flags.filter(f => f.severity === "CRITICAL").length;
  const highFlags = analysis.flags.filter(f => f.severity === "HIGH").length;
  const sortedFlags = [...analysis.flags].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const TABS = [
    { id: "flags" as const, label: "Issues", count: analysis.flags.length, icon: Flag },
    { id: "missing" as const, label: "Missing Clauses", count: analysis.missingClauses.length, icon: XCircle },
    { id: "positives" as const, label: "Positives", count: analysis.positives.length, icon: Sparkles },
    { id: "priority" as const, label: "Priorities", count: analysis.negotiationPriority.length, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 pb-12">
      <TopNav />

      {/* Header card */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary-gold/10 border border-primary-gold/20 flex items-center justify-center shrink-0"><FileText size={13} className="text-primary-gold" /></div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-zinc-600 bg-border border border-[#222] px-2 py-0.5 rounded">{contract?.type?.replace(/_/g, " ")}</span>
                {contract?.jurisdiction && <span className="text-[10px] text-zinc-600 bg-border border border-[#222] px-2 py-0.5 rounded">{contract.jurisdiction}</span>}
                {contract?.pageCount && <span className="text-[10px] text-zinc-600">{contract.pageCount} pages</span>}
              </div>
            </div>
            <h1 className="text-xl font-bold text-white mb-3 truncate">{contract?.name}</h1>
            {analysis.executiveTakeaway && (
              <div className="bg-[#0d0d0d] border border-border rounded-xl p-4 mb-4">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Executive Summary</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{analysis.executiveSummary}</p>
                <div className="mt-3 pt-3 border-t border-border"><p className="text-xs text-zinc-500 italic">&ldquo;{analysis.executiveTakeaway}&rdquo;</p></div>
              </div>
            )}
            {analysis.favoursParty && (
              <div className="flex items-center gap-2"><Scale size={12} className="text-zinc-600" /><span className="text-[10px] text-zinc-600">Contract balance:</span><span className={`text-[10px] font-bold ${analysis.favoursParty === "BALANCED" ? "text-green-400" : analysis.favoursParty === "HEAVILY_PRO_VENDOR" ? "text-red-400" : analysis.favoursParty === "HEAVILY_PRO_CLIENT" ? "text-blue-400" : "text-amber-400"}`}>{analysis.favoursParty.replace(/_/g, " ")}</span></div>
            )}
          </div>
          <div className="flex flex-col items-center gap-4">
            {analysis.riskScore != null && analysis.riskLevel && <RiskMeter score={analysis.riskScore} level={analysis.riskLevel} />}
            <div className="flex gap-3">
              {criticalFlags > 0 && <div className="text-center"><p className="text-2xl font-black text-red-400">{criticalFlags}</p><p className="text-[9px] text-zinc-700 uppercase tracking-widest">Critical</p></div>}
              {highFlags > 0 && <div className="text-center"><p className="text-2xl font-black text-orange-400">{highFlags}</p><p className="text-[9px] text-zinc-700 uppercase tracking-widest">High</p></div>}
              <div className="text-center"><p className="text-2xl font-black text-zinc-400">{analysis.flags.length}</p><p className="text-[9px] text-zinc-700 uppercase tracking-widest">Total</p></div>
            </div>
            {analysis.hasRedline && (
              <button onClick={downloadRedline} disabled={downloading} className="flex items-center gap-2 bg-primary-gold hover:bg-[#a68626] text-black font-bold px-4 py-2 rounded-lg text-xs transition-all disabled:opacity-50">
                {downloading ? <><Loader2 size={12} className="animate-spin" /> Generating…</> : <><Download size={12} /> Download Redline</>}
              </button>
            )}
          </div>
        </div>
        {analysis.extractionMeta?.warnings && analysis.extractionMeta.warnings.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">{analysis.extractionMeta.warnings.map((w, i) => (<div key={i} className="flex items-start gap-2 text-xs text-amber-400/80"><AlertTriangle size={12} className="shrink-0 mt-0.5" />{w}</div>))}</div>
        )}
      </div>

      {/* Negotiation priorities */}
      {analysis.negotiationPriority.length > 0 && (
        <div className="bg-[#111] border border-primary-gold/15 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4"><TrendingUp size={14} className="text-primary-gold" /><h2 className="text-sm font-bold text-white">Top Negotiation Priorities</h2></div>
          <div className="space-y-2">{analysis.negotiationPriority.map((item, i) => (<div key={i} className="flex items-start gap-3"><span className="text-primary-gold font-black text-sm shrink-0 w-4">{i + 1}.</span><p className="text-sm text-zinc-300">{item}</p></div>))}</div>
        </div>
      )}

      {/* Jurisdiction notes */}
      {analysis.jurisdictionNotes.length > 0 && (
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 space-y-1.5">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Shield size={10} /> Jurisdiction Notes</p>
          {analysis.jurisdictionNotes.map((note, i) => (<p key={i} className="text-xs text-blue-300/70 leading-relaxed">{note}</p>))}
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex gap-1 bg-[#0d0d0d] border border-border rounded-xl p-1 mb-4 overflow-x-auto">
          {TABS.map(tab => { const Icon = tab.icon; return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-1 justify-center ${activeTab === tab.id ? "bg-border text-white border border-[#2a2a2a]" : "text-zinc-600 hover:text-zinc-400"}`}>
              <Icon size={11} />{tab.label}{tab.count > 0 && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-primary-gold/20 text-primary-gold" : "bg-border text-zinc-600"}`}>{tab.count}</span>}
            </button>
          ); })}
        </div>
        <div className="space-y-3">
          {activeTab === "flags" && (sortedFlags.length === 0 ? <p className="text-center text-zinc-600 text-sm py-8">No issues flagged — contract looks clean.</p> : sortedFlags.map(flag => <FlagCard key={flag.id} flag={flag} />))}
          {activeTab === "missing" && (analysis.missingClauses.length === 0 ? <p className="text-center text-zinc-600 text-sm py-8">No missing clauses detected.</p> : analysis.missingClauses.map((c, i) => <MissingClauseCard key={i} clause={c} />))}
          {activeTab === "positives" && (analysis.positives.length === 0 ? <p className="text-center text-zinc-600 text-sm py-8">No positive provisions noted.</p> : analysis.positives.map((p, i) => (
            <div key={i} className="border border-green-400/15 rounded-xl p-4 bg-green-400/5"><div className="flex items-start gap-3"><CheckCircle2 size={14} className="text-green-400 shrink-0 mt-0.5" /><div><div className="flex items-center gap-2 mb-1"><p className="text-sm font-semibold text-white">{p.title}</p><span className="text-[10px] text-zinc-600 font-mono">{p.clauseRef}</span></div><p className="text-xs text-zinc-400 leading-relaxed">{p.why}</p></div></div></div>
          )))}
          {activeTab === "priority" && (
            <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 space-y-4"><p className="text-xs text-zinc-600">Ordered by importance — start negotiations here.</p>{analysis.negotiationPriority.map((item, i) => (<div key={i} className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0"><div className="w-8 h-8 rounded-full bg-primary-gold/10 border border-primary-gold/20 flex items-center justify-center shrink-0 text-primary-gold font-black text-sm">{i + 1}</div><p className="text-sm text-zinc-300 leading-relaxed pt-1">{item}</p></div>))}</div>
          )}
        </div>
      </div>

      {/* Footer meta */}
      <div className="flex items-center justify-between text-[10px] text-zinc-700 pt-4 border-t border-border">
        <span>Analyzed by {analysis.model ?? "Claude"}</span>
        {analysis.processingMs && <span>Processing time: {(analysis.processingMs / 1000).toFixed(1)}s</span>}
        {analysis.extractionMeta && <span>Extraction: {analysis.extractionMeta.method} · {Math.round(analysis.extractionMeta.confidence * 100)}% confidence</span>}
      </div>
    </div>
  );
}