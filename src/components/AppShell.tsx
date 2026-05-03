import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Bot,
  LayoutDashboard,
  LineChart as LineIcon,
  LogOut,
  Settings as SettingsIcon,
  Wallet,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/trade", icon: LineIcon, label: "Trade" },
  { to: "/ai-insights", icon: Bot, label: "AI Insights" },
  { to: "/portfolio", icon: Wallet, label: "Portfolio" },
  { to: "/settings", icon: SettingsIcon, label: "Settings" },
] as const;

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-pulse-glow rounded-full bg-primary/40" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen">
      <div className="pointer-events-none fixed inset-0 grid-bg" aria-hidden />

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border/40 glass-strong px-4 py-6 md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent neon-border" />
          <span className="font-display text-lg font-bold tracking-wide">NEBULA</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map((it) => {
            const active = path === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => { await signOut(); toast.success("Signed out"); navigate({ to: "/" }); }}
          className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      <main className="relative ml-0 flex-1 px-4 py-6 md:ml-60 md:px-8">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
            <span className="text-muted-foreground">Live · {user.email}</span>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg glass p-1 md:hidden">
          {NAV.map((it) => {
            const active = path === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <it.icon className="h-3.5 w-3.5" />
                {it.label}
              </Link>
            );
          })}
        </div>

        {children}
      </main>
    </div>
  );
}
