import Link from "next/link";
import { ShieldCheck, Zap, FileSearch, ArrowRight, CheckCircle } from "lucide-react";
import ScrollReveal from "@/components/ui/ScrollReveal";

const STATS = [
  { value: "4.2h", label: "saved per contract" },
  { value: "60s",  label: "analysis time" },
  { value: "98%",  label: "clause accuracy" },
  { value: "1,200+", label: "attorneys trust us" },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Cryptographic Isolation",
    desc: "Enterprise Row-Level Security. Your firm's documents are completely isolated — impossible to cross-contaminate.",
    tag: "Security",
  },
  {
    icon: FileSearch,
    title: "AI Redline Generation",
    desc: "Flags risky clauses and drafts replacement text, formatted as a professional PDF ready to send to opposing counsel.",
    tag: "Core Feature",
  },
  {
    icon: Zap,
    title: "White-Label API",
    desc: "Embed our analysis engine into your client portal in under a day. Clean JSON output, webhooks, HMAC-signed.",
    tag: "For Platforms",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Upload",   desc: "Drop any PDF or DOCX — up to 200 pages. We accept all standard contract formats." },
  { step: "02", title: "Analyze",  desc: "Our AI reads every clause, scores risk, detects missing protections, compares to market standards." },
  { step: "03", title: "Review",   desc: "Structured report with flagged clauses, severity levels, plain-English explanations, and citations." },
  { step: "04", title: "Redline",  desc: "One-click redline PDF export with suggested edits tracked. Send directly to opposing counsel." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-dark text-zinc-300 flex flex-col overflow-x-hidden">

      {/* ─── NOISE TEXTURE ─── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="bg-noise w-full h-full" />
      </div>

      {/* ─── HERO BACKGROUND ─── */}
      <div className="fixed inset-0 pointer-events-none z-0 hero-mesh bg-grid" />

      {/* ─── NAV ─── */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-5 max-w-7xl w-full mx-auto border-b border-border/60">
        <div className="font-display text-2xl font-semibold tracking-wide text-primary-gold italic">
          ContractIQ
        </div>
        <div className="flex items-center gap-8 text-sm font-medium">
          <Link href="/pricing" className="text-zinc-400 hover:text-white transition-colors duration-200 hidden md:block">Pricing</Link>
          <Link href="#how" className="text-zinc-400 hover:text-white transition-colors duration-200 hidden md:block">How it works</Link>
          <Link href="/login" className="text-zinc-400 hover:text-white transition-colors duration-200">Sign in</Link>
          <Link
            href="/register"
            className="relative group bg-primary-gold hover:bg-gold-light text-black px-5 py-2.5 rounded-lg font-bold transition-all duration-200 text-sm overflow-hidden"
          >
            {/* shimmer sweep on hover */}
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none overflow-hidden rounded-lg">
              <span className="absolute top-0 bottom-0 w-1/3 bg-white/20 skew-x-[-20deg] translate-x-[-200%] group-hover:translate-x-[400%] transition-transform duration-500 ease-in-out" />
            </span>
            Start Free Trial
          </Link>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <main className="relative z-10 flex-1">
        <section className="flex flex-col items-center justify-center text-center px-4 pt-28 pb-20 max-w-5xl mx-auto">

          {/* Live badge */}
          <div className="anim-fade-down delay-0 inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-card-dark border border-border-gold/50 text-xs font-semibold tracking-widest text-primary-gold mb-10 uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-gold opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-gold" />
            </span>
            Powered by Claude Sonnet — Anthropic
          </div>

          {/* Headline */}
          <h1 className="anim-fade-up delay-100 font-display text-5xl md:text-7xl lg:text-8xl font-semibold text-white tracking-tight leading-[1.05] mb-6">
            AI Contract Review<br />
            <span className="text-shimmer">Built for Lawyers.</span>
          </h1>

          {/* Sub */}
          <p className="anim-fade-up delay-200 text-lg md:text-xl text-zinc-400 max-w-2xl mb-10 leading-relaxed font-light">
            Upload any contract. Instantly surface critical risks, missing clauses, and generate
            professional PDF redlines. Secure, multi-tenant, and private by design.
          </p>

          {/* CTAs */}
          <div className="anim-fade-up delay-300 flex flex-col sm:flex-row items-center gap-4 mb-6">
            <Link
              href="/register"
              className="group flex items-center gap-2 bg-primary-gold hover:bg-gold-light text-black font-bold px-8 py-4 rounded-xl transition-all duration-200 text-base shadow-lg shadow-primary-gold/15 anim-glow"
            >
              Start 14-Day Free Trial
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#how" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors flex items-center gap-2">
              See how it works →
            </Link>
          </div>

          <p className="anim-fade-up delay-400 text-xs text-zinc-600 tracking-widest uppercase">
            No credit card · 14-day trial · Cancel anytime
          </p>

          {/* Stats row */}
          <div className="anim-fade-up delay-500 mt-20 w-full grid grid-cols-2 md:grid-cols-4 gap-px bg-border/60 rounded-2xl overflow-hidden border border-border/40">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col items-center py-6 px-4 bg-surface/80 backdrop-blur-sm hover:bg-card-dark transition-colors duration-300">
                <div className="font-display text-3xl font-semibold text-primary-gold mb-1">{s.value}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section className="relative px-6 py-24 max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <p className="text-xs text-primary-gold uppercase tracking-[0.2em] font-semibold mb-3">Capabilities</p>
            <h2 className="font-display text-4xl md:text-5xl text-white font-medium">
              Every risk, surfaced <span className="italic text-primary-gold">automatically</span>
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 100}>
                <div className="card-spotlight group relative bg-card-dark border border-border hover:border-border-mid rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 h-full">
                  {/* top accent line */}
                  <div className="absolute top-0 left-6 right-6 h-px bg-linear-to-r from-transparent via-primary-gold/30 to-transparent" />

                  <div className="relative z-10">
                    <span className="inline-block text-[10px] uppercase tracking-widest text-primary-gold/60 border border-primary-gold/20 px-2.5 py-1 rounded-full mb-5">
                      {f.tag}
                    </span>
                    <f.icon className="w-8 h-8 text-primary-gold mb-4 group-hover:scale-110 transition-transform duration-300" />
                    <h3 className="font-display text-xl font-semibold text-white mb-3">{f.title}</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section id="how" className="relative px-6 py-24 border-t border-border/40">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal className="text-center mb-16">
              <p className="text-xs text-primary-gold uppercase tracking-[0.2em] font-semibold mb-3">Process</p>
              <h2 className="font-display text-4xl md:text-5xl text-white font-medium">
                Upload to redline in <span className="italic text-primary-gold">60 seconds</span>
              </h2>
            </ScrollReveal>

            <div className="space-y-0">
              {HOW_IT_WORKS.map((step, i) => (
                <ScrollReveal key={step.step} delay={i * 80}>
                  <div className="group flex gap-8 py-8 border-b border-border/30 last:border-0 hover:bg-surface/40 px-4 rounded-xl transition-colors duration-300 -mx-4">
                    <div className="font-display text-5xl font-light text-primary-gold/20 group-hover:text-primary-gold/40 transition-colors duration-300 leading-none w-16 shrink-0 mt-1">
                      {step.step}
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-white mb-2 group-hover:text-primary-gold transition-colors duration-300">{step.title}</h3>
                      <p className="text-zinc-400 text-sm leading-relaxed max-w-lg">{step.desc}</p>
                    </div>
                    <div className="ml-auto hidden md:flex items-center text-zinc-700 group-hover:text-primary-gold/50 transition-colors duration-300">
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="relative px-6 py-32 text-center overflow-hidden">
          {/* Glow radial */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-96 h-96 bg-primary-gold/5 rounded-full blur-3xl" />
          </div>
          <ScrollReveal>
            <div className="relative max-w-2xl mx-auto">
              <h2 className="font-display text-5xl md:text-6xl font-medium text-white mb-6 leading-tight">
                Stop billing hours for what<br />takes{" "}
                <em className="italic text-shimmer">seconds.</em>
              </h2>
              <p className="text-zinc-400 mb-10">Join 1,200+ attorneys who review contracts in under a minute.</p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-primary-gold hover:bg-gold-light text-black font-bold px-10 py-4 rounded-xl transition-all duration-200 text-base shadow-xl shadow-primary-gold/20"
              >
                Start your free trial <ArrowRight size={16} />
              </Link>
              <p className="text-zinc-600 text-xs mt-4">14 days free · No credit card · Cancel anytime</p>
            </div>
          </ScrollReveal>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 border-t border-border/40 py-8 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-display text-lg italic text-primary-gold/60">ContractIQ</div>
          <div className="flex items-center gap-8 text-xs text-zinc-600">
            <Link href="#" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-zinc-400 transition-colors">Terms</Link>
            <Link href="#" className="hover:text-zinc-400 transition-colors">Security</Link>
            <Link href="#" className="hover:text-zinc-400 transition-colors">API Docs</Link>
          </div>
          <p className="text-xs text-zinc-700">© {new Date().getFullYear()} ContractIQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
