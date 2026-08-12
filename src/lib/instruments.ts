export type AssetClass = "crypto" | "stock" | "future" | "forex" | "metal";

export type Instrument = {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  /** Wallet currency the position is margined and settled in. */
  currency: string;
  source: "binance" | "yahoo";
  /** Decimal places for price display. */
  precision: number;
  /** Smallest tradable size step. */
  step: number;
};

export const INSTRUMENTS: Instrument[] = [
  // ---- Crypto (Binance spot, settled in USDT) ----
  { symbol: "BTCUSDT", name: "Bitcoin", assetClass: "crypto", currency: "USDT", source: "binance", precision: 2, step: 0.001 },
  { symbol: "ETHUSDT", name: "Ethereum", assetClass: "crypto", currency: "USDT", source: "binance", precision: 2, step: 0.01 },
  { symbol: "SOLUSDT", name: "Solana", assetClass: "crypto", currency: "USDT", source: "binance", precision: 3, step: 0.1 },
  { symbol: "XRPUSDT", name: "XRP", assetClass: "crypto", currency: "USDT", source: "binance", precision: 4, step: 1 },
  { symbol: "BNBUSDT", name: "BNB", assetClass: "crypto", currency: "USDT", source: "binance", precision: 2, step: 0.01 },
  { symbol: "DOGEUSDT", name: "Dogecoin", assetClass: "crypto", currency: "USDT", source: "binance", precision: 5, step: 10 },
  { symbol: "ADAUSDT", name: "Cardano", assetClass: "crypto", currency: "USDT", source: "binance", precision: 4, step: 1 },
  { symbol: "AVAXUSDT", name: "Avalanche", assetClass: "crypto", currency: "USDT", source: "binance", precision: 3, step: 0.1 },
  { symbol: "LINKUSDT", name: "Chainlink", assetClass: "crypto", currency: "USDT", source: "binance", precision: 3, step: 0.1 },
  { symbol: "TONUSDT", name: "Toncoin", assetClass: "crypto", currency: "USDT", source: "binance", precision: 4, step: 1 },
  { symbol: "SUIUSDT", name: "Sui", assetClass: "crypto", currency: "USDT", source: "binance", precision: 4, step: 1 },
  { symbol: "NEARUSDT", name: "NEAR Protocol", assetClass: "crypto", currency: "USDT", source: "binance", precision: 4, step: 1 },
  { symbol: "APTUSDT", name: "Aptos", assetClass: "crypto", currency: "USDT", source: "binance", precision: 4, step: 1 },
  { symbol: "ATOMUSDT", name: "Cosmos", assetClass: "crypto", currency: "USDT", source: "binance", precision: 4, step: 0.1 },
  { symbol: "POLUSDT", name: "Polygon (POL)", assetClass: "crypto", currency: "USDT", source: "binance", precision: 5, step: 10 },
  { symbol: "PEPEUSDT", name: "Pepe", assetClass: "crypto", currency: "USDT", source: "binance", precision: 8, step: 1000000 },
  { symbol: "SHIBUSDT", name: "Shiba Inu", assetClass: "crypto", currency: "USDT", source: "binance", precision: 8, step: 100000 },

  // ---- Stocks ----
  { symbol: "AAPL", name: "Apple Inc.", assetClass: "stock", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "NVDA", name: "NVIDIA Corp.", assetClass: "stock", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "TSLA", name: "Tesla Inc.", assetClass: "stock", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "MSFT", name: "Microsoft Corp.", assetClass: "stock", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "AMZN", name: "Amazon.com Inc.", assetClass: "stock", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "META", name: "Meta Platforms", assetClass: "stock", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "AMD", name: "Advanced Micro Devices", assetClass: "stock", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "COIN", name: "Coinbase Global", assetClass: "stock", currency: "USD", source: "yahoo", precision: 2, step: 1 },

  // ---- Futures ----
  { symbol: "ES=F", name: "E-mini S&P 500", assetClass: "future", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "NQ=F", name: "E-mini Nasdaq 100", assetClass: "future", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "YM=F", name: "E-mini Dow", assetClass: "future", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "CL=F", name: "Crude Oil WTI", assetClass: "future", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "NG=F", name: "Natural Gas", assetClass: "future", currency: "USD", source: "yahoo", precision: 3, step: 1 },
  { symbol: "RTY=F", name: "E-mini Russell 2000", assetClass: "future", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "BZ=F", name: "Brent Crude Oil", assetClass: "future", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "ZB=F", name: "US Treasury Bond", assetClass: "future", currency: "USD", source: "yahoo", precision: 3, step: 1 },

  // ---- Forex ----
  { symbol: "EURUSD=X", name: "Euro / US Dollar", assetClass: "forex", currency: "USD", source: "yahoo", precision: 5, step: 1000 },
  { symbol: "GBPUSD=X", name: "British Pound / US Dollar", assetClass: "forex", currency: "USD", source: "yahoo", precision: 5, step: 1000 },
  { symbol: "USDJPY=X", name: "US Dollar / Japanese Yen", assetClass: "forex", currency: "USD", source: "yahoo", precision: 3, step: 1000 },
  { symbol: "AUDUSD=X", name: "Australian Dollar / US Dollar", assetClass: "forex", currency: "USD", source: "yahoo", precision: 5, step: 1000 },
  { symbol: "USDCHF=X", name: "US Dollar / Swiss Franc", assetClass: "forex", currency: "USD", source: "yahoo", precision: 5, step: 1000 },
  { symbol: "EURGBP=X", name: "Euro / British Pound", assetClass: "forex", currency: "EUR", source: "yahoo", precision: 5, step: 1000 },
  { symbol: "USDCAD=X", name: "US Dollar / Canadian Dollar", assetClass: "forex", currency: "USD", source: "yahoo", precision: 5, step: 1000 },
  { symbol: "NZDUSD=X", name: "New Zealand Dollar / US Dollar", assetClass: "forex", currency: "USD", source: "yahoo", precision: 5, step: 1000 },
  { symbol: "EURJPY=X", name: "Euro / Japanese Yen", assetClass: "forex", currency: "EUR", source: "yahoo", precision: 3, step: 1000 },
  { symbol: "GBPJPY=X", name: "British Pound / Japanese Yen", assetClass: "forex", currency: "GBP", source: "yahoo", precision: 3, step: 1000 },
  { symbol: "AUDJPY=X", name: "Australian Dollar / Japanese Yen", assetClass: "forex", currency: "AUD", source: "yahoo", precision: 3, step: 1000 },

  // ---- Metals ----
  { symbol: "GC=F", name: "Gold Spot Futures", assetClass: "metal", currency: "USD", source: "yahoo", precision: 2, step: 0.1 },
  { symbol: "SI=F", name: "Silver Futures", assetClass: "metal", currency: "USD", source: "yahoo", precision: 3, step: 1 },
  { symbol: "PL=F", name: "Platinum Futures", assetClass: "metal", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "PA=F", name: "Palladium Futures", assetClass: "metal", currency: "USD", source: "yahoo", precision: 2, step: 1 },
  { symbol: "HG=F", name: "Copper Futures", assetClass: "metal", currency: "USD", source: "yahoo", precision: 4, step: 1 },
];

export const INSTRUMENT_MAP: Record<string, Instrument> = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.symbol, i]),
);

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  crypto: "Crypto",
  stock: "Stocks",
  future: "Futures",
  forex: "Forex",
  metal: "Gold & Metals",
};

export const CURRENCIES = ["USD", "EUR", "GBP", "USDT", "BTC", "ETH"] as const;

/** Human-facing ticker, e.g. BTCUSDT -> BTC/USDT, EURUSD=X -> EUR/USD. */
export function displaySymbol(symbol: string): string {
  const inst = INSTRUMENT_MAP[symbol];
  if (!inst) return symbol;
  if (inst.assetClass === "crypto") return `${symbol.replace(/USDT$/, "")}/USDT`;
  if (inst.assetClass === "forex") {
    const base = symbol.replace("=X", "");
    return `${base.slice(0, 3)}/${base.slice(3)}`;
  }
  return symbol.replace("=F", "");
}

export function formatPrice(value: number, symbol?: string): string {
  const precision = symbol ? (INSTRUMENT_MAP[symbol]?.precision ?? 2) : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function formatMoney(value: number, currency = "USD"): string {
  const digits = currency === "BTC" ? 6 : 2;
  const formatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value < 0 ? "-" : ""}${formatted} ${currency}`;
}
