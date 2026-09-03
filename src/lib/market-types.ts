export type Quote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  previousClose: number;
  volume?: number;
  currency: string;
  stale: boolean;
};

export type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number };

export type Timeframe =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "12h"
  | "1d"
  | "1w"
  | "1M";

export const TIMEFRAMES: Timeframe[] = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "12h",
  "1d",
  "1w",
  "1M",
];
