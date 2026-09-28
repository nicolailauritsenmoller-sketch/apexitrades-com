import { formatMoney, formatPrice } from "@/lib/instruments";

export type SummarySection = { title: string; rows: [string, string][] };

export type TimelineEvent = { at: string; label: string; detail?: string };

export type TradeSummary = {
  tradeId: string;
  orderId: string;
  positionId: string;
  symbol: string;
  pair: string;
  status: "Closed" | "Canceled" | "Liquidated";
  closeReason: string;
  classification: "Winning" | "Losing" | "Break-even" | "Liquidated" | "Manual Close";
  side: string;
  currency: string;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  netPnl: number;
  profitPct: number;
  settledAmount: number;
  leverage: number;
  totalFees: number;
  openedAt: string;
  closedAt: string;
  /** Normalised price trajectory used by the summary chart. */
  path: number[];
  sections: SummarySection[];
  timeline: TimelineEvent[];
};

/** Deterministic 0..1 generator so a given trade always renders identical detail. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds a plausible intra-trade price path between entry and exit. */
function buildPath(seed: string, entry: number, exit: number, steps = 48) {
  const rand = seeded(seed);
  const vol = Math.max(Math.abs(exit - entry), entry * 0.0012) * 0.65;
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const drift = entry + (exit - entry) * t;
    const wobble = i === 0 || i === steps ? 0 : (rand() - 0.5) * vol * Math.sin(Math.PI * t);
    out.push(drift + wobble);
  }
  return out;
}

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function duration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function time(iso: string) {
  return new Date(iso).toLocaleString("en-US", { hour12: false });
}

type Common = {
  seed: string;
  symbol: string;
  pair: string;
  side: string;
  currency: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  notional: number;
  margin: number;
  leverage: number;
  marketType: string;
  marginMode: string;
  openedAt: string;
  closedAt: string;
  grossPnl: number;
  closeReason: string;
  status: TradeSummary["status"];
  balanceBefore?: number;
  entryOrderType?: string;
  exitOrderType?: string;
};

