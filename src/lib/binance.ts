// Binance public WebSocket + REST helpers — no API key required
// Docs: https://binance-docs.github.io/apidocs/spot/en/

export interface Ticker {
  symbol: string;
  price: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
}

export interface Kline {
  time: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const SYMBOLS = [
  { symbol: "BTCUSDT", name: "Bitcoin", short: "BTC" },
  { symbol: "ETHUSDT", name: "Ethereum", short: "ETH" },
  { symbol: "SOLUSDT", name: "Solana", short: "SOL" },
  { symbol: "BNBUSDT", name: "BNB", short: "BNB" },
  { symbol: "XRPUSDT", name: "XRP", short: "XRP" },
  { symbol: "DOGEUSDT", name: "Dogecoin", short: "DOGE" },
];

export async function fetchKlines(symbol: string, interval = "15m", limit = 120): Promise<Kline[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch klines");
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    time: Math.floor((k[0] as number) / 1000),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}

export async function fetchTickers(symbols: string[]): Promise<Ticker[]> {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch tickers");
  const data = (await res.json()) as Array<Record<string, string>>;
  return data.map((d) => ({
    symbol: d.symbol,
    price: parseFloat(d.lastPrice),
    changePct: parseFloat(d.priceChangePercent),
    high: parseFloat(d.highPrice),
    low: parseFloat(d.lowPrice),
    volume: parseFloat(d.quoteVolume),
  }));
}

export type TickerStreamMsg = { s: string; c: string; P: string; h: string; l: string; q: string };

export function subscribeTickers(symbols: string[], onMsg: (t: Ticker) => void): () => void {
  const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join("/");
  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
  ws.onmessage = (ev) => {
    try {
      const { data } = JSON.parse(ev.data) as { data: TickerStreamMsg };
      onMsg({
        symbol: data.s,
        price: parseFloat(data.c),
        changePct: parseFloat(data.P),
        high: parseFloat(data.h),
        low: parseFloat(data.l),
        volume: parseFloat(data.q),
      });
    } catch { /* ignore */ }
  };
  return () => { try { ws.close(); } catch { /* noop */ } };
}

export function subscribeKline(
  symbol: string,
  interval: string,
  onMsg: (k: Kline) => void,
): () => void {
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`,
  );
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data) as { k: { t: number; o: string; h: string; l: string; c: string; v: string } };
      const k = data.k;
      onMsg({
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      });
    } catch { /* ignore */ }
  };
  return () => { try { ws.close(); } catch { /* noop */ } };
}

export function formatUsd(n: number, digits = 2): string {
  if (!isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  if (n >= 1) return n.toFixed(digits);
  return n.toFixed(Math.max(digits, 4));
}
