"use client";

import { useAuthStore } from "@/store/authStore";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard, FileText, Settings, LogOut, Zap, ChevronRight,
  Users, Key, Webhook, History, Bell,
} from "lucide-react";
import Link from "next/link";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/contracts",  icon: FileText,        label: "Contracts"  },
  { href: "/team",       icon: Users,           label: "Team"       },
  { href: "/api-keys",   icon: Key,             label: "API Keys"   },
  { href: "/webhooks",   icon: Webhook,         label: "Webhooks"   },
  { href: "/audit-log",  icon: History,         label: "Audit Log"  },
  { href: "/settings",   icon: Settings,        label: "Settings"   },
];

const MOCK_NOTIFS = [
  { id: 1, text: "Contract analysis complete",  sub: "NDA_v3.pdf — 2 critical risks",       time: "2m ago",  read: false },
  { id: 2, text: "Team member joined",          sub: "alex@firm.com accepted invite",        time: "1h ago",  read: false },
  { id: 3, text: "Webhook delivery failed",     sub: "3 retries exhausted for endpoint",     time: "3h ago",  read: true  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs]       = useState(MOCK_NOTIFS);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const analysisCount = user?.org?.analysisCount ?? 0;
  const analysisLimit = user?.org?.analysisLimit ?? 25;
  const quotaPercent  = Math.min(Math.round((analysisCount / analysisLimit) * 100), 100);
  const quotaCritical = quotaPercent > 80;
  const unreadCount   = notifs.filter(n => !n.read).length;

  return (
    <div className="flex h-screen bg-bg-dark text-zinc-300 overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className="relative w-60 flex flex-col border-r border-border/60 bg-surface/50 backdrop-blur-sm shrink-0">
        <div className="absolute top-0 right-0 left-0 h-px bg-linear-to-r from-transparent via-primary-gold/20 to-transparent" />

        {/* Logo */}
        <div className="px-5 py-5 border-b border-border/40">
          <Link href="/" className="font-display text-xl font-semibold italic text-primary-gold hover:text-gold-light transition-colors">
            ContractIQ
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 mt-1 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href + "/"));
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative cursor-pointer ${
                  active
                    ? "bg-primary-gold/10 text-primary-gold nav-item-active"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/4"
                }`}
              >
                {active && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary-gold rounded-l-full" />
                )}
                <Icon
                  size={16}
                  className={active ? "text-primary-gold" : "text-zinc-500 group-hover:text-zinc-300 transition-colors"}
                />
                {label}
                {active && <ChevronRight size={12} className="ml-auto text-primary-gold/50" />}
              </Link>
            );
          })}
        </nav>

        {/* Usage quota */}
        <div className="mx-3 mb-3 p-3 bg-card-dark border border-border rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Monthly usage</span>
            <span className={`text-[10px] font-bold ${quotaCritical ? "text-red-400" : "text-zinc-400"}`}>
              {analysisCount}/{analysisLimit}
            </span>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${quotaPercent}%`, background: quotaCritical ? "#ef4444" : "#6366F1" }}
            />
          </div>
          {quotaCritical && (
            <Link href="/pricing" className="flex items-center gap-1 mt-2 text-[10px] text-primary-gold hover:text-gold-light transition-colors">
              <Zap size={10} className="fill-current" /> Upgrade plan
            </Link>
          )}
        </div>

        {/* User + Logout */}
        <div className="p-3 border-t border-border/40">
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary-gold/15 border border-primary-gold/30 flex items-center justify-center text-primary-gold text-xs font-bold shrink-0">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate">{user?.email}</p>
              <p className="text-[10px] text-zinc-600 capitalize">{user?.role?.toLowerCase()}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="flex items-center gap-2.5 px-3 py-2 w-full text-left text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-all duration-200 text-xs font-medium cursor-pointer"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border/40 flex items-center justify-between px-8 bg-surface/30 backdrop-blur-sm shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">{user?.org?.name || "My Organization"}</h2>
            <p className="text-[10px] text-zinc-600 capitalize">{user?.org?.plan?.toLowerCase().replace("_", " ")} plan</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="relative p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all duration-200 cursor-pointer"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-gold rounded-full notification-ping" />
                )}
              </button>

              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white">Notifications</span>
                    <button
                      onClick={() => setNotifs(n => n.map(x => ({ ...x, read: true })))}
                      className="text-[10px] text-primary-gold hover:text-gold-light transition-colors cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-1">
                    {notifs.map(n => (
                      <div
                        key={n.id}
                        className={`flex gap-3 p-2.5 rounded-xl transition-colors ${n.read ? "opacity-50" : "bg-white/3 hover:bg-white/5"}`}
                      >
                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-primary-gold"}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-200 truncate">{n.text}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{n.sub}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/pricing"
              className="text-[11px] text-primary-gold hover:text-gold-light transition-colors font-medium border border-primary-gold/20 hover:border-primary-gold/40 px-3 py-1.5 rounded-lg"
            >
              <Zap size={10} className="inline mr-1 fill-current" />Upgrade
            </Link>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
