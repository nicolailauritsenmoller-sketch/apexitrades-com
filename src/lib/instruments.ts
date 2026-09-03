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

// ---- Builders keep the catalog compact and consistent ----
const crypto = (base: string, name: string, precision = 4, step = 1): Instrument => ({
  symbol: `${base}USDT`,
  name,
  assetClass: "crypto",
  currency: "USDT",
  source: "binance",
  precision,
  step,
});

const stock = (symbol: string, name: string): Instrument => ({
  symbol,
  name,
  assetClass: "stock",
  currency: "USD",
  source: "yahoo",
  precision: 2,
  step: 1,
});

const future = (symbol: string, name: string, precision = 2): Instrument => ({
  symbol,
  name,
  assetClass: "future",
  currency: "USD",
  source: "yahoo",
  precision,
  step: 1,
});

const forex = (pair: string, name: string, precision = 5, currency = "USD"): Instrument => ({
  symbol: `${pair}=X`,
  name,
  assetClass: "forex",
  currency,
  source: "yahoo",
  precision,
  step: 1000,
});

const metal = (symbol: string, name: string, precision = 2, step = 1): Instrument => ({
  symbol,
  name,
  assetClass: "metal",
  currency: "USD",
  source: "yahoo",
  precision,
  step,
});

const CRYPTO: Instrument[] = [
  crypto("BTC", "Bitcoin", 2, 0.001),
  crypto("ETH", "Ethereum", 2, 0.01),
  crypto("SOL", "Solana", 3, 0.1),
  crypto("XRP", "XRP", 4, 1),
  crypto("BNB", "BNB", 2, 0.01),
  crypto("DOGE", "Dogecoin", 5, 10),
  crypto("ADA", "Cardano", 4, 1),
  crypto("AVAX", "Avalanche", 3, 0.1),
  crypto("LINK", "Chainlink", 3, 0.1),
  crypto("TON", "Toncoin", 4, 1),
  crypto("SUI", "Sui", 4, 1),
  crypto("NEAR", "NEAR Protocol", 4, 1),
  crypto("APT", "Aptos", 4, 1),
  crypto("ATOM", "Cosmos", 4, 0.1),
  crypto("POL", "Polygon (POL)", 5, 10),
  crypto("PEPE", "Pepe", 8, 1000000),
  crypto("SHIB", "Shiba Inu", 8, 100000),
  crypto("LTC", "Litecoin", 2, 0.1),
  crypto("BCH", "Bitcoin Cash", 2, 0.01),
  crypto("TRX", "TRON", 5, 10),
  crypto("DOT", "Polkadot", 3, 1),
  crypto("UNI", "Uniswap", 3, 0.1),
  crypto("ETC", "Ethereum Classic", 3, 0.1),
  crypto("FIL", "Filecoin", 3, 0.1),
  crypto("ICP", "Internet Computer", 3, 0.1),
  crypto("HBAR", "Hedera", 5, 10),
  crypto("ARB", "Arbitrum", 4, 1),
  crypto("OP", "Optimism", 4, 1),
  crypto("INJ", "Injective", 3, 0.1),
  crypto("SEI", "Sei", 5, 10),
  crypto("TIA", "Celestia", 4, 1),
  crypto("RUNE", "THORChain", 4, 1),
  crypto("AAVE", "Aave", 2, 0.01),
  crypto("MKR", "Maker", 1, 0.001),
  crypto("LDO", "Lido DAO", 4, 1),
  crypto("STX", "Stacks", 4, 1),
  crypto("IMX", "Immutable", 4, 1),
  crypto("GRT", "The Graph", 5, 10),
  crypto("SAND", "The Sandbox", 5, 10),
  crypto("MANA", "Decentraland", 5, 10),
  crypto("AXS", "Axie Infinity", 4, 1),
  crypto("GALA", "Gala", 6, 100),
  crypto("CHZ", "Chiliz", 6, 100),
  crypto("ENJ", "Enjin Coin", 5, 10),
  crypto("FTM", "Fantom", 5, 10),
  crypto("ALGO", "Algorand", 5, 10),
  crypto("VET", "VeChain", 6, 100),
  crypto("EOS", "EOS", 4, 1),
  crypto("XLM", "Stellar", 5, 10),
  crypto("XTZ", "Tezos", 4, 1),
  crypto("THETA", "Theta Network", 4, 1),
  crypto("EGLD", "MultiversX", 2, 0.01),
  crypto("FLOW", "Flow", 4, 1),
  crypto("KAVA", "Kava", 4, 1),
  crypto("ZIL", "Zilliqa", 6, 100),
  crypto("IOTA", "IOTA", 5, 10),
  crypto("NEO", "Neo", 3, 0.1),
  crypto("QNT", "Quant", 2, 0.01),
  crypto("CRV", "Curve DAO", 5, 10),
  crypto("COMP", "Compound", 2, 0.01),
  crypto("SNX", "Synthetix", 4, 1),
  crypto("1INCH", "1inch", 5, 10),
  crypto("DYDX", "dYdX", 4, 1),
  crypto("SUSHI", "SushiSwap", 4, 1),
  crypto("YFI", "yearn.finance", 1, 0.001),
  crypto("BAT", "Basic Attention", 5, 10),
  crypto("ZRX", "0x Protocol", 5, 10),
  crypto("ANKR", "Ankr", 6, 100),
  crypto("CELO", "Celo", 4, 1),
  crypto("ROSE", "Oasis Network", 6, 100),
  crypto("ONE", "Harmony", 6, 100),
  crypto("WLD", "Worldcoin", 4, 1),
  crypto("JUP", "Jupiter", 5, 10),
  crypto("PYTH", "Pyth Network", 5, 10),
  crypto("JTO", "Jito", 4, 1),
  crypto("BONK", "Bonk", 8, 1000000),
  crypto("WIF", "dogwifhat", 4, 1),
  crypto("FLOKI", "Floki", 8, 100000),
  crypto("ORDI", "ORDI", 3, 0.1),
  crypto("BLUR", "Blur", 5, 10),
  crypto("APE", "ApeCoin", 4, 1),
  crypto("GMT", "STEPN", 5, 10),
  crypto("MASK", "Mask Network", 4, 1),
  crypto("CFX", "Conflux", 5, 10),
  crypto("MINA", "Mina Protocol", 4, 1),
  crypto("KSM", "Kusama", 2, 0.01),
  crypto("DASH", "Dash", 2, 0.01),
  crypto("ZEC", "Zcash", 2, 0.01),
  crypto("XMR", "Monero", 2, 0.01),
  crypto("WAVES", "Waves", 3, 0.1),
  crypto("CAKE", "PancakeSwap", 4, 1),
  crypto("RNDR", "Render", 4, 1),
  crypto("FET", "Artificial Superintelligence", 4, 1),
  crypto("AGIX", "SingularityNET", 5, 10),
  crypto("OCEAN", "Ocean Protocol", 5, 10),
  crypto("ARKM", "Arkham", 4, 1),
  crypto("AR", "Arweave", 3, 0.1),
  crypto("KAS", "Kaspa", 6, 100),
  crypto("STRK", "Starknet", 5, 10),
  crypto("ENA", "Ethena", 5, 10),
  crypto("W", "Wormhole", 5, 10),
  crypto("PENDLE", "Pendle", 4, 1),
  crypto("ETHFI", "ether.fi", 4, 1),
];

