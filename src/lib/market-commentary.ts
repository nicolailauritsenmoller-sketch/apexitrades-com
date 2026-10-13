import type { NewsItem } from "./news.functions";

export const COMMENTARY_ROTATION_MS = 120_000;
export const COMMENTARY_SYMBOLS = ["BTCUSDT", "ETHUSDT", "XRPUSDT", "SOLUSDT", "BNBUSDT"];
const COMMENTARY = /\b(outlook|analysis|forecast|predict\w*|expect\w*|support|resistance|breakout|trend|technical|strategy|sentiment|psycholog\w*|risk|institutional|momentum|liquidity|accumulat\w*|distribution|price target)\b/i;
const TRUSTED_DOMAIN = /^(?:[a-z0-9-]+\.)*(tradingview\.com|binance\.com|kraken\.com|coingecko\.com|coinmarketcap\.com|crypto\.com|coindesk\.com|bloomberg\.com|reuters\.com)$/i;

export function rankExpertCommentary(items: NewsItem[]): NewsItem[] {
  return items
    .filter((item) => TRUSTED_DOMAIN.test(item.domain) && item.tickers.some((symbol) => COMMENTARY_SYMBOLS.includes(symbol)) && COMMENTARY.test(`${item.title} ${item.excerpt}`))
    .sort((a, b) => {
      const score = (item: NewsItem) => /support|resistance|technical|sentiment|institutional|forecast|price target/i.test(`${item.title} ${item.excerpt}`) ? 1 : 0;
      return score(b) - score(a) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    });
}

/** Balance available assets before cycling through the remaining ranked articles. */
export function commentaryPage(items: NewsItem[], cycle: number, pageSize = 5): NewsItem[] {
  if (!items.length) return [];
  const pool = [...items];
  const ordered: NewsItem[] = [];
  while (pool.length) {
    for (const symbol of COMMENTARY_SYMBOLS) {
      const index = pool.findIndex((item) => item.tickers.includes(symbol));
      if (index >= 0) ordered.push(...pool.splice(index, 1));
    }
    if (pool.length && !pool.some((item) => item.tickers.some((symbol) => COMMENTARY_SYMBOLS.includes(symbol)))) ordered.push(...pool.splice(0));
  }
  const count = Math.min(pageSize, ordered.length);
  const start = (cycle * count) % ordered.length;
  return Array.from({ length: count }, (_, index) => ordered[(start + index) % ordered.length]).filter((item): item is NewsItem => Boolean(item));
}

export function commentaryTopics(item: NewsItem): string[] {
  const text = `${item.title} ${item.excerpt}`;
  return [
    [/support|resistance|price level/i, "Key levels"],
    [/sentiment|psycholog|fear|greed/i, "Sentiment"],
    [/institutional|fund flow|accumulat|distribution/i, "Institutional outlook"],
    [/forecast|predict|price target|outlook|expect/i, "Forecast"],
    [/technical|breakout|momentum|trend/i, "Technical analysis"],
  ].flatMap(([pattern, label]) => pattern instanceof RegExp && pattern.test(text) ? [String(label)] : []).slice(0, 2);
}