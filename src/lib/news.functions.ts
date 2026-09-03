import { createServerFn } from "@tanstack/react-start";

export type NewsCategory = "crypto" | "gold" | "forex" | "futures" | "stocks";

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  category: NewsCategory;
  image: string | null;
  domain: string;
  excerpt: string;
  tickers: string[];
};

/** Headline keyword → tradable symbol used for the inline ticker badges. */
const TICKER_MAP: [RegExp, string][] = [
  [/\bbitcoin\b|\bbtc\b/i, "BTCUSDT"],
  [/\bethereum\b|\beth\b|\bether\b/i, "ETHUSDT"],
  [/\bsolana\b|\bsol\b/i, "SOLUSDT"],
  [/\bbnb\b|binance coin/i, "BNBUSDT"],
  [/\bxrp\b|\bripple\b/i, "XRPUSDT"],
  [/\bcardano\b|\bada\b/i, "ADAUSDT"],
  [/\bdogecoin\b|\bdoge\b/i, "DOGEUSDT"],
  [/\bavalanche\b|\bavax\b/i, "AVAXUSDT"],
  [/\btether\b|\busdt\b/i, "USDTUSD"],
  [/\bgold\b|\bxau\b|bullion/i, "XAUUSD=X"],
  [/\bnvidia\b|\bnvda\b/i, "NVDA"],
  [/\bapple\b|\baapl\b/i, "AAPL"],
  [/\btesla\b|\btsla\b/i, "TSLA"],
  [/\bmicrosoft\b|\bmsft\b/i, "MSFT"],
  [/\bamazon\b|\bamzn\b/i, "AMZN"],
  [/euro\b|\beur\/usd\b|\beurusd\b/i, "EURUSD=X"],
];

function detectTickers(text: string): string[] {
  const out: string[] = [];
  for (const [re, sym] of TICKER_MAP) {
    if (re.test(text) && !out.includes(sym)) out.push(sym);
    if (out.length >= 3) break;
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractImage(block: string): string | null {
  const candidates = [
    block.match(/<media:content[^>]*url="([^"]+)"/i)?.[1],
    block.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1],
    block.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i)?.[1],
    block.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1],
    block.match(/<img[^>]*src=\\?["']([^"'\\]+)/i)?.[1],
  ];
  for (const c of candidates) {
    if (c && /^https?:\/\//.test(c)) return c.replace(/&amp;/g, "&");
  }
  return null;
}

const FEEDS: { source: string; url: string; category: NewsCategory }[] = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "crypto" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss", category: "crypto" },
  { source: "Investing — Commodities", url: "https://www.investing.com/rss/news_11.rss", category: "gold" },
  { source: "Investing — Forex", url: "https://www.investing.com/rss/news_1.rss", category: "forex" },
  { source: "Investing — Futures", url: "https://www.investing.com/rss/news_95.rss", category: "futures" },
  { source: "Investing — Stocks", url: "https://www.investing.com/rss/news_25.rss", category: "stocks" },
];

function strip(input: string) {
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseRss(xml: string, source: string, category: NewsCategory): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.split(/<item[\s>]/).slice(1);
  for (const block of blocks.slice(0, 12)) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1];
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1];
    const date = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1];
    const desc =
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ??
      block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/)?.[1] ??
      "";
    if (!title) continue;
    const cleanTitle = strip(title);
    if (!cleanTitle) continue;
    const cleanUrl = link ? strip(link) : "";
    items.push({
      id: `${source}-${cleanTitle.slice(0, 60)}`,
      title: cleanTitle,
      source,
      url: cleanUrl,
      publishedAt: date ? new Date(strip(date)).toISOString() : new Date().toISOString(),
      category,
      image: extractImage(block),
      domain: hostOf(cleanUrl),
      excerpt: strip(desc).slice(0, 180),
      tickers: detectTickers(`${cleanTitle} ${strip(desc).slice(0, 200)}`),
    });
  }
  return items;
}

export const getMarketNews = createServerFn({ method: "GET" }).handler(
  async (): Promise<NewsItem[]> => {
    const results = await Promise.allSettled(
      FEEDS.map(async (f) => {
        const res = await fetch(f.url, {
          headers: { "user-agent": "Mozilla/5.0 VelocityTrade/1.0", accept: "application/rss+xml,text/xml,*/*" },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return [] as NewsItem[];
        return parseRss(await res.text(), f.source, f.category);
      }),
    );

    const all: NewsItem[] = [];
    for (const r of results) if (r.status === "fulfilled") all.push(...r.value);

    const seen = new Set<string>();
    return all
      .filter((n) => (seen.has(n.title) ? false : (seen.add(n.title), true)))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 60);
  },
);