const STOCKS: Instrument[] = [
  stock("AAPL", "Apple Inc."),
  stock("NVDA", "NVIDIA Corp."),
  stock("TSLA", "Tesla Inc."),
  stock("MSFT", "Microsoft Corp."),
  stock("AMZN", "Amazon.com Inc."),
  stock("META", "Meta Platforms"),
  stock("AMD", "Advanced Micro Devices"),
  stock("COIN", "Coinbase Global"),
  stock("GOOGL", "Alphabet Inc."),
  stock("NFLX", "Netflix Inc."),
  stock("INTC", "Intel Corp."),
  stock("MU", "Micron Technology"),
  stock("QCOM", "Qualcomm Inc."),
  stock("AVGO", "Broadcom Inc."),
  stock("ORCL", "Oracle Corp."),
  stock("CRM", "Salesforce Inc."),
  stock("ADBE", "Adobe Inc."),
  stock("PLTR", "Palantir Technologies"),
  stock("UBER", "Uber Technologies"),
  stock("ABNB", "Airbnb Inc."),
  stock("SHOP", "Shopify Inc."),
  stock("SQ", "Block Inc."),
  stock("PYPL", "PayPal Holdings"),
  stock("MSTR", "MicroStrategy"),
  stock("MARA", "MARA Holdings"),
  stock("RIOT", "Riot Platforms"),
  stock("HOOD", "Robinhood Markets"),
  stock("BABA", "Alibaba Group"),
  stock("JPM", "JPMorgan Chase"),
  stock("GS", "Goldman Sachs"),
  stock("BAC", "Bank of America"),
  stock("MS", "Morgan Stanley"),
  stock("V", "Visa Inc."),
  stock("MA", "Mastercard Inc."),
  stock("BRK-B", "Berkshire Hathaway"),
  stock("WMT", "Walmart Inc."),
  stock("COST", "Costco Wholesale"),
  stock("KO", "Coca-Cola Co."),
  stock("PEP", "PepsiCo Inc."),
  stock("MCD", "McDonald's Corp."),
  stock("NKE", "Nike Inc."),
  stock("SBUX", "Starbucks Corp."),
  stock("DIS", "Walt Disney Co."),
  stock("BA", "Boeing Co."),
  stock("CAT", "Caterpillar Inc."),
  stock("GE", "General Electric"),
  stock("F", "Ford Motor Co."),
  stock("GM", "General Motors"),
  stock("XOM", "Exxon Mobil"),
  stock("CVX", "Chevron Corp."),
  stock("PFE", "Pfizer Inc."),
  stock("JNJ", "Johnson & Johnson"),
  stock("MRK", "Merck & Co."),
  stock("LLY", "Eli Lilly & Co."),
  stock("UNH", "UnitedHealth Group"),
  stock("T", "AT&T Inc."),
  stock("VZ", "Verizon Communications"),
  stock("CSCO", "Cisco Systems"),
  stock("IBM", "IBM Corp."),
  stock("TSM", "Taiwan Semiconductor"),
  stock("ASML", "ASML Holding"),
  stock("SNOW", "Snowflake Inc."),
  stock("CRWD", "CrowdStrike Holdings"),
  stock("NET", "Cloudflare Inc."),
  stock("SPOT", "Spotify Technology"),
  stock("RIVN", "Rivian Automotive"),
  stock("LCID", "Lucid Group"),
  stock("SOFI", "SoFi Technologies"),
];

