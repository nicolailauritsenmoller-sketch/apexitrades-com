// Illustrative-only lead trader rows. Never used for copy execution, rankings or allocation.
export type SampleLeadTrader = {
  id: string;
  handle: string;
  style: "Institutional" | "Algorithmic" | "Discretionary";
  roiPct: number;
  sharpe: number;
  managedVolume: number;
  followers: number;
};

export const SAMPLE_LEAD_TRADER_COUNT = 15000;

const PREFIX = ["Alpha", "Delta", "Quant", "Apex", "Vector", "Sigma", "Atlas", "Nova", "Orion", "Helix", "Vertex", "Zenith", "Prime", "Strata", "Kappa", "Nimbus"];
const SUFFIX = ["Capital", "Desk", "Labs", "Systems", "Macro", "Flow", "Partners", "Quant", "Edge", "Arb", "Trend", "Basis"];
const FIRST = [
  "James","Emily","Michael","Ashley","Tyler","Madison","Brandon","Hailey", // American
  "Liam","Chloe","Ethan","Avery","Logan","Brooke","Owen","Claire", // Canadian
  "Oliver","Amelia","Harry","Isla","George","Poppy","Alfie","Imogen", // British
  "Jack","Matilda","Lachlan","Ruby","Cooper","Mia","Riley","Zara", // Australian
];
const LAST = [
  "Johnson","Miller","Davis","Walker","Anderson","Carter",
  "Tremblay","Gagnon","Roy","Campbell","Fraser","Leblanc",
  "Smith","Taylor","Hughes","Evans","Wright","Clarke",
  "Nguyen","Kelly","Murphy","Ryan","Mitchell","Harris",
];
const STYLES: SampleLeadTrader["style"][] = ["Institutional", "Algorithmic", "Discretionary"];

function rand(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const SAMPLE_REFRESH_MS = 3 * 60 * 1000;
export const currentSampleBucket = (now = Date.now()) => Math.floor(now / SAMPLE_REFRESH_MS);

let cache: { bucket: number; rows: SampleLeadTrader[] } | null = null;

// Metrics drift slightly per 3-minute bucket so the illustrative table refreshes over time.
export function sampleLeadTraders(bucket = 0): SampleLeadTrader[] {
  if (cache && cache.bucket === bucket) return cache.rows;
  const rows: SampleLeadTrader[] = [];
  for (let i = 0; i < SAMPLE_LEAD_TRADER_COUNT; i++) {
    const r = (k: number) => rand(i * 7 + k);
    const d = (k: number) => rand(i * 13 + k + bucket * 104729) - 0.5;
    rows.push({
      id: `sample-${i}`,
      handle: i % 3 === 0 ? `${PREFIX[Math.floor(r(1) * PREFIX.length)]}${SUFFIX[Math.floor(r(2) * SUFFIX.length)]}${100 + i}` : `${FIRST[Math.floor(r(1) * FIRST.length)]}${LAST[Math.floor(r(2) * LAST.length)]}${10 + (i % 990)}`,
      style: STYLES[Math.floor(r(3) * STYLES.length)],
      roiPct: Math.round((r(4) * 70 - 15 + d(1) * 3) * 100) / 100,
      sharpe: Math.round((r(5) * 3.2 - 0.4 + d(2) * 0.1) * 100) / 100,
      // Retail-scale managed volume: 30-day range stays inside $45K-$480K even after drift.
      managedVolume: Math.min(480_000, Math.max(45_000, Math.round(45_000 + r(6) * 435_000 * (1 + d(3) * 0.04)))),
      followers: Math.round(r(0) ** 2.5 * 12_000 + bucket % 1000 * r(8) * 0.5),
    });
  }
  rows.sort((a, b) => b.roiPct - a.roiPct);
  cache = { bucket, rows };
  return rows;
}

export function filterSampleLeadTraders(rows: SampleLeadTrader[], query: string, page: number, pageSize = 20) {
  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter(r => r.handle.toLowerCase().includes(q) || r.style.toLowerCase().includes(q)) : rows;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return { total: filtered.length, pages, page: current, rows: filtered.slice((current - 1) * pageSize, current * pageSize) };
}
