export type Quote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  previousClose: number;
  currency: string;
  stale: boolean;
};

export type Candle = { t: number; o: number; h: number; l: number; c: number };

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1d";

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "1d"];
