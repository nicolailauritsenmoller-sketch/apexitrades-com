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

export const SAMPLE_LEAD_TRADER_COUNT = 5000;

const PREFIX = ["Alpha", "Delta", "Quant", "Apex", "Vector", "Sigma", "Atlas", "Nova", "Orion", "Helix", "Vertex", "Zenith", "Prime", "Strata", "Kappa", "Nimbus"];
const SUFFIX = ["Capital", "Desk", "Labs", "Systems", "Macro", "Flow", "Partners", "Quant", "Edge", "Arb", "Trend", "Basis"];
const STYLES: SampleLeadTrader["style"][] = ["Institutional", "Algorithmic", "Discretionary"];

function rand(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

let cache: SampleLeadTrader[] | null = null;

export function sampleLeadTraders(): SampleLeadTrader[] {
  if (cache) return cache;
  const rows: SampleLeadTrader[] = [];
  for (let i = 0; i < SAMPLE_LEAD_TRADER_COUNT; i++) {
    const r = (k: number) => rand(i * 7 + k);
    rows.push({
      id: `sample-${i}`,
      handle: `${PREFIX[Math.floor(r(1) * PREFIX.length)]}${SUFFIX[Math.floor(r(2) * SUFFIX.length)]}${100 + i}`,
      style: STYLES[Math.floor(r(3) * STYLES.length)],
      roiPct: Math.round((r(4) * 70 - 15) * 100) / 100,
      sharpe: Math.round((r(5) * 3.2 - 0.4) * 100) / 100,
      managedVolume: Math.round(20_000 + r(6) ** 3 * 25_000_000),
      followers: Math.round(r(0) ** 2.5 * 12_000),
    });
  }
  rows.sort((a, b) => b.roiPct - a.roiPct);
  cache = rows;
  return rows;
}

export function filterSampleLeadTraders(rows: SampleLeadTrader[], query: string, page: number, pageSize = 20) {
  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter(r => r.handle.toLowerCase().includes(q) || r.style.toLowerCase().includes(q)) : rows;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return { total: filtered.length, pages, page: current, rows: filtered.slice((current - 1) * pageSize, current * pageSize) };
}