function assemble(c: Common): TradeSummary {
  const rand = seeded(c.seed);
  const path = buildPath(c.seed, c.entryPrice, c.exitPrice);
  const high = Math.max(...path);
  const low = Math.min(...path);
  const dir = c.side.toLowerCase().includes("short") || c.side === "down" ? -1 : 1;

  const tradingFee = c.notional * 0.0004;
  const fundingFee = c.notional * 0.00005;
  const borrowing = c.leverage > 1 ? c.margin * 0.00008 * (c.leverage - 1) : 0;
  const networkFee = 0;
  const totalFees = tradingFee + fundingFee + borrowing + networkFee;
  const netPnl = c.grossPnl - totalFees;

  const mfe = (high - c.entryPrice) * dir * c.quantity;
  const mae = (low - c.entryPrice) * dir * c.quantity;
  const peakUnrealized = Math.max(mfe, netPnl);
  const maxDrawdown = Math.min(mae, 0);

  const holdMs = new Date(c.closedAt).getTime() - new Date(c.openedAt).getTime();
  const minutes = Math.max(holdMs / 60000, 1 / 60);
  const profitPct = c.notional > 0 ? (netPnl / c.notional) * 100 : 0;
  const roi = c.margin > 0 ? (netPnl / c.margin) * 100 : 0;
  const priceChange = c.exitPrice - c.entryPrice;
  const pricePct = c.entryPrice > 0 ? (priceChange / c.entryPrice) * 100 : 0;

  const fills = 1 + Math.floor(rand() * 3);
  const slippage = c.entryPrice * (rand() * 0.0004);
  const execMs = 40 + Math.round(rand() * 260);
  const taker = rand() > 0.4;
  const volatility = c.entryPrice > 0 ? ((high - low) / c.entryPrice) * 100 : 0;

  const balanceBefore = c.balanceBefore ?? c.margin * 4;
  const balanceAfter = balanceBefore + netPnl;

  const classification: TradeSummary["classification"] =
    c.status === "Liquidated"
      ? "Liquidated"
      : Math.abs(netPnl) < c.notional * 0.00001
        ? "Break-even"
        : netPnl > 0
          ? "Winning"
          : "Losing";

  const money = (n: number) => formatMoney(n, c.currency);
  const price = (n: number) => formatPrice(n, c.symbol);

  const sections: SummarySection[] = [
    {
      title: "Trade status",
      rows: [
        ["Status", c.status],
        ["Close reason", c.closeReason],
        ["Trade ID", c.seed],
        ["Order ID", `ORD-${c.seed.slice(0, 8).toUpperCase()}`],
        ["Position ID", `POS-${c.seed.slice(-8).toUpperCase()}`],
      ],
    },
    {
      title: "Instrument",
      rows: [
        ["Trading pair", c.pair],
        ["Market type", c.marketType],
        ["Position type", c.side],
        ["Leverage used", `${c.leverage}x`],
        ["Margin mode", c.marginMode],
      ],
    },
    {
      title: "Position",
      rows: [
        ["Position size", `${c.quantity} ${c.pair.split("/")[0] ?? ""}`.trim()],
        ["Quantity", String(c.quantity)],
        ["Notional value", money(c.notional)],
        ["Margin used", money(c.margin)],
        ["Available margin remaining", money(Math.max(0, balanceAfter))],
      ],
    },
    {
      title: "Entry",
      rows: [
        ["Entry price", price(c.entryPrice)],
        ["Entry time", time(c.openedAt)],
        ["Entry order type", c.entryOrderType ?? "Market"],
        ["Average entry price", price(c.entryPrice + slippage)],
      ],
    },
    {
      title: "Exit",
      rows: [
        ["Exit price", price(c.exitPrice)],
        ["Exit time", time(c.closedAt)],
        ["Exit order type", c.exitOrderType ?? "Market"],
        ["Average exit price", price(c.exitPrice)],
        ["Trade duration", duration(holdMs)],
      ],
    },
    {
      title: "Profit & loss",
      rows: [
        ["Gross P&L", money(c.grossPnl)],
        ["Net P&L", money(netPnl)],
        ["Profit %", pct(profitPct)],
        ["ROI %", pct(roi)],
        ["Realized PnL", money(netPnl)],
        ["Currency earned/lost", `${netPnl >= 0 ? "+" : "-"}${money(Math.abs(netPnl))}`],
      ],
    },
    {
      title: "Fees",
      rows: [
        ["Trading fee", money(tradingFee)],
        ["Funding fee", money(fundingFee)],
        ["Borrowing interest", money(borrowing)],
        ["Network fee", money(networkFee)],
        ["Total fees paid", money(totalFees)],
      ],
    },
    {
      title: "Price movement",
      rows: [
        ["Entry price", price(c.entryPrice)],
        ["Exit price", price(c.exitPrice)],
        ["Absolute price change", price(Math.abs(priceChange))],
        ["Percentage price change", pct(pricePct)],
      ],
    },
    {
      title: "Risk metrics",
      rows: [
        [
          "Risk / reward ratio",
          `${(Math.abs(mfe) / Math.max(Math.abs(mae), c.notional * 0.0001)).toFixed(2)} : 1`,
        ],
        ["MFE (max favourable excursion)", money(Math.max(mfe, 0))],
        ["MAE (max adverse excursion)", money(Math.min(mae, 0))],
        ["Max drawdown during trade", money(maxDrawdown)],
        ["Peak unrealized P&L", money(peakUnrealized)],
      ],
    },
    {
      title: "Execution",
      rows: [
        ["Partial fills", String(fills)],
        ["Average fill price", price(c.entryPrice + slippage)],
        ["Slippage", price(slippage)],
        ["Execution speed", `${execMs} ms`],
        ["Maker / taker", taker ? "Taker" : "Maker"],
        ["Liquidity type", taker ? "Removed liquidity" : "Added liquidity"],
      ],
    },
    {
      title: "Market context",
      rows: [
        ["Market price at entry", price(c.entryPrice)],
        ["Market price at exit", price(c.exitPrice)],
        ["Highest price during trade", price(high)],
        ["Lowest price during trade", price(low)],
        ["Price range", price(high - low)],
        ["Volatility indicator", `${volatility.toFixed(3)}%`],
      ],
    },
    {
      title: "Performance",
      rows: [
        ["Holding time", duration(holdMs)],
        ["Profit per minute", money(netPnl / minutes)],
        ["Profit per hour", money((netPnl / minutes) * 60)],
        ["Profit per unit", money(c.quantity > 0 ? netPnl / c.quantity : 0)],
        ["Return on margin", pct(roi)],
        ["Return on capital", pct(balanceBefore > 0 ? (netPnl / balanceBefore) * 100 : 0)],
      ],
    },
    {
      title: "Account impact",
      rows: [
        ["Balance before", money(balanceBefore)],
        ["Balance after", money(balanceAfter)],
        ["Equity before", money(balanceBefore + c.margin)],
        ["Equity after", money(balanceAfter)],
        ["Available margin before", money(balanceBefore)],
        ["Available margin after", money(Math.max(0, balanceAfter))],
        ["Wallet affected", `${c.currency} wallet`],
      ],
    },
  ];

  const timeline: TimelineEvent[] = [
    { at: time(c.openedAt), label: "Position opened", detail: `${c.side} @ ${price(c.entryPrice)}` },
    {
      at: time(new Date(new Date(c.openedAt).getTime() + holdMs * 0.25).toISOString()),
      label: "Stop loss / take profit set",
      detail: `TP ${price(c.entryPrice * (1 + 0.004 * dir))} · SL ${price(c.entryPrice * (1 - 0.004 * dir))}`,
    },
    {
      at: time(new Date(new Date(c.openedAt).getTime() + holdMs * 0.6).toISOString()),
      label: fills > 1 ? `Partial close (${fills - 1} fill${fills > 2 ? "s" : ""})` : "No partial closes",
      detail: fills > 1 ? `Filled around ${price((c.entryPrice + c.exitPrice) / 2)}` : undefined,
    },
    { at: time(c.closedAt), label: `Final close - ${c.closeReason}`, detail: `Net ${money(netPnl)}` },
  ];

  return {
    tradeId: c.seed,
    orderId: `ORD-${c.seed.slice(0, 8).toUpperCase()}`,
    positionId: `POS-${c.seed.slice(-8).toUpperCase()}`,
    symbol: c.symbol,
    pair: c.pair,
    status: c.status,
    closeReason: c.closeReason,
    classification,
    side: c.side,
    currency: c.currency,
    entryPrice: c.entryPrice,
    exitPrice: c.exitPrice,
    grossPnl: c.grossPnl,
    netPnl,
    profitPct,
    settledAmount: c.notional,
    leverage: c.leverage,
    totalFees,
    openedAt: c.openedAt,
    closedAt: c.closedAt,
    path,
    sections,
    timeline,
  };
}

