import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Bot, LineChart, ShieldCheck, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nebula Trade — AI-Powered Crypto Trading" },
      {
        name: "description",
        content:
          "AI signals, live Binance charts, paper trading, and risk-managed strategy execution in a premium neon cockpit.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg" aria-hidden />
      <div className="pointer-events-none absolute inset-0 scanline opacity-40" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent neon-border" />
          <span className="font-display text-xl font-bold tracking-wide">NEBULA</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 neon-border"
          >
            Launch console
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 text-center md:pt-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse-glow" />
            AI-driven signals · Live Binance feed · Paper trading
          </div>
          <h1 className="font-display text-5xl font-bold leading-[1.05] md:text-7xl">
            Trade crypto at the
            <br />
            <span className="neon-text">speed of intelligence</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            A premium cockpit for spotting alpha. Real-time candles, RSI, MACD and EMA-driven signals,
            with confidence scoring and clear reasoning behind every move.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              to="/signup"
              className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 neon-border"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="rounded-md glass px-6 py-3 text-sm font-semibold transition hover:border-primary"
            >
              I have an account
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 pb-24 md:grid-cols-3">
          {[
            {
              icon: Bot,
              title: "AI Signal Engine",
              text: "Buy/Sell/Hold signals with confidence scores and human-readable reasoning across RSI, MACD, EMA.",
            },
            {
              icon: LineChart,
              title: "Live Market Charts",
              text: "Sub-second WebSocket updates from Binance for BTC, ETH, SOL, BNB and more.",
            },
            {
              icon: Activity,
              title: "Paper Trading",
              text: "Simulate strategies with a virtual portfolio. Track PnL, win rate and drawdown.",
            },
            {
              icon: ShieldCheck,
              title: "Risk Controls",
              text: "Configure max risk per trade, stop-loss, take-profit and position sizing.",
            },
            {
              icon: Zap,
              title: "Realtime Alerts",
              text: "Get notified the moment confidence crosses your threshold.",
            },
            {
              icon: Sparkles,
              title: "Premium UX",
              text: "Glassmorphism cockpit, smooth motion, zero jank during live updates.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-6 transition hover:border-primary/60"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 ring-1 ring-primary/30">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/40 px-6 py-6 text-center text-xs text-muted-foreground">
        Nebula Trade · Built for traders who like their dashboards loud.
      </footer>
    </div>
  );
}
