import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  fetchKlines, fetchTickers, formatUsd, subscribeKline, subscribeTickers, SYMBOLS, type Kline, type Ticker,
} from "@/lib/binance";
import { computeSignal, type AiSignal } from "@/lib/ai-signals";
import { Bot, TrendingUp, TrendingDown, Minus } from "lucide-react";

export const Route = createFileRoute("/ai-insights")({
  head: () => ({ meta: [{ title: "AI Insights — Nebula Trade" }] }),
  component: AiInsightsPage,
});

interface SymbolInsight {
  symbol: string;
  short: string;
  name: string;
  ai: AiSignal | null;
  ticker?: Ticker;
}

function AiInsightsPage() {
  const [insights, setInsights] = useState<Record<string, SymbolInsight>>(() =>
    Object.fromEntries(SYMBOLS.map((s) => [s.symbol, { symbol: s.symbol, short: s.short, name: s.name, ai: null }])),
  );

  // Initial klines + signals
  useEffect(() => {
    let mounted = true;
    Promise.all(
      SYMBOLS.map(async (s) => {
        try {
          const k = await fetchKlines(s.symbol, "1h", 120);
          return { symbol: s.symbol, ai: computeSignal(k), klines: k };
        } catch {
          return { symbol: s.symbol, ai: null, klines: [] as Kline[] };
        }
      }),
    ).then((results) => {
      if (!mounted) return;
      setInsights((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          if (next[r.symbol]) next[r.symbol] = { ...next[r.symbol], ai: r.ai };
        });
        return next;
      });
    });
    return () => { mounted = false; };
  }, []);

  // Tickers
  useEffect(() => {
    fetchTickers(SYMBOLS.map((s) => s.symbol)).then((list) => {
      setInsights((prev) => {
        const next = { ...prev };
        list.forEach((t) => { if (next[t.symbol]) next[t.symbol] = { ...next[t.symbol], ticker: t }; });
        return next;
      });
    }).catch(() => { /* noop */ });
    const unsub = subscribeTickers(SYMBOLS.map((s) => s.symbol), (t) => {
      setInsights((prev) => prev[t.symbol] ? { ...prev, [t.symbol]: { ...prev[t.symbol], ticker: t } } : prev);
    });
    return unsub;
  }, []);

  // Keep signals fresh by listening to 1h klines
  useEffect(() => {
    const unsubs = SYMBOLS.map((s) => {
      const klines: Kline[] = [];
      // Seed with REST snapshot (best-effort)
      fetchKlines(s.symbol, "1h", 120).then((k) => { klines.push(...k); }).catch(() => {});
      return subscribeKline(s.symbol, "1h", (k) => {
        if (klines.length === 0) { klines.push(k); return; }
        const last = klines[klines.length - 1];
        if (last.time === k.time) klines[klines.length - 1] = k;
        else { klines.push(k); if (klines.length > 200) klines.shift(); }
        if (klines.length >= 50) {
          const ai = computeSignal(klines);
          setInsights((prev) => prev[s.symbol] ? { ...prev, [s.symbol]: { ...prev[s.symbol], ai } } : prev);
        }
      });
    });
    return () => unsubs.forEach((u) => u());
  }, []);

  const sorted = Object.values(insights).sort((a, b) => (b.ai?.confidence ?? 0) - (a.ai?.confidence ?? 0));

  return (
    <AppShell title="AI Insights" subtitle="Multi-asset technical analysis · EMA · RSI · MACD">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((it) => <InsightCard key={it.symbol} insight={it} />)}
      </div>
    </AppShell>
  );
}

function InsightCard({ insight }: { insight: SymbolInsight }) {
  const ai = insight.ai;
  const tone = ai?.signal === "BUY" ? "success" : ai?.signal === "SELL" ? "destructive" : "primary";
  const Icon = ai?.signal === "BUY" ? TrendingUp : ai?.signal === "SELL" ? TrendingDown : Minus;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-lg font-bold">{insight.short}</div>
          <div className="text-xs text-muted-foreground">{insight.name}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm">{insight.ticker ? `$${formatUsd(insight.ticker.price)}` : "—"}</div>
          <div className={`text-xs ${(insight.ticker?.changePct ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
            {insight.ticker ? `${insight.ticker.changePct.toFixed(2)}%` : ""}
          </div>
        </div>
      </div>

      {!ai ? (
        <div className="mt-4 flex h-24 items-center justify-center text-xs text-muted-foreground">
          <Bot className="mr-2 h-4 w-4 animate-pulse-glow" /> Computing…
        </div>
      ) : (
        <>
          <div className={`mt-4 flex items-center justify-between rounded-xl p-3 ring-1 ${
            tone === "success" ? "bg-success/10 ring-success/30" :
            tone === "destructive" ? "bg-destructive/10 ring-destructive/30" :
            "bg-primary/10 ring-primary/30"
          }`}>
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary"}`} />
              <span className={`font-display text-xl font-bold ${
                tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary"
              }`}>{ai.signal}</span>
            </div>
            <span className="text-xs text-muted-foreground">{(ai.confidence * 100).toFixed(0)}% conf.</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Stat label="RSI" value={ai.rsi.toFixed(1)} />
            <Stat label="MACD" value={ai.macd.toFixed(3)} />
            <Stat label="EMA20" value={`$${formatUsd(ai.ema20, 0)}`} />
            <Stat label="EMA50" value={`$${formatUsd(ai.ema50, 0)}`} />
          </div>

          <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            {ai.reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="flex gap-2"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />{r}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/40 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
