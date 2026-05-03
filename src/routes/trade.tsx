import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
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
import {
  placeOrder,
  cancelOrder,
  usePaperState,
  tickPrice,
  portfolioValue,
} from "@/lib/paper-trading";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Bot, Sparkles } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/trade")({
  head: () => ({ meta: [{ title: "Trade — Nebula Trade" }] }),
  component: TradePage,
});

const INTERVALS = ["5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];

function TradePage() {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState<Interval>("15m");
  const [klines, setKlines] = useState<Kline[]>([]);
  const paper = usePaperState();

  useEffect(() => {
    fetchTickers(SYMBOLS.map((s) => s.symbol)).then((list) => {
      const map: Record<string, Ticker> = {};
      list.forEach((t) => (map[t.symbol] = t));
      setTickers(map);
    }).catch(() => { /* noop */ });
    const unsub = subscribeTickers(SYMBOLS.map((s) => s.symbol), (t) => {
      setTickers((prev) => ({ ...prev, [t.symbol]: t }));
      tickPrice(t.symbol, t.price);
    });
    return unsub;
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchKlines(symbol, interval, 120).then((k) => { if (mounted) setKlines(k); }).catch(() => { /* noop */ });
    const unsub = subscribeKline(symbol, interval, (k) => {
      setKlines((prev) => {
        if (prev.length === 0) return [k];
        const last = prev[prev.length - 1];
        if (last.time === k.time) return [...prev.slice(0, -1), k];
        return [...prev.slice(-119), k];
      });
    });
    return () => { mounted = false; unsub(); };
  }, [symbol, interval]);

  const ai = useMemo<AiSignal | null>(() => (klines.length >= 50 ? computeSignal(klines) : null), [klines]);
  const ticker = tickers[symbol];
  const price = ticker?.price ?? klines[klines.length - 1]?.close ?? 0;

  return (
    <AppShell title="Trade" subtitle="Paper trading · Market & limit orders · Stop-loss / Take-profit">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <ChartCard
            symbol={symbol}
            ticker={ticker}
            klines={klines}
            interval={interval}
            onIntervalChange={setInterval}
            positions={paper.positions}
            openOrders={paper.orders.filter((o) => o.symbol === symbol)}
          />
          <SymbolPicker active={symbol} tickers={tickers} onSelect={setSymbol} />
          <OrdersTable orders={paper.orders} onCancel={cancelOrder} />
          <HistoryTable history={paper.history.slice(0, 10)} />
        </div>

        <div className="space-y-6">
          <OrderForm symbol={symbol} price={price} ai={ai} cash={paper.cash} />
          <AiSignalCard ai={ai} />
          <PaperSummary prices={Object.fromEntries(Object.entries(tickers).map(([k, v]) => [k, v.price]))} />
        </div>
      </div>
    </AppShell>
  );
}

function SymbolPicker({ active, tickers, onSelect }: {
  active: string; tickers: Record<string, Ticker>; onSelect: (s: string) => void;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex gap-2 overflow-x-auto">
        {SYMBOLS.map((s) => {
          const t = tickers[s.symbol];
          const isActive = active === s.symbol;
          const isUp = (t?.changePct ?? 0) >= 0;
          return (
            <button
              key={s.symbol}
              onClick={() => onSelect(s.symbol)}
              className={`shrink-0 rounded-xl px-3 py-2 text-left transition ${
                isActive ? "bg-primary/15 ring-1 ring-primary/40" : "ring-1 ring-border/40 hover:ring-primary/30"
              }`}
            >
              <div className="font-display text-sm font-bold">{s.short}</div>
              <div className="font-mono text-xs">{t ? `$${formatUsd(t.price)}` : "—"}</div>
              <div className={`text-[10px] ${isUp ? "text-success" : "text-destructive"}`}>
                {t ? `${t.changePct.toFixed(2)}%` : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartCard({
  symbol, ticker, klines, interval, onIntervalChange, positions, openOrders,
}: {
  symbol: string; ticker?: Ticker; klines: Kline[]; interval: Interval;
  onIntervalChange: (i: Interval) => void;
  positions: Record<string, { qty: number; avgPrice: number; stopLoss?: number; takeProfit?: number }>;
  openOrders: { id: string; side: string; limitPrice?: number }[];
}) {
  const data = useMemo(() => klines.map((k) => ({
    time: new Date(k.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    price: k.close,
  })), [klines]);
  const isUp = (ticker?.changePct ?? 0) >= 0;
  const gradId = useRef(`grad-${Math.random().toString(36).slice(2)}`).current;
  const pos = positions[symbol];

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

      <div className="h-[360px] w-full">
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
              stroke="oklch(0.6 0.04 260)" fontSize={11} tickLine={false} axisLine={false}
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) => `$${formatUsd(v, 0)}`} width={70}
            />
            <Tooltip
              contentStyle={{ background: "oklch(0.18 0.03 275 / 0.95)", border: "1px solid oklch(0.4 0.05 280 / 0.4)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "oklch(0.7 0.04 260)" }}
              formatter={(v: number) => [`$${formatUsd(v)}`, "Price"]}
            />
            <Area type="monotone" dataKey="price" stroke={isUp ? "oklch(0.78 0.2 155)" : "oklch(0.65 0.26 22)"} strokeWidth={2} fill={`url(#${gradId})`} isAnimationActive={false} />
            {pos && pos.qty !== 0 && (
              <ReferenceLine y={pos.avgPrice} stroke="oklch(0.75 0.18 280)" strokeDasharray="4 4" label={{ value: `Entry $${formatUsd(pos.avgPrice)}`, fill: "oklch(0.75 0.18 280)", fontSize: 10, position: "right" }} />
            )}
            {pos?.stopLoss && (
              <ReferenceLine y={pos.stopLoss} stroke="oklch(0.65 0.26 22)" strokeDasharray="4 4" label={{ value: `SL $${formatUsd(pos.stopLoss)}`, fill: "oklch(0.65 0.26 22)", fontSize: 10, position: "right" }} />
            )}
            {pos?.takeProfit && (
              <ReferenceLine y={pos.takeProfit} stroke="oklch(0.78 0.2 155)" strokeDasharray="4 4" label={{ value: `TP $${formatUsd(pos.takeProfit)}`, fill: "oklch(0.78 0.2 155)", fontSize: 10, position: "right" }} />
            )}
            {openOrders.filter((o) => o.limitPrice).map((o) => (
              <ReferenceLine key={o.id} y={o.limitPrice!} stroke="oklch(0.7 0.18 200)" strokeDasharray="2 4" label={{ value: `${o.side} @ $${formatUsd(o.limitPrice!)}`, fill: "oklch(0.7 0.18 200)", fontSize: 10, position: "right" }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function OrderForm({ symbol, price, ai, cash }: {
  symbol: string; price: number; ai: AiSignal | null; cash: number;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [qty, setQty] = useState("0.01");
  const [limit, setLimit] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [useAi, setUseAi] = useState(false);

  // Sync AI defaults when toggled or signal changes
  useEffect(() => {
    if (!useAi || !ai || !price) return;
    setSide(ai.signal === "SELL" ? "SELL" : "BUY");
    const slPct = 0.02;
    const tpPct = 0.02 + ai.confidence * 0.06; // 2%-8%
    if (ai.signal === "BUY") {
      setSl((price * (1 - slPct)).toFixed(2));
      setTp((price * (1 + tpPct)).toFixed(2));
    } else if (ai.signal === "SELL") {
      setSl((price * (1 + slPct)).toFixed(2));
      setTp((price * (1 - tpPct)).toFixed(2));
    }
  }, [useAi, ai, price]);

  const submit = () => {
    const q = parseFloat(qty);
    if (!q || q <= 0) { toast.error("Enter a valid quantity"); return; }
    if (type === "LIMIT" && (!limit || parseFloat(limit) <= 0)) {
      toast.error("Enter a valid limit price"); return;
    }
    if (!price) { toast.error("Waiting for price feed…"); return; }
    placeOrder({
      symbol, side, type, qty: q,
      marketPrice: price,
      limitPrice: type === "LIMIT" ? parseFloat(limit) : undefined,
      stopLoss: sl ? parseFloat(sl) : undefined,
      takeProfit: tp ? parseFloat(tp) : undefined,
      reason: useAi && ai ? `AI ${ai.signal} ${(ai.confidence * 100).toFixed(0)}%` : undefined,
    });
    toast.success(`${type} ${side} ${q} ${symbol}${type === "LIMIT" ? ` @ $${limit}` : ""}`);
  };

  const total = (parseFloat(qty) || 0) * (type === "LIMIT" ? parseFloat(limit) || 0 : price);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider">New Order</h3>
        <span className="text-xs text-muted-foreground">Cash ${formatUsd(cash)}</span>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/30 p-1">
        <button
          onClick={() => setSide("BUY")}
          className={`rounded-md py-2 text-sm font-semibold transition ${
            side === "BUY" ? "bg-success text-success-foreground" : "text-muted-foreground"
          }`}
        >Buy / Long</button>
        <button
          onClick={() => setSide("SELL")}
          className={`rounded-md py-2 text-sm font-semibold transition ${
            side === "SELL" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground"
          }`}
        >Sell / Short</button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted/20 p-1">
        {(["MARKET", "LIMIT"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-md py-1.5 text-xs font-medium transition ${
              type === t ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-muted-foreground"
            }`}
          >{t}</button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Quantity">
          <input
            type="number" step="0.0001" value={qty} onChange={(e) => setQty(e.target.value)}
            className="w-full rounded-md border border-border/40 bg-background/50 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>
        {type === "LIMIT" && (
          <Field label="Limit Price (USD)">
            <input
              type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={price.toFixed(2)}
              className="w-full rounded-md border border-border/40 bg-background/50 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stop Loss">
            <input
              type="number" step="0.01" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="optional"
              className="w-full rounded-md border border-border/40 bg-background/50 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-destructive"
            />
          </Field>
          <Field label="Take Profit">
            <input
              type="number" step="0.01" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="optional"
              className="w-full rounded-md border border-border/40 bg-background/50 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-success"
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-xs ring-1 ring-primary/20">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="accent-primary" />
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>
            Use AI signal{ai ? ` — ${ai.signal} ${(ai.confidence * 100).toFixed(0)}%` : ""}
          </span>
        </label>

        <div className="flex justify-between rounded-md bg-muted/20 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Order value</span>
          <span className="font-mono">${formatUsd(total)}</span>
        </div>

        <button
          onClick={submit}
          className={`w-full rounded-md py-2.5 text-sm font-bold transition hover:opacity-90 ${
            side === "BUY" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
          }`}
        >
          Place {type} {side}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNodeLike }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
type ReactNodeLike = React.ReactNode;

function AiSignalCard({ ai }: { ai: AiSignal | null }) {
  if (!ai) return null;
  const tone = ai.signal === "BUY" ? "success" : ai.signal === "SELL" ? "destructive" : "primary";
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary animate-pulse-glow" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider">AI Signal</h3>
      </div>
      <div className={`rounded-xl p-3 ring-1 ${
        tone === "success" ? "bg-success/10 ring-success/30" :
        tone === "destructive" ? "bg-destructive/10 ring-destructive/30" :
        "bg-primary/10 ring-primary/30"
      }`}>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Recommendation</span><span>{(ai.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className={`font-display text-2xl font-bold ${
          tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary"
        }`}>{ai.signal}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full ${tone === "success" ? "bg-success" : tone === "destructive" ? "bg-destructive" : "bg-primary"}`} style={{ width: `${ai.confidence * 100}%` }} />
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        {ai.reasons.map((r, i) => (
          <li key={i} className="flex gap-2"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />{r}</li>
        ))}
      </ul>
    </div>
  );
}

function PaperSummary({ prices }: { prices: Record<string, number> }) {
  const paper = usePaperState();
  const { equity, unrealized, realized } = portfolioValue(prices);
  const totalPnl = equity - paper.startingCash;
  const totalPct = (totalPnl / paper.startingCash) * 100;
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Paper Account</h3>
      <div className="space-y-2 text-xs">
        <Row label="Equity" value={`$${formatUsd(equity)}`} />
        <Row label="Cash" value={`$${formatUsd(paper.cash)}`} />
        <Row label="Unrealized PnL" value={`${unrealized >= 0 ? "+" : ""}$${formatUsd(unrealized)}`} tone={unrealized >= 0 ? "success" : "destructive"} />
        <Row label="Realized PnL" value={`${realized >= 0 ? "+" : ""}$${formatUsd(realized)}`} tone={realized >= 0 ? "success" : "destructive"} />
        <Row label="Total Return" value={`${totalPnl >= 0 ? "+" : ""}${totalPct.toFixed(2)}%`} tone={totalPnl >= 0 ? "success" : "destructive"} />
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  return (
    <div className="flex justify-between rounded-md border border-border/40 px-3 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}

function OrdersTable({ orders, onCancel }: { orders: ReturnType<typeof usePaperState>["orders"]; onCancel: (id: string) => void }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Open Orders</h3>
      {orders.length === 0 ? (
        <p className="text-xs text-muted-foreground">No open orders.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="pb-2">Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Limit</th><th>SL</th><th>TP</th><th></th></tr>
            </thead>
            <tbody className="font-mono">
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border/30">
                  <td className="py-2">{o.symbol}</td>
                  <td className={o.side === "BUY" ? "text-success" : "text-destructive"}>{o.side}</td>
                  <td>{o.type}</td>
                  <td>{o.qty}</td>
                  <td>{o.limitPrice ? `$${formatUsd(o.limitPrice)}` : "—"}</td>
                  <td>{o.stopLoss ? `$${formatUsd(o.stopLoss)}` : "—"}</td>
                  <td>{o.takeProfit ? `$${formatUsd(o.takeProfit)}` : "—"}</td>
                  <td className="text-right">
                    <button onClick={() => { onCancel(o.id); toast("Order cancelled"); }} className="rounded-md bg-muted/40 px-2 py-1 text-[10px] hover:bg-destructive/20 hover:text-destructive">Cancel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistoryTable({ history }: { history: ReturnType<typeof usePaperState>["history"] }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Recent Activity</h3>
      {history.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="pb-2">Time</th><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Status</th><th>Note</th></tr>
            </thead>
            <tbody className="font-mono">
              {history.map((o) => (
                <tr key={o.id + (o.filledAt ?? 0)} className="border-t border-border/30">
                  <td className="py-2 text-muted-foreground">{new Date(o.filledAt ?? o.createdAt).toLocaleTimeString()}</td>
                  <td>{o.symbol}</td>
                  <td className={o.side === "BUY" ? "text-success" : "text-destructive"}>{o.side}</td>
                  <td>{o.type}</td>
                  <td>{o.qty}</td>
                  <td>{o.fillPrice ? `$${formatUsd(o.fillPrice)}` : "—"}</td>
                  <td className="text-muted-foreground">{o.status}</td>
                  <td className="text-muted-foreground">{o.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
