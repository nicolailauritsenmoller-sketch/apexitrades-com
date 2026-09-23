export type ContractTier = {
  id: string;
  seconds: number;
  label: string;
  minInvestment: number;
  profitPct: number;
};

/** Fixed-time duration contract tiers. Stakes are always settled in USDT. */
export const CONTRACT_TIERS: ContractTier[] = [
  { id: "60s", seconds: 60, label: "60s", minInvestment: 100, profitPct: 10 },
  { id: "120s", seconds: 120, label: "120s", minInvestment: 2_000, profitPct: 12 },
  { id: "180s", seconds: 180, label: "180s", minInvestment: 8_000, profitPct: 15 },
  { id: "24h", seconds: 86_400, label: "24h", minInvestment: 15_000, profitPct: 25 },
  { id: "1d", seconds: 86_400, label: "1D", minInvestment: 20_000, profitPct: 30 },
  { id: "7d", seconds: 604_800, label: "7D", minInvestment: 50_000, profitPct: 50 },
];

export const CONTRACT_CURRENCY = "USDT";

export const TIER_MAP: Record<number, ContractTier> = Object.fromEntries(
  CONTRACT_TIERS.map((t) => [t.seconds, t]),
);

export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/** Brief order-clearing window shown before a contract finalises. */
export const SETTLEMENT_CLEARING_MS = 1500;
