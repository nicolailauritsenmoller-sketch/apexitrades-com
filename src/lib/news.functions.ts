import { createServerFn } from "@tanstack/react-start";

export type NewsCategory = "crypto" | "gold" | "forex" | "futures" | "stocks";

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  category: NewsCategory;
};

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
    if (!title) continue;
    const cleanTitle = strip(title);
    if (!cleanTitle) continue;
    items.push({
      id: `${source}-${cleanTitle.slice(0, 60)}`,
      title: cleanTitle,
      source,
      url: link ? strip(link) : "",
      publishedAt: date ? new Date(strip(date)).toISOString() : new Date().toISOString(),
      category,
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
