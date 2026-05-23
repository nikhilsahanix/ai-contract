"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Webhook, Plus, Trash2, Loader2, X, Check, AlertCircle, Zap, Globe,
} from "lucide-react";

interface OrgWebhook {
  id:        string;
  url:       string;
  events:    string[];
  isActive?: boolean;
  createdAt: string;
}

const EVENT_OPTIONS = [
  { value: "analysis.completed", label: "Analysis Completed", desc: "Fires when contract analysis finishes successfully" },
  { value: "analysis.failed",    label: "Analysis Failed",    desc: "Fires when contract analysis encounters an error" },
];

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [url,     setUrl]     = useState("");
  const [secret,  setSecret]  = useState("");
  const [events,  setEvents]  = useState<string[]>(["analysis.completed"]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const toggleEvent = (v: string) =>
    setEvents(prev => prev.includes(v) ? prev.filter(e => e !== v) : [...prev, v]);

  const submit = async () => {
    if (!url.trim())    { setError("URL is required.");    return; }
    if (!secret.trim()) { setError("Secret is required."); return; }
    if (events.length === 0) { setError("Select at least one event."); return; }
    setLoading(true);
    setError("");
    try {
      await api.post("/webhooks", { url: url.trim(), secret: secret.trim(), events });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to create webhook.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#111] border border-[#222] rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-primary-gold/60 to-transparent" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-gold/10 border border-primary-gold/20 flex items-center justify-center">
              <Webhook size={14} className="text-primary-gold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">New Webhook</h2>
              <p className="text-[10px] text-zinc-600">Receive real-time events via HTTPS POST</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Endpoint URL</label>
            <input
              autoFocus
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://yourserver.com/webhooks/contractiq"
              className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-primary-gold/40 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
              Signing Secret <span className="text-zinc-700 normal-case font-normal">(min. 16 chars)</span>
            </label>
            <input
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Your shared secret for HMAC verification"
              className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-primary-gold/40 transition-colors"
            />
            <p className="text-[10px] text-zinc-700 mt-1">Payloads are signed with HMAC-SHA256 via <code className="text-zinc-600">X-ContractIQ-Signature</code></p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Events</label>
            <div className="space-y-2">
              {EVENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleEvent(opt.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${events.includes(opt.value) ? "border-primary-gold/30 bg-primary-gold/5" : "border-[#222] hover:border-[#333]"}`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${events.includes(opt.value) ? "bg-primary-gold border-primary-gold" : "border-[#444]"}`}>
                    {events.includes(opt.value) && <Check size={10} className="text-black" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{opt.label}</p>
                    <p className="text-[10px] text-zinc-600">{opt.desc}</p>
                  </div>
                </button>
              ))}
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
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create webhook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  const [webhooks,   setWebhooks]   = useState<OrgWebhook[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);

  const fetchWebhooks = async () => {
    try {
      const res = await api.get("/webhooks");
      setWebhooks(res.data?.data ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchWebhooks(); }, []);

  const handleCreated = () => {
    setShowCreate(false);
    fetchWebhooks();
  };

  const deleteWebhook = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/webhooks/${id}`);
      setWebhooks(prev => prev.filter(w => w.id !== id));
    } catch { /* silent */ } finally { setDeleting(null); }
  };

  return (
    <div className="max-w-3xl pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Webhooks</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Receive signed HTTPS events when contracts are analyzed</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary-gold hover:bg-[#5254d4] text-black px-4 py-2.5 rounded-xl font-bold transition-all text-sm cursor-pointer"
        >
          <Plus size={14} /> Add Endpoint
        </button>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { icon: Zap,    label: "Real-time",  desc: "Events sent within seconds of completion"          },
          { icon: Globe,  label: "HTTPS POST", desc: "Standard JSON payload with event metadata"         },
          { icon: Check,  label: "HMAC-signed",desc: "Verify authenticity with X-ContractIQ-Signature"   },
        ].map(item => (
          <div key={item.label} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
            <item.icon size={14} className="text-primary-gold mb-2" />
            <p className="text-xs font-semibold text-white">{item.label}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40"><Loader2 size={20} className="text-zinc-700 animate-spin" /></div>
      ) : webhooks.length === 0 ? (
        <div className="border-2 border-dashed border-[#222] rounded-2xl p-12 text-center">
          <Webhook size={28} className="text-zinc-700 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-white mb-1">No webhooks configured</h3>
          <p className="text-xs text-zinc-600 mb-4">Add an endpoint to receive real-time analysis events</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 text-xs font-bold text-primary-gold bg-primary-gold/8 border border-primary-gold/20 px-4 py-2 rounded-lg cursor-pointer"
          >
            <Plus size={12} /> Add first endpoint
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map(wh => (
            <div key={wh.id} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-primary-gold/8 border border-primary-gold/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Webhook size={14} className="text-primary-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white font-mono truncate">{wh.url}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {wh.events.map(ev => (
                      <span key={ev} className="text-[9px] font-bold uppercase tracking-wider text-primary-gold bg-primary-gold/8 border border-primary-gold/15 px-2 py-0.5 rounded-full">
                        {ev}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-700 mt-1.5">
                    Created {new Date(wh.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <button
                  onClick={() => deleteWebhook(wh.id)}
                  disabled={deleting === wh.id}
                  className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {deleting === wh.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
    </div>
  );
}