const FUTURES: Instrument[] = [
  future("ES=F", "E-mini S&P 500"),
  future("NQ=F", "E-mini Nasdaq 100"),
  future("YM=F", "E-mini Dow"),
  future("RTY=F", "E-mini Russell 2000"),
  future("LE=F", "Live Cattle", 3),
  future("HE=F", "Lean Hogs", 3),
  future("VX=F", "VIX Futures"),
  future("BTC=F", "CME Bitcoin Futures"),
  future("MES=F", "Micro E-mini S&P 500"),
  future("MNQ=F", "Micro E-mini Nasdaq"),
];

const ETFS: Instrument[] = [
  fund_("SPY", "SPDR S&P 500 ETF Trust", "etf"),
  fund_("QQQ", "Invesco QQQ Trust", "etf"),
  fund_("IWM", "iShares Russell 2000 ETF", "etf"),
  fund_("DIA", "SPDR Dow Jones Industrial Average ETF", "etf"),
  fund_("VTI", "Vanguard Total Stock Market ETF", "etf"),
  fund_("GLD", "SPDR Gold Shares", "etf"),
  fund_("SLV", "iShares Silver Trust", "etf"),
  fund_("TLT", "iShares 20+ Year Treasury Bond ETF", "etf"),
];

const INDICES: Instrument[] = [
  index_("^GSPC", "S&P 500 Index"),
  index_("^NDX", "Nasdaq-100 Index"),
  index_("^DJI", "Dow Jones Industrial Average"),
  index_("^RUT", "Russell 2000 Index"),
  index_("^VIX", "CBOE Volatility Index"),
];

