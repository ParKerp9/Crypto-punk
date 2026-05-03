// Paper trading store — persisted to localStorage. Pure client-side simulation.
import { useEffect, useState } from "react";

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT";
export type OrderStatus = "OPEN" | "FILLED" | "CANCELLED";

export interface Order {
  id: string;
  createdAt: number;
  filledAt?: number;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  limitPrice?: number;
  fillPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  status: OrderStatus;
  reason?: string; // e.g. "AI BUY 78%"
}

export interface Position {
  symbol: string;
  qty: number;          // signed (positive = long, negative = short)
  avgPrice: number;
  realizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface PaperState {
  cash: number;
  startingCash: number;
  orders: Order[];
  positions: Record<string, Position>;
  history: Order[]; // filled / cancelled
}

const KEY = "nebula:paper-state:v1";
const STARTING_CASH = 25_000;

const defaultState = (): PaperState => ({
  cash: STARTING_CASH,
  startingCash: STARTING_CASH,
  orders: [],
  positions: {},
  history: [],
});

let state: PaperState = load();
const listeners = new Set<(s: PaperState) => void>();

function load(): PaperState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* noop */ }
  listeners.forEach((fn) => fn(state));
}

export function getPaperState(): PaperState {
  return state;
}

export function subscribePaper(fn: (s: PaperState) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function usePaperState(): PaperState {
  const [s, setS] = useState<PaperState>(state);
  useEffect(() => subscribePaper(setS), []);
  return s;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function fillOrder(order: Order, price: number) {
  const pos = state.positions[order.symbol] ?? {
    symbol: order.symbol, qty: 0, avgPrice: 0, realizedPnl: 0,
  };
  const signedQty = order.side === "BUY" ? order.qty : -order.qty;
  const cost = signedQty * price;

  // Update cash (long buys reduce cash, sells increase)
  state.cash -= cost;

  // Update position avg & realized pnl
  const newQty = pos.qty + signedQty;
  if (pos.qty === 0 || Math.sign(pos.qty) === Math.sign(signedQty)) {
    // adding to position
    const totalCost = pos.avgPrice * pos.qty + price * signedQty;
    pos.avgPrice = newQty === 0 ? 0 : totalCost / newQty;
  } else {
    // reducing/closing
    const closingQty = Math.min(Math.abs(signedQty), Math.abs(pos.qty)) * Math.sign(signedQty);
    const realized = (price - pos.avgPrice) * -closingQty;
    pos.realizedPnl += realized;
    if (Math.sign(newQty) !== Math.sign(pos.qty) && newQty !== 0) {
      pos.avgPrice = price; // flipped direction
    }
  }
  pos.qty = newQty;
  if (order.stopLoss) pos.stopLoss = order.stopLoss;
  if (order.takeProfit) pos.takeProfit = order.takeProfit;

  if (pos.qty === 0) {
    pos.avgPrice = 0;
    pos.stopLoss = undefined;
    pos.takeProfit = undefined;
  }
  state.positions[order.symbol] = pos;

  order.status = "FILLED";
  order.fillPrice = price;
  order.filledAt = Date.now();
  state.history.unshift({ ...order });
}

export function placeOrder(input: {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  marketPrice: number;
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  reason?: string;
}): Order {
  const order: Order = {
    id: uid(),
    createdAt: Date.now(),
    symbol: input.symbol,
    side: input.side,
    type: input.type,
    qty: input.qty,
    limitPrice: input.limitPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    status: "OPEN",
    reason: input.reason,
  };

  if (input.type === "MARKET") {
    fillOrder(order, input.marketPrice);
  } else {
    state.orders.unshift(order);
  }
  persist();
  return order;
}

export function cancelOrder(id: string) {
  const idx = state.orders.findIndex((o) => o.id === id);
  if (idx === -1) return;
  const o = state.orders[idx];
  o.status = "CANCELLED";
  state.history.unshift({ ...o });
  state.orders.splice(idx, 1);
  persist();
}

export function resetPaper() {
  state = defaultState();
  persist();
}

// Process price updates: fill limit orders, trigger SL/TP on positions.
export function tickPrice(symbol: string, price: number) {
  let changed = false;

  // Check open limit orders
  for (let i = state.orders.length - 1; i >= 0; i--) {
    const o = state.orders[i];
    if (o.symbol !== symbol || o.type !== "LIMIT" || o.status !== "OPEN") continue;
    const lp = o.limitPrice ?? 0;
    const shouldFill = o.side === "BUY" ? price <= lp : price >= lp;
    if (shouldFill) {
      fillOrder(o, lp);
      state.orders.splice(i, 1);
      changed = true;
    }
  }

  // Check SL/TP on position
  const pos = state.positions[symbol];
  if (pos && pos.qty !== 0) {
    const isLong = pos.qty > 0;
    const hitSL = pos.stopLoss && (isLong ? price <= pos.stopLoss : price >= pos.stopLoss);
    const hitTP = pos.takeProfit && (isLong ? price >= pos.takeProfit : price <= pos.takeProfit);
    if (hitSL || hitTP) {
      const exitPrice = hitSL ? pos.stopLoss! : pos.takeProfit!;
      const closeOrder: Order = {
        id: uid(),
        createdAt: Date.now(),
        symbol,
        side: isLong ? "SELL" : "BUY",
        type: "MARKET",
        qty: Math.abs(pos.qty),
        status: "OPEN",
        reason: hitSL ? "Stop-loss triggered" : "Take-profit triggered",
      };
      fillOrder(closeOrder, exitPrice);
      changed = true;
    }
  }

  if (changed) persist();
}

export function portfolioValue(prices: Record<string, number>): {
  equity: number; unrealized: number; realized: number;
} {
  let unrealized = 0;
  let realized = 0;
  let posValue = 0;
  Object.values(state.positions).forEach((p) => {
    realized += p.realizedPnl;
    if (p.qty === 0) return;
    const price = prices[p.symbol] ?? p.avgPrice;
    posValue += p.qty * price;
    unrealized += (price - p.avgPrice) * p.qty;
  });
  return { equity: state.cash + posValue, unrealized, realized };
}
