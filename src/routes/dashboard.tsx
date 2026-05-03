import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  fetchKlines,
  fetchTickers,
  formatUsd,
  subscribeKline,
  subscribeTickers,
  SYMBOLS,
  type Kline,
  type Ticker,
} from "@/lib/binance";
import { computeSignal, type AiSignal } from "@/lib/ai-signals";
import { toast } from "sonner";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  LayoutDashboard,
  LineChart as LineIcon,
  LogOut,
  Settings as SettingsIcon,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Nebula Trade" }] }),
  component: DashboardPage,
});

const INTERVALS = ["5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];

function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [activeSymbol, setActiveSymbol] = useState<string>("BTCUSDT");
  const [interval, setInterval] = useState<Interval>("15m");
  const [klines, setKlines] = useState<Kline[]>([]);

  // Initial tickers + WS subscription
  useEffect(() => {
    let mounted = true;
    fetchTickers(SYMBOLS.map((s) => s.symbol)).then((list) => {
      if (!mounted) return;
      const map: Record<string, Ticker> = {};
      list.forEach((t) => (map[t.symbol] = t));
      setTickers(map);
    }).catch(() => { /* offline */ });
    const unsub = subscribeTickers(
      SYMBOLS.map((s) => s.symbol),
      (t) => setTickers((prev) => ({ ...prev, [t.symbol]: t })),
    );
    return () => { mounted = false; unsub(); };
  }, []);

  // Klines + WS for active symbol/interval
  useEffect(() => {
    let mounted = true;
    fetchKlines(activeSymbol, interval, 120).then((k) => {
      if (mounted) setKlines(k);
    }).catch(() => { /* offline */ });
    const unsub = subscribeKline(activeSymbol, interval, (k) => {
      setKlines((prev) => {
        if (prev.length === 0) return [k];
        const last = prev[prev.length - 1];
        if (last.time === k.time) return [...prev.slice(0, -1), k];
        return [...prev.slice(-119), k];
      });
    });
    return () => { mounted = false; unsub(); };
  }, [activeSymbol, interval]);

  const ai = useMemo<AiSignal | null>(() => (klines.length >= 50 ? computeSignal(klines) : null), [klines]);

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

      <Sidebar onSignOut={async () => { await signOut(); toast.success("Signed out"); navigate({ to: "/" }); }} />

      <main className="relative ml-0 flex-1 px-4 py-6 md:ml-60 md:px-8">
        <Header email={user.email ?? ""} />

        <PortfolioStats tickers={tickers} ai={ai} />

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <ChartCard
            symbol={activeSymbol}
            ticker={tickers[activeSymbol]}
            klines={klines}
            interval={interval}
            onIntervalChange={setInterval}
          />
          <AiPanel ai={ai} symbol={activeSymbol} ticker={tickers[activeSymbol]} />
        </div>

        <Watchlist tickers={tickers} active={activeSymbol} onSelect={setActiveSymbol} />
      </main>
    </div>
  );
}