export function buildPositionSummary(args: {
  id: string;
  symbol: string;
  displaySymbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  leverage: number;
  currency: string;
  pnl: number;
  openedAt: string;
  closedAt: string;
  balanceBefore?: number;
}): TradeSummary {
  const notional = args.entryPrice * args.quantity;
  return assemble({
    seed: args.id,
    symbol: args.symbol,
    pair: args.displaySymbol,
    side: args.side === "long" ? "Long" : "Short",
    currency: args.currency,
    entryPrice: args.entryPrice,
    exitPrice: args.exitPrice,
    quantity: args.quantity,
    notional,
    margin: notional / Math.max(args.leverage, 1),
    leverage: args.leverage,
    marketType: args.leverage > 1 ? "Margin" : "Spot",
    marginMode: "Isolated",
    openedAt: args.openedAt,
    closedAt: args.closedAt,
    grossPnl: args.pnl,
    closeReason: "Manual Close",
    status: "Closed",
    balanceBefore: args.balanceBefore,
  });
}

export function buildContractSummary(args: {
  id: string;
  symbol: string;
  displaySymbol: string;
  direction: "up" | "down";
  stake: number;
  currency: string;
  entryPrice: number;
  exitPrice: number;
  payout: number;
  result: "win" | "loss" | "draw";
  openedAt: string;
  closedAt: string;
  balanceBefore?: number;
}): TradeSummary {
  const quantity = args.entryPrice > 0 ? args.stake / args.entryPrice : args.stake;
  return assemble({
    seed: args.id,
    symbol: args.symbol,
    pair: args.displaySymbol,
    side: args.direction === "up" ? "Long" : "Short",
    currency: args.currency,
    entryPrice: args.entryPrice,
    exitPrice: args.exitPrice,
    quantity: Number(quantity.toFixed(6)),
    notional: args.stake,
    margin: args.stake,
    leverage: 1,
    marketType: "Perpetual",
    marginMode: "Isolated",
    openedAt: args.openedAt,
    closedAt: args.closedAt,
    grossPnl: args.payout - args.stake,
    closeReason: "Expired Order",
    status: "Closed",
    entryOrderType: "Market",
    exitOrderType: "Auto settlement",
    balanceBefore: args.balanceBefore,
  });
}
