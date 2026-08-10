/** Shared helpers for deposit / withdrawal transaction presentation. */

export type TxType = "deposit" | "withdrawal" | "swap";
export type TxStatus = "pending" | "successful" | "failed";

export type TransactionRecord = {
  id: string;
  type: TxType;
  status: TxStatus;
  rawStatus: string;
  asset: string;
  amount: number;
  network: string | null;
  address: string | null;
  txHash: string | null;
  note: string | null;
  createdAt: string;
  /** Human readable summary, used in list rows. */
  title: string;
  subtitle: string;
};

export const CURRENCY_NAME: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  USDT: "Tether",
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XAU: "Gold",
};

export function assetName(code: string): string {
  return CURRENCY_NAME[code.toUpperCase()] ?? code.toUpperCase();
}

/** Maps the backend approval status onto a bank-grade transaction status. */
export function toTxStatus(raw: string): TxStatus {
  if (raw === "approved") return "successful";
  if (raw === "rejected") return "failed";
  return "pending";
}

export const STATUS_STYLE: Record<TxStatus, { label: string; badge: string; dot: string }> = {
  pending: {
    label: "Pending",
    badge: "border-amber-400/40 bg-amber-400/10 text-amber-400",
    dot: "bg-amber-400",
  },
  successful: {
    label: "Successful",
    badge: "border-bull/40 bg-bull/10 text-bull",
    dot: "bg-bull",
  },
  failed: {
    label: "Failed",
    badge: "border-bear/40 bg-bear/10 text-bear",
    dot: "bg-bear",
  },
};

const FIAT = new Set(["USD", "EUR", "GBP"]);

/** Estimated time of arrival based on the rail the transfer settles on. */
export function estimateEta(type: TxType, asset: string, network: string | null): string {
  const net = (network ?? "").toLowerCase();
  if (net.includes("bank") || FIAT.has(asset.toUpperCase())) return "1 – 3 business days";
  if (net.includes("bitcoin")) return "30 – 60 minutes";
  if (net.includes("erc")) return "10 – 30 minutes";
  if (net.includes("trc") || net.includes("bep")) return "5 – 15 minutes";
  return type === "deposit" ? "10 – 30 minutes" : "10 – 30 minutes";
}

export function shortenAddress(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}

export function statusMessage(type: TxType, status: TxStatus): string {
  if (status === "failed") {
    return type === "withdrawal"
      ? "This withdrawal was declined. Any reserved funds remain in your wallet — contact support for the full reason."
      : "This deposit could not be confirmed. Please check the transaction details and contact support.";
  }
  if (status === "successful") {
    return type === "withdrawal"
      ? "Your withdrawal request has been processed. The funds will be transferred to your destination wallet shortly."
      : "Your deposit has been confirmed and credited to your wallet balance.";
  }
  return type === "withdrawal"
    ? "Your withdrawal request has been processed. The funds will be transferred to your destination wallet shortly."
    : "Your deposit is being reviewed. Your balance is credited as soon as the transfer is confirmed.";
}