function Sidebar({ onSignOut }: { onSignOut: () => void }) {
  const items = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" as const, active: true },
    { icon: LineIcon, label: "Trade", to: "/trade" as const },
    { icon: Bot, label: "AI Insights", to: "/ai-insights" as const },
    { icon: Wallet, label: "Portfolio", to: "/portfolio" as const },
    { icon: SettingsIcon, label: "Settings", to: "/settings" as const },
  ];
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border/40 glass-strong px-4 py-6 md:flex">
      <Link to="/" className="mb-8 flex items-center gap-2 px-2">
        <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent neon-border" />
        <span className="font-display text-lg font-bold tracking-wide">NEBULA</span>
      </Link>
      <nav className="flex-1 space-y-1">
        {items.map((it) => (
          <Link
            key={it.label}
            to={it.to}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              it.active
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            }`}
          >
            <it.icon className="h-4 w-4" />
            {it.label}
          </Link>
        ))}
      </nav>
      <button
        onClick={onSignOut}
        className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}

function Header({ email }: { email: string }) {
  return (
    <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-3xl font-bold">Trading Console</h1>
        <p className="text-sm text-muted-foreground">Live Binance feed · AI signals · Paper trading</p>
      </div>
      <div className="flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs">
        <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
        <span className="text-muted-foreground">Live · {email}</span>
      </div>
    </div>
  );
}

function PortfolioStats({ tickers, ai }: { tickers: Record<string, Ticker>; ai: AiSignal | null }) {
  const btc = tickers["BTCUSDT"];
  const eth = tickers["ETHUSDT"];
  // Simulated paper portfolio
  const balance = 25_000;
  const pnlPct = btc?.changePct ?? 0;
  const pnl = (balance * pnlPct) / 100;

  const stats = [
    { label: "Paper Balance", value: `$${formatUsd(balance)}`, sub: "Virtual portfolio", icon: Wallet, tone: "primary" as const },
    {
      label: "24h PnL",
      value: `${pnl >= 0 ? "+" : ""}$${formatUsd(pnl)}`,
      sub: `${pnlPct.toFixed(2)}%`,
      icon: TrendingUp,
      tone: pnl >= 0 ? ("success" as const) : ("destructive" as const),
    },
    {
      label: "BTC",
      value: btc ? `$${formatUsd(btc.price)}` : "—",
      sub: btc ? `${btc.changePct.toFixed(2)}%` : "loading",
      icon: Activity,
      tone: (btc?.changePct ?? 0) >= 0 ? ("success" as const) : ("destructive" as const),
    },
    {
      label: "AI Signal",
      value: ai?.signal ?? "…",
      sub: ai ? `${(ai.confidence * 100).toFixed(0)}% confidence` : "computing",
      icon: Bot,
      tone: ai?.signal === "BUY" ? ("success" as const) : ai?.signal === "SELL" ? ("destructive" as const) : ("primary" as const),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
            <s.icon className={`h-4 w-4 ${
              s.tone === "success" ? "text-success" :
              s.tone === "destructive" ? "text-destructive" : "text-primary"
            }`} />
          </div>
          <div className={`mt-3 font-display text-2xl font-bold ${
            s.tone === "success" ? "text-success" :
            s.tone === "destructive" ? "text-destructive" : ""
          }`}>
            {s.value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

function ChartCard({
  symbol, ticker, klines, interval, onIntervalChange,
}: {
  symbol: string;
  ticker?: Ticker;
  klines: Kline[];
  interval: Interval;
  onIntervalChange: (i: Interval) => void;
}) {
  const data = useMemo(() => klines.map((k) => ({
    time: new Date(k.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    price: k.close,
  })), [klines]);

  const isUp = (ticker?.changePct ?? 0) >= 0;
  const gradId = useRef(`grad-${Math.random().toString(36).slice(2)}`).current;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-xl font-bold">{symbol.replace("USDT", "/USDT")}</h2>
            {ticker && (
              <span className={`flex items-center gap-1 text-xs font-medium ${isUp ? "text-success" : "text-destructive"}`}>
                {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {ticker.changePct.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-3xl font-bold neon-text">
            {ticker ? `$${formatUsd(ticker.price)}` : "—"}
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg glass p-1">
          {INTERVALS.map((i) => (
            <button
              key={i}
              onClick={() => onIntervalChange(i)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                interval === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? "oklch(0.78 0.2 155)" : "oklch(0.65 0.26 22)"} stopOpacity={0.5} />
                <stop offset="100%" stopColor={isUp ? "oklch(0.78 0.2 155)" : "oklch(0.65 0.26 22)"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="oklch(0.4 0.05 280 / 0.2)" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="oklch(0.6 0.04 260)" fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
            <YAxis
              stroke="oklch(0.6 0.04 260)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) => `$${formatUsd(v, 0)}`}
              width={70}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.18 0.03 275 / 0.95)",
                border: "1px solid oklch(0.4 0.05 280 / 0.4)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "oklch(0.7 0.04 260)" }}
              formatter={(v: number) => [`$${formatUsd(v)}`, "Price"]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isUp ? "oklch(0.78 0.2 155)" : "oklch(0.65 0.26 22)"}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AiPanel({ ai, symbol, ticker }: { ai: AiSignal | null; symbol: string; ticker?: Ticker }) {
  const tone =
    ai?.signal === "BUY" ? "success" : ai?.signal === "SELL" ? "destructive" : "primary";

  const handleTrade = (side: "BUY" | "SELL") => {
    if (!ticker) return;
    toast.success(`Paper ${side} placed on ${symbol} @ $${formatUsd(ticker.price)}`);
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary animate-pulse-glow" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider">AI Signal Engine</h3>
      </div>

      {!ai ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Computing signal…
        </div>
      ) : (
        <>
          <div className={`rounded-xl p-4 ring-1 ${
            tone === "success" ? "bg-success/10 ring-success/30" :
            tone === "destructive" ? "bg-destructive/10 ring-destructive/30" :
            "bg-primary/10 ring-primary/30"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Recommendation</span>
              <span className="text-xs text-muted-foreground">{(ai.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className={`font-display text-3xl font-bold ${
              tone === "success" ? "text-success" :
              tone === "destructive" ? "text-destructive" : "text-primary"
            }`}>
              {ai.signal}
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${
                  tone === "success" ? "bg-success" :
                  tone === "destructive" ? "bg-destructive" : "bg-primary"
                }`}
                style={{ width: `${ai.confidence * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-4 space-y-2 text-xs">
            <Stat label="RSI" value={ai.rsi.toFixed(1)} />
            <Stat label="MACD" value={ai.macd.toFixed(4)} />
            <Stat label="EMA20" value={`$${formatUsd(ai.ema20)}`} />
            <Stat label="EMA50" value={`$${formatUsd(ai.ema50)}`} />
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reasoning</div>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {ai.reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={() => handleTrade("BUY")}
              className="rounded-md bg-success py-2 text-sm font-semibold text-success-foreground transition hover:opacity-90"
            >
              Paper Buy
            </button>
            <button
              onClick={() => handleTrade("SELL")}
              className="rounded-md bg-destructive py-2 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
            >
              Paper Sell
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Watchlist({
  tickers, active, onSelect,
}: {
  tickers: Record<string, Ticker>;
  active: string;
  onSelect: (s: string) => void;
}) {
  return (
    <div className="mt-6 glass rounded-2xl p-5">
      <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wider">Markets</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {SYMBOLS.map((s) => {
          const t = tickers[s.symbol];
          const isUp = (t?.changePct ?? 0) >= 0;
          const isActive = active === s.symbol;
          return (
            <button
              key={s.symbol}
              onClick={() => onSelect(s.symbol)}
              className={`rounded-xl p-3 text-left transition ${
                isActive
                  ? "bg-primary/10 ring-1 ring-primary/40 neon-border"
                  : "bg-card/40 ring-1 ring-border/40 hover:ring-primary/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold">{s.short}</span>
                <span className={`text-xs ${isUp ? "text-success" : "text-destructive"}`}>
                  {t ? `${t.changePct.toFixed(2)}%` : "—"}
                </span>
              </div>
              <div className="mt-1.5 font-mono text-sm">
                {t ? `$${formatUsd(t.price)}` : "—"}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