const ENERGY: Instrument[] = [
  energy("CL=F", "WTI Crude Oil Futures"),
  energy("MCL=F", "Micro WTI Crude Oil Futures"),
  energy("NG=F", "Natural Gas Futures", 3),
  energy("BZ=F", "Brent Crude Oil Futures"),
  energy("HO=F", "Heating Oil Futures", 4),
  energy("RB=F", "RBOB Gasoline Futures", 4),
];

const AGRICULTURE: Instrument[] = [
  agri("ZC=F", "Corn Futures"),
  agri("ZS=F", "Soybean Futures"),
  agri("ZW=F", "Wheat Futures"),
  agri("ZL=F", "Soybean Oil Futures", 3),
  agri("KC=F", "Coffee Futures"),
  agri("SB=F", "Sugar Futures", 3),
  agri("CC=F", "Cocoa Futures"),
  agri("CT=F", "Cotton Futures", 3),
];

const BONDS: Instrument[] = [
  bond("2YY=F", "2-Year Treasury Yield", 3),
  bond("^FVX", "5-Year Treasury Yield", 3),
  bond("^TNX", "10-Year Treasury Yield", 3),
  bond("^TYX", "30-Year Treasury Yield", 3),
];

const OPTIONS: Instrument[] = [
  option("SPY.OPT", "SPY Options (At-the-money)"),
  option("QQQ.OPT", "QQQ Options (At-the-money)"),
  option("AAPL.OPT", "AAPL Options (At-the-money)"),
  option("NVDA.OPT", "NVDA Options (At-the-money)"),
  option("TSLA.OPT", "TSLA Options (At-the-money)"),
  option("SPX.OPT", "SPX Index Options"),
];

const RATES: Instrument[] = [
  rate("SR3=F", "3-Month SOFR Futures", 3),
  rate("ZQ=F", "30-Day Fed Funds Futures", 3),
  rate("ZT=F", "2-Year T-Note Futures", 3),
  rate("ZF=F", "5-Year T-Note Futures", 3),
  rate("ZN=F", "10-Year T-Note Futures", 3),
  rate("ZB=F", "30-Year T-Bond Futures", 3),
];

const REITS: Instrument[] = [
  fund_("VNQ", "Vanguard Real Estate ETF", "reit"),
  fund_("IYR", "iShares U.S. Real Estate ETF", "reit"),
  fund_("XLRE", "Real Estate Select Sector SPDR", "reit"),
];

const MUTUAL_FUNDS: Instrument[] = [
  fund_("SPAXX", "Fidelity Government Money Market Fund", "fund"),
  fund_("VFIAX", "Vanguard 500 Index Fund Admiral", "fund"),
  fund_("VTSAX", "Vanguard Total Stock Market Index Fund", "fund"),
  fund_("VBTLX", "Vanguard Total Bond Market Index Fund", "fund"),
];


