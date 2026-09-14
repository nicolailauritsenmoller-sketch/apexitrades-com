import { createServerFn } from "@tanstack/react-start";

export type NewsCategory =
  | "stocks"
  | "crypto"
  | "defi"
  | "commodities"
  | "forex"
  | "macro"
  | "regulation";

export type NewsRegion = "global" | "us" | "ca" | "uk" | "eu";

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  category: NewsCategory;
  region: NewsRegion;
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

type Feed = {
  source: string;
  url: string;
  category: NewsCategory;
  region: NewsRegion;
  /** Google News aggregation feeds embed the publisher in the title suffix. */
  google?: boolean;
};

const gnews = (query: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:2d&hl=en-US&gl=US&ceid=US:en`;

const FEEDS: Feed[] = [
  /* ---------------------- Global & US financial media --------------------- */
  { source: "Investing.com", url: "https://www.investing.com/rss/news_25.rss", category: "stocks", region: "global" },
  { source: "Investing.com", url: "https://www.investing.com/rss/news_1.rss", category: "forex", region: "global" },
  { source: "Investing.com", url: "https://www.investing.com/rss/news_11.rss", category: "commodities", region: "global" },
  { source: "Investing.com", url: "https://www.investing.com/rss/news_95.rss", category: "macro", region: "global" },
  { source: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", category: "stocks", region: "us" },
  { source: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258", category: "crypto", region: "us" },
  { source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", category: "stocks", region: "us" },
  { source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse", category: "macro", region: "us" },
  { source: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex", category: "stocks", region: "us" },
  { source: "Reuters", url: gnews("site:reuters.com markets OR economy"), category: "macro", region: "global", google: true },
  { source: "Bloomberg", url: gnews("site:bloomberg.com markets"), category: "stocks", region: "global", google: true },
  { source: "Wall Street Journal", url: gnews("site:wsj.com markets"), category: "stocks", region: "us", google: true },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "crypto", region: "global" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss", category: "crypto", region: "global" },
  { source: "The Block", url: gnews("site:theblock.co defi OR protocol"), category: "defi", region: "global", google: true },
  { source: "Decrypt", url: gnews("site:decrypt.co defi OR web3"), category: "defi", region: "global", google: true },
  { source: "Bloomberg Crypto", url: gnews("site:bloomberg.com crypto OR bitcoin"), category: "crypto", region: "global", google: true },

  /* ------------------------- Canadian financial news ---------------------- */
  { source: "BNN Bloomberg", url: gnews("site:bnnbloomberg.ca"), category: "stocks", region: "ca", google: true },
  { source: "The Globe and Mail", url: gnews("site:theglobeandmail.com business investing"), category: "stocks", region: "ca", google: true },
  { source: "Financial Post", url: gnews("site:financialpost.com markets"), category: "stocks", region: "ca", google: true },

  /* ----------------------- UK & European financial news ------------------- */
  { source: "Financial Times", url: gnews("site:ft.com markets"), category: "macro", region: "uk", google: true },
  { source: "City A.M.", url: gnews("site:cityam.com markets OR economics"), category: "stocks", region: "uk", google: true },
  { source: "The Telegraph Business", url: gnews("site:telegraph.co.uk business economy"), category: "macro", region: "uk", google: true },

  /* ------------------- Regulatory & institutional sources ----------------- */
  { source: "SEC", url: "https://www.sec.gov/news/pressreleases.rss", category: "regulation", region: "us" },
  { source: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml", category: "macro", region: "us" },
  { source: "CFTC", url: gnews("site:cftc.gov press release"), category: "regulation", region: "us", google: true },
  { source: "Nasdaq", url: gnews("Nasdaq listing OR exchange announcement"), category: "regulation", region: "us", google: true },
  { source: "NYSE", url: gnews("NYSE exchange announcement OR listing"), category: "regulation", region: "us", google: true },
  { source: "CME Group", url: gnews("CME Group futures announcement"), category: "commodities", region: "us", google: true },
  { source: "Ontario Securities Commission", url: gnews("Ontario Securities Commission"), category: "regulation", region: "ca", google: true },
  { source: "Bank of Canada", url: gnews("Bank of Canada rate OR policy"), category: "macro", region: "ca", google: true },
  { source: "CIRO", url: gnews("CIRO Canadian Investment Regulatory Organization"), category: "regulation", region: "ca", google: true },
  { source: "TMX / TSX", url: gnews("TSX OR TMX Group Toronto Stock Exchange"), category: "stocks", region: "ca", google: true },
];

function strip(input: string) {
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** Keyword classifier — refines the feed's default category per headline. */
const CLASSIFIERS: [RegExp, NewsCategory][] = [
  [/\b(sec|cftc|finra|regulat\w+|lawsuit|enforcement|compliance|sanction|fine[sd]?\b|settlement|court|approval of)\b/i, "regulation"],
  [/\b(defi|decentralized finance|dex\b|uniswap|aave|lido|makerdao|yield farm\w*|liquidity pool|staking|tvl\b|lending protocol|on-?chain|web3)\b/i, "defi"],
  [/\b(bitcoin|ethereum|crypto\w*|blockchain|token|stablecoin|solana|xrp|altcoin|etf inflow)\b/i, "crypto"],
  [/\b(gold|silver|oil|crude|brent|natural gas|copper|wheat|corn|soybean|commodit\w+|opec|bullion)\b/i, "commodities"],
  [/\b(forex|currency|currencies|dollar index|yen|euro|sterling|pound|fx market|usd\/|eur\/|gbp\/)\b/i, "forex"],
  [/\b(federal reserve|\bfed\b|fomc|interest rate|inflation|cpi|gdp|central bank|ecb|boe|boj|monetary policy|jobs report|payrolls|yield curve|treasur\w+)\b/i, "macro"],
  [/\b(stock|shares|equit\w+|earnings|nasdaq|s&p|dow jones|ipo|buyback|guidance)\b/i, "stocks"],
];

function classify(text: string, fallback: NewsCategory): NewsCategory {
  for (const [re, cat] of CLASSIFIERS) if (re.test(text)) return cat;
  return fallback;
}

function parseRss(xml: string, feed: Feed): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.split(/<item[\s>]/).slice(1);
  for (const block of blocks.slice(0, 12)) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1];
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1];
    const date =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1] ??
      block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/)?.[1] ??
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1];
    const desc =
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ??
      block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/)?.[1] ??
      "";
    if (!title) continue;
    let cleanTitle = strip(title);
    if (!cleanTitle) continue;
    // Google News suffixes the publisher: "Headline - Reuters"
    if (feed.google) cleanTitle = cleanTitle.replace(/\s+-\s+[^-]{2,40}$/, "").trim();
    const cleanUrl = link ? strip(link) : "";
    const excerpt = feed.google ? "" : strip(desc).slice(0, 180);
    const blob = `${cleanTitle} ${excerpt}`;
    items.push({
      id: `${feed.source}-${cleanTitle.slice(0, 70)}`,
      title: cleanTitle,
      source: feed.source,
      url: cleanUrl,
      publishedAt: date ? new Date(strip(date)).toISOString() : new Date().toISOString(),
      category: classify(blob, feed.category),
      region: feed.region,
      image: extractImage(block),
      domain: feed.google ? guessDomain(feed.source) : hostOf(cleanUrl),
      excerpt,
      tickers: detectTickers(blob),
    });
  }
  return items;
}

const DOMAINS: Record<string, string> = {
  Reuters: "reuters.com",
  Bloomberg: "bloomberg.com",
  "Wall Street Journal": "wsj.com",
  "BNN Bloomberg": "bnnbloomberg.ca",
  "The Globe and Mail": "theglobeandmail.com",
  "Financial Post": "financialpost.com",
  "Financial Times": "ft.com",
  "City A.M.": "cityam.com",
  "The Telegraph Business": "telegraph.co.uk",
  CFTC: "cftc.gov",
  Nasdaq: "nasdaq.com",
  NYSE: "nyse.com",
  "CME Group": "cmegroup.com",
  "Ontario Securities Commission": "osc.ca",
  "Bank of Canada": "bankofcanada.ca",
  CIRO: "ciro.ca",
  "TMX / TSX": "tmx.com",
  "The Block": "theblock.co",
  Decrypt: "decrypt.co",
  "Bloomberg Crypto": "bloomberg.com",
};

function guessDomain(source: string) {
  return DOMAINS[source] ?? "";
}

export const getMarketNews = createServerFn({ method: "GET" }).handler(
  async (): Promise<NewsItem[]> => {
    const results = await Promise.allSettled(
      FEEDS.map(async (f) => {
        const res = await fetch(f.url, {
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; VelocityTradeNews/1.0)",
            accept: "application/rss+xml,application/xml,text/xml,*/*",
          },
          signal: AbortSignal.timeout(7000),
        });
        if (!res.ok) return [] as NewsItem[];
        return parseRss(await res.text(), f);
      }),
    );

    const all: NewsItem[] = [];
    for (const r of results) if (r.status === "fulfilled") all.push(...r.value);

    const seen = new Set<string>();
    const cutoff = Date.now() - 1000 * 60 * 60 * 96;
    return all
      .filter((n) => {
        const key = n.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        const ts = new Date(n.publishedAt).getTime();
        return Number.isFinite(ts) && ts > cutoff;
      })
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 120);
  },
);
