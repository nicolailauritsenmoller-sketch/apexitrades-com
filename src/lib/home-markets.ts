import type { Instrument } from "@/lib/instruments";
import type { Quote } from "@/lib/market-types";

export const HOME_MARKET_TABS = ["Favorites", "Hot", "TradFi", "Alpha", "New", "Gainers"] as const;
export type HomeMarketTab = (typeof HOME_MARKET_TABS)[number];
export type HomeMarketClass = "Crypto" | "Futures" | "Stocks";

export function highVolumeSymbols(instruments: Instrument[], quotes: Record<string, Quote>) {
  return new Set(instruments.filter(asset => {
    const quote = quotes[asset.symbol];
    return quote && !quote.stale && Number.isFinite(quote.volume) && (quote.volume ?? 0) > 0 && Number.isFinite(quote.price) && quote.price > 0;
  }).sort((a, b) => (quotes[b.symbol].volume ?? 0) * quotes[b.symbol].price - (quotes[a.symbol].volume ?? 0) * quotes[a.symbol].price).slice(0, 3).map(asset => asset.symbol));
}

export function homeMarketRows(instruments: Instrument[], quotes: Record<string, Quote>, favorites: string[], tab: HomeMarketTab, category: HomeMarketClass, search: string) {
  // There is no Alpha eligibility or listing-date source in the catalog.
  if (tab === "Alpha" || tab === "New") return [];
  const term = search.trim().toLowerCase();
  const rows = instruments.filter((asset) => {
    const matchesClass = category === "Crypto" ? asset.assetClass === "crypto" : category === "Stocks" ? asset.assetClass === "stock" : ["future", "energy", "agriculture", "rate"].includes(asset.assetClass);
    if (!matchesClass || (tab === "TradFi" && asset.assetClass === "crypto")) return false;
    if (tab === "Favorites" && !favorites.includes(asset.symbol)) return false;
    if (tab === "Gainers" && (!quotes[asset.symbol] || quotes[asset.symbol].stale || quotes[asset.symbol].changePercent <= 0)) return false;
    return !term || `${asset.symbol} ${asset.name}`.toLowerCase().includes(term);
  });
  if (tab === "Gainers") rows.sort((a, b) => quotes[b.symbol].changePercent - quotes[a.symbol].changePercent);
  // Hot ranks only comparable assets in the selected class by real traded volume.
  if (tab === "Hot") rows.sort((a, b) => {
    const aq = quotes[a.symbol];
    const bq = quotes[b.symbol];
    const av = aq && !aq.stale ? (aq.volume ?? 0) * aq.price : 0;
    const bv = bq && !bq.stale ? (bq.volume ?? 0) * bq.price : 0;
    return bv - av;
  });
  return rows;
}

export function sparklinePoints(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return "";
  const low = Math.min(...finite);
  const span = Math.max(...finite) - low;
  return finite.map((value, index) => `${(index / (finite.length - 1)) * 240},${span === 0 ? 40 : 72 - ((value - low) / span) * 64}`).join(" ");
}