const FOREX: Instrument[] = [
  forex("EURUSD", "Euro / US Dollar"),
  forex("GBPUSD", "British Pound / US Dollar"),
  forex("USDJPY", "US Dollar / Japanese Yen", 3),
  forex("AUDUSD", "Australian Dollar / US Dollar"),
  forex("USDCHF", "US Dollar / Swiss Franc"),
  forex("USDCAD", "US Dollar / Canadian Dollar"),
  forex("NZDUSD", "New Zealand Dollar / US Dollar"),
  forex("EURGBP", "Euro / British Pound", 5, "EUR"),
  forex("EURJPY", "Euro / Japanese Yen", 3, "EUR"),
  forex("GBPJPY", "British Pound / Japanese Yen", 3, "GBP"),
  forex("AUDJPY", "Australian Dollar / Japanese Yen", 3, "AUD"),
  forex("CHFJPY", "Swiss Franc / Japanese Yen", 3, "CHF"),
  forex("CADJPY", "Canadian Dollar / Japanese Yen", 3, "CAD"),
  forex("NZDJPY", "New Zealand Dollar / Japanese Yen", 3, "NZD"),
  forex("EURCHF", "Euro / Swiss Franc", 5, "EUR"),
  forex("EURAUD", "Euro / Australian Dollar", 5, "EUR"),
  forex("EURCAD", "Euro / Canadian Dollar", 5, "EUR"),
  forex("EURNZD", "Euro / New Zealand Dollar", 5, "EUR"),
  forex("GBPCHF", "British Pound / Swiss Franc", 5, "GBP"),
  forex("GBPAUD", "British Pound / Australian Dollar", 5, "GBP"),
  forex("GBPCAD", "British Pound / Canadian Dollar", 5, "GBP"),
  forex("GBPNZD", "British Pound / New Zealand Dollar", 5, "GBP"),
  forex("AUDCAD", "Australian Dollar / Canadian Dollar", 5, "AUD"),
  forex("AUDCHF", "Australian Dollar / Swiss Franc", 5, "AUD"),
  forex("AUDNZD", "Australian Dollar / New Zealand Dollar", 5, "AUD"),
  forex("NZDCAD", "New Zealand Dollar / Canadian Dollar", 5, "NZD"),
  forex("NZDCHF", "New Zealand Dollar / Swiss Franc", 5, "NZD"),
  forex("CADCHF", "Canadian Dollar / Swiss Franc", 5, "CAD"),
  forex("USDSEK", "US Dollar / Swedish Krona", 4),
  forex("USDNOK", "US Dollar / Norwegian Krone", 4),
  forex("USDMXN", "US Dollar / Mexican Peso", 4),
  forex("USDZAR", "US Dollar / South African Rand", 4),
  forex("USDSGD", "US Dollar / Singapore Dollar", 4),
  forex("USDHKD", "US Dollar / Hong Kong Dollar", 4),
  forex("USDTRY", "US Dollar / Turkish Lira", 4),
  forex("USDCNY", "US Dollar / Chinese Yuan", 4),
];

const METALS: Instrument[] = [
  metal("XAUUSD=X", "Gold / US Dollar", 2, 0.1),
  metal("GC=F", "Gold Futures", 2, 0.1),
  metal("MGC=F", "Micro Gold Futures", 2, 0.1),
  metal("1OZ=F", "1-Ounce Gold Futures", 2, 0.1),
  metal("XAUEUR=X", "Gold / Euro", 2, 0.1),
  metal("XAUGBP=X", "Gold / British Pound", 2, 0.1),
  metal("XAUJPY=X", "Gold / Japanese Yen", 0, 0.1),
  metal("SI=F", "Silver Futures", 3, 1),
  metal("PL=F", "Platinum Futures", 2, 1),
  metal("PA=F", "Palladium Futures", 2, 1),
  metal("HG=F", "Copper Futures", 4, 1),
  metal("SIL=F", "Micro Silver Futures", 3, 1),
  metal("XAGUSD=X", "Silver Spot / US Dollar", 3, 1),
  metal("ALI=F", "Aluminum Futures", 2, 1),

];

export const INSTRUMENTS: Instrument[] = [
  ...CRYPTO,
  ...STOCKS,
  ...FUTURES,
  ...FOREX,
  ...METALS,
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
  if (inst.assetClass === "forex" || symbol.endsWith("=X")) {
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
