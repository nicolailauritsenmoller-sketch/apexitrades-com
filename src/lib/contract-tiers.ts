export type ContractTier = {
  seconds: number;
  label: string;
  minInvestment: number;
  profitPct: number;
};

/** Fixed-time contract tiers. Stakes are always settled in USDT. */
export const CONTRACT_TIERS: ContractTier[] = [
  { seconds: 60, label: "60 Seconds", minInvestment: 100, profitPct: 10 },
  { seconds: 120, label: "120 Seconds", minInvestment: 2000, profitPct: 15 },
  { seconds: 180, label: "180 Seconds", minInvestment: 8000, profitPct: 18.3 },
  { seconds: 3600, label: "1 Hour", minInvestment: 20000, profitPct: 20 },
  { seconds: 86400, label: "24 Hours", minInvestment: 50000, profitPct: 25 },
  { seconds: 604800, label: "7 Days", minInvestment: 80000, profitPct: 45 },
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
