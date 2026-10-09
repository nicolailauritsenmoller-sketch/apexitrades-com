/** Per-chain receiving-address format rules shared by the console UI and server. */
export const ADDRESS_ASSETS: Record<string, string[]> = {
  BTC: ["Bitcoin"],
  ETH: ["ERC20"],
  USDT: ["TRC20", "ERC20", "BEP20", "SOL"],
  USDC: ["ERC20", "BEP20", "SOL"],
  BNB: ["BEP20"],
  SOL: ["SOL"],
  XRP: ["XRP"],
  XLM: ["XLM"],
};

/** Networks whose deposits need a destination tag / memo. */
export function memoRequired(network: string) {
  const n = network.toUpperCase();
  return n === "XRP" || n === "XLM";
}

export function validateAddress(network: string, address: string, memo?: string | null): string | null {
  const n = network.toUpperCase();
  const a = address.trim();
  const ok =
    n.includes("TRC") ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)
    : n.includes("ERC") || n.includes("BEP") || n.includes("BSC") ? /^0x[0-9a-fA-F]{40}$/.test(a)
    : n.includes("BITCOIN") || n === "BTC" ? /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a)
    : n === "SOL" ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)
    : n === "XRP" ? /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)
    : n === "XLM" ? /^G[A-Z2-7]{55}$/.test(a)
    : a.length >= 20;
  if (!ok) return `Invalid ${network} address format.`;
  if (memoRequired(n)) {
    const m = (memo ?? "").trim();
    if (!m) return `${network} deposits require a tag / memo.`;
    if (n === "XRP" && !/^\d{1,10}$/.test(m)) return "XRP destination tag must be numeric (up to 10 digits).";
    if (n === "XLM" && m.length > 28) return "XLM memo must be 28 characters or fewer.";
  }
  return null;
}

export const ADDRESS_STATUS = [
  { id: "active", label: "Active (Accepting Deposits)" },
  { id: "paused", label: "Paused" },
  { id: "deprecated", label: "Deprecated / Archive" },
] as const;

export const ALLOCATION_MODES = [
  { id: "master", label: "Master Deposit Wallet" },
  { id: "hot_sweep", label: "Hot Wallet / Auto-Sweep Target" },
  { id: "vip_desk", label: "Dedicated VIP Desk" },
] as const;
