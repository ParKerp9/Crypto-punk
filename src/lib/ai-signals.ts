// Mocked AI signal engine using simple technical indicators (EMA, RSI, MACD).
// Produces Buy/Sell/Hold with confidence and human-readable reasoning.

import type { Kline } from "./binance";

export type Signal = "BUY" | "SELL" | "HOLD";

export interface AiSignal {
  signal: Signal;
  confidence: number; // 0..1
  reasons: string[];
  rsi: number;
  macd: number;
  macdSignal: number;
  ema20: number;
  ema50: number;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, i) => {
    if (i === 0) out.push(v);
    else out.push(v * k + out[i - 1] * (1 - k));
  });
  return out;
}

function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  const avgG = gains / period;
  const avgL = losses / period;
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

export function computeSignal(klines: Kline[]): AiSignal {
  const closes = klines.map((k) => k.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const macdSignalLine = ema(macdLine, 9);
  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);

  const last = closes.length - 1;
  const r = rsi(closes);
  const macd = macdLine[last];
  const macdSig = macdSignalLine[last];
  const e20 = ema20Arr[last];
  const e50 = ema50Arr[last];
  const price = closes[last];

  const reasons: string[] = [];
  let score = 0;

  if (r < 30) { score += 2; reasons.push(`RSI ${r.toFixed(1)} indicates oversold conditions`); }
  else if (r > 70) { score -= 2; reasons.push(`RSI ${r.toFixed(1)} indicates overbought conditions`); }
  else { reasons.push(`RSI ${r.toFixed(1)} sits in neutral territory`); }

  if (macd > macdSig) { score += 1.5; reasons.push("MACD crossed above signal line — bullish momentum"); }
  else { score -= 1.5; reasons.push("MACD below signal line — bearish momentum"); }

  if (e20 > e50) { score += 1; reasons.push("EMA20 above EMA50 — short-term uptrend"); }
  else { score -= 1; reasons.push("EMA20 below EMA50 — short-term downtrend"); }

  if (price > e20) { score += 0.5; reasons.push("Price trading above EMA20"); }
  else { score -= 0.5; reasons.push("Price trading below EMA20"); }

  let signal: Signal = "HOLD";
  if (score >= 2) signal = "BUY";
  else if (score <= -2) signal = "SELL";

  const confidence = Math.min(1, Math.abs(score) / 5);

  return {
    signal,
    confidence,
    reasons,
    rsi: r,
    macd,
    macdSignal: macdSig,
    ema20: e20,
    ema50: e50,
  };
}
