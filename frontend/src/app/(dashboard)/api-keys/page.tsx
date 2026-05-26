"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Key, Plus, Trash2, Copy, Check, Loader2, Eye, EyeOff, X,
  AlertTriangle, Shield, Clock,
} from "lucide-react";

interface ApiKey {
  id:         string;
  name:       string;
  keyPrefix:  string;
  isActive:   boolean;
  lastUsedAt: string | null;
  expiresAt:  string | null;
}

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (raw: string) => void }) {
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const submit = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/api-keys", { name: name.trim() });
      onCreated(res.data?.data?.rawKey ?? res.data?.data?.key ?? "");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to create key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-primary-gold/60 to-transparent" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-gold/10 border border-primary-gold/20 flex items-center justify-center">
              <Key size={14} className="text-primary-gold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Create API Key</h2>
              <p className="text-[10px] text-zinc-600">Key shown only once â€” save it now</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Key Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="e.g. Production webhook, CI pipeline"
              className="w-full bg-bg-dark border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-primary-gold/40 transition-colors"
            />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">Cancel</button>
            <button
              onClick={submit}
              disabled={loading}
              className="flex items-center gap-2 bg-primary-gold hover:bg-gold-hover disabled:opacity-50 text-black font-bold px-4 py-2 rounded-xl transition-all text-sm cursor-pointer"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevealModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied,  setCopied]  = useState(false);
  const [visible, setVisible] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-surface border border-primary-gold/30 rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-primary-gold/60 to-transparent" />
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Save your API key</h2>
              <p className="text-[11px] text-zinc-500">It will not be shown again after you close this</p>
            </div>
          </div>
          <div className="bg-bg-dark border border-border-mid rounded-xl p-4 font-mono text-sm text-zinc-300 break-all flex items-center gap-3">
            <span className="flex-1">{visible ? rawKey : rawKey.replace(/./g, "â€¢")}</span>
            <button onClick={() => setVisible(v => !v)} className="text-zinc-600 hover:text-zinc-400 shrink-0 cursor-pointer">
              {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            onClick={copy}
            className="w-full flex items-center justify-center gap-2 bg-primary-gold hover:bg-gold-hover text-black font-bold py-2.5 rounded-xl transition-all text-sm cursor-pointer"
          >
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy to clipboard</>}
          </button>
          <button
            onClick={onClose}
            className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1 cursor-pointer"
          >
            I've saved the key â€” close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  const [keys,       setKeys]       = useState<ApiKey[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [rawKey,     setRawKey]     = useState<string | null>(null);
  const [revoking,   setRevoking]   = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await api.get("/api-keys");
      setKeys(res.data?.data ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreated = (key: string) => {
    setShowCreate(false);
    setRawKey(key);
    fetchKeys();
  };

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await api.delete(`/api-keys/${id}`);
      setKeys(prev => prev.filter(k => k.id !== id));
    } catch { /* silent */ } finally { setRevoking(null); }
  };

  return (
    <div className="max-w-3xl pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">API Keys</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Keys for authenticating programmatic API access</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary-gold hover:bg-gold-hover text-black px-4 py-2.5 rounded-xl font-bold transition-all text-sm cursor-pointer"
        >
          <Plus size={14} /> New Key
        </button>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 bg-primary-gold/5 border border-primary-gold/15 px-4 py-3 rounded-xl mb-6">
        <Shield size={14} className="text-primary-gold mt-0.5 shrink-0" />
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          API keys grant full access to your org's data. Treat them like passwords â€” never commit them to version control or share in plaintext.
          Keys are shown only once at creation.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 size={20} className="text-zinc-700 animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
          <Key size={28} className="text-zinc-700 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-white mb-1">No API keys yet</h3>
          <p className="text-xs text-zinc-600 mb-4">Create a key to access ContractIQ programmatically</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 text-xs font-bold text-primary-gold bg-primary-gold/8 border border-primary-gold/20 px-4 py-2 rounded-lg cursor-pointer"
          >
            <Plus size={12} /> Create first key
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(key => (
            <div key={key.id} className="flex items-center gap-4 bg-surface border border-border rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-primary-gold/8 border border-primary-gold/15 flex items-center justify-center shrink-0">
                <Key size={14} className="text-primary-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{key.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="font-mono text-[10px] text-zinc-600">{key.keyPrefix}â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢</span>
                  {key.lastUsedAt ? (
                    <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                      <Clock size={9} /> Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-700">Never used</span>
                  )}
                  {key.expiresAt && (
                    <span className="text-[10px] text-amber-500">
                      Expires {new Date(key.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${key.isActive ? "text-green-400 bg-green-400/10 border-green-400/20" : "text-zinc-600 bg-zinc-800/30 border-zinc-700/20"}`}>
                {key.isActive ? "Active" : "Revoked"}
              </div>
              {key.isActive && (
                <button
                  onClick={() => revoke(key.id)}
                  disabled={revoking === key.id}
                  className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  {revoking === key.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateKeyModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {rawKey && <RevealModal rawKey={rawKey} onClose={() => setRawKey(null)} />}
    </div>
  );
}
