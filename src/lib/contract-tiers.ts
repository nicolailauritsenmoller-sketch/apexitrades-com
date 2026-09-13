export type ContractTier = {
  seconds: number;
  label: string;
  minInvestment: number;
  profitPct: number;
};

/** Fixed-time scalp contract tiers. Stakes are always settled in USDT. */
export const CONTRACT_TIERS: ContractTier[] = [
  { seconds: 60, label: "60s", minInvestment: 100, profitPct: 10 },
  { seconds: 120, label: "120s", minInvestment: 2000, profitPct: 15 },
  { seconds: 300, label: "300s", minInvestment: 8000, profitPct: 18.3 },
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
