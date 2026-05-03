import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { fetchTickers, formatUsd, subscribeTickers, SYMBOLS, type Ticker } from "@/lib/binance";
import { usePaperState, portfolioValue, tickPrice } from "@/lib/paper-trading";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — Nebula Trade" }] }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const paper = usePaperState();
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});

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

  const prices = Object.fromEntries(Object.entries(tickers).map(([k, v]) => [k, v.price]));
  const { equity, unrealized, realized } = portfolioValue(prices);
  const totalReturn = equity - paper.startingCash;
  const totalPct = (totalReturn / paper.startingCash) * 100;

  const positions = Object.values(paper.positions).filter((p) => p.qty !== 0);

  return (
    <AppShell title="Portfolio" subtitle="Paper account · Positions · Performance">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Equity" value={`$${formatUsd(equity)}`} icon={Wallet} />
        <Stat label="Cash" value={`$${formatUsd(paper.cash)}`} />
        <Stat
          label="Unrealized PnL"
          value={`${unrealized >= 0 ? "+" : ""}$${formatUsd(unrealized)}`}
          tone={unrealized >= 0 ? "success" : "destructive"}
          icon={unrealized >= 0 ? TrendingUp : TrendingDown}
        />
        <Stat
          label="Total Return"
          value={`${totalReturn >= 0 ? "+" : ""}${totalPct.toFixed(2)}%`}
          sub={`${totalReturn >= 0 ? "+" : ""}$${formatUsd(totalReturn)}`}
          tone={totalReturn >= 0 ? "success" : "destructive"}
        />
      </div>

      <div className="mt-6 glass rounded-2xl p-5">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Open Positions</h3>
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open positions. Visit Trade to place an order.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-2">Symbol</th><th>Direction</th><th>Qty</th><th>Avg Entry</th>
                  <th>Mark</th><th>SL</th><th>TP</th><th>Unrealized</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {positions.map((p) => {
                  const mark = prices[p.symbol] ?? p.avgPrice;
                  const unr = (mark - p.avgPrice) * p.qty;
                  const unrPct = ((mark - p.avgPrice) / p.avgPrice) * 100 * (p.qty > 0 ? 1 : -1);
                  return (
                    <tr key={p.symbol} className="border-t border-border/30">
                      <td className="py-2">{p.symbol}</td>
                      <td className={p.qty > 0 ? "text-success" : "text-destructive"}>{p.qty > 0 ? "LONG" : "SHORT"}</td>
                      <td>{Math.abs(p.qty)}</td>
                      <td>${formatUsd(p.avgPrice)}</td>
                      <td>${formatUsd(mark)}</td>
                      <td>{p.stopLoss ? `$${formatUsd(p.stopLoss)}` : "—"}</td>
                      <td>{p.takeProfit ? `$${formatUsd(p.takeProfit)}` : "—"}</td>
                      <td className={unr >= 0 ? "text-success" : "text-destructive"}>
                        {unr >= 0 ? "+" : ""}${formatUsd(unr)} ({unrPct.toFixed(2)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 glass rounded-2xl p-5">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Trade History</h3>
        {paper.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trade history.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr><th className="pb-2">Time</th><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Status</th><th>Note</th></tr>
              </thead>
              <tbody className="font-mono">
                {paper.history.map((o, i) => (
                  <tr key={o.id + i} className="border-t border-border/30">
                    <td className="py-2 text-muted-foreground">{new Date(o.filledAt ?? o.createdAt).toLocaleString()}</td>
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

      <div className="mt-6 text-xs text-muted-foreground">
        Realized PnL: <span className={`font-mono ${realized >= 0 ? "text-success" : "text-destructive"}`}>
          {realized >= 0 ? "+" : ""}${formatUsd(realized)}
        </span>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sub, tone, icon: Icon }: {
  label: string; value: string; sub?: string;
  tone?: "success" | "destructive";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className={`h-4 w-4 ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary"}`} />}
      </div>
      <div className={`mt-3 font-display text-2xl font-bold ${
        tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""
      }`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
