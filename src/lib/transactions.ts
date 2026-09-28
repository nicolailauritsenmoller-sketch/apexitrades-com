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
  /** When the desk approved, declined or refunded the request. */
  resolvedAt?: string | null;
  /** Human readable summary, used in list rows. */
  title: string;
  subtitle: string;
  /** Conversion detail, only present on swap records. */
  swap?: {
    fromAsset: string;
    fromAmount: number;
    toAsset: string;
    toAmount: number;
    rate: number;
  };
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
    label: "Pending clearing",
    badge: "border-amber-400/60 bg-amber-400/20 text-amber-300",
    dot: "bg-amber-400",
  },
  successful: {
    label: "Successful",
    badge: "border-bull/60 bg-bull/20 text-bull",
    dot: "bg-bull",
  },
  failed: {
    label: "Failed",
    badge: "border-bear/60 bg-bear/20 text-bear",
    dot: "bg-bear",
  },
};

/** Institutional exchange timestamp, e.g. "Sep 04, 2026 • 03:02 AM". */
export function formatExchangeDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} • ${time}`;
}

const FIAT = new Set(["USD", "EUR", "GBP"]);

/** Estimated time of arrival based on the rail the transfer settles on. */
export function estimateEta(type: TxType, asset: string, network: string | null): string {
  const net = (network ?? "").toLowerCase();
  if (net.includes("bank") || FIAT.has(asset.toUpperCase())) return "1 - 3 business days";
  if (net.includes("bitcoin")) return "30 - 60 minutes";
  if (net.includes("erc")) return "10 - 30 minutes";
  if (net.includes("trc") || net.includes("bep")) return "5 - 15 minutes";
  return type === "deposit" ? "10 - 30 minutes" : "10 - 30 minutes";
}

export function shortenAddress(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}

export function statusMessage(type: TxType, status: TxStatus): string {
  if (type === "swap") {
    if (status === "failed") return "This swap could not be completed. Your balances were not changed.";
    if (status === "successful") return "Your new balance has been updated.";
    return "Your swap is being processed.";
  }
  if (status === "failed") {
    return type === "withdrawal"
      ? "This withdrawal did not pass the compliance check. Reserved funds were returned to your wallet. Contact Institutional Support for details."
      : "This deposit could not be verified. Check the transaction details or contact Institutional Support.";
  }
  if (status === "successful") {
    return type === "withdrawal"
      ? "Transaction settled. Funds are being transferred to your destination wallet."
      : "Verification complete. Your deposit has been credited to your wallet balance.";
  }
  return type === "withdrawal"
    ? "Your withdrawal is pending clearing house settlement."
    : "Your deposit is under security review. Your balance is credited after transfer verification.";
}

/** Approximate on-chain fee (USD) per settlement rail, used for the receipt row. */
const NETWORK_FEE_USD: Array<[RegExp, number]> = [
  [/bitcoin|btc/i, 1.42],
  [/erc|ethereum|eth/i, 0.04],
  [/trc|tron/i, 0.9],
  [/bep|bsc|binance/i, 0.12],
  [/solana|sol/i, 0.0004],
  [/polygon|matic|pol/i, 0.005],
  [/bank|sepa|wire/i, 0],
];

export function networkFeeUsd(network: string | null): number {
  if (!network) return 0;
  for (const [re, fee] of NETWORK_FEE_USD) if (re.test(network)) return fee;
  return 0.05;
}

/** Confirmations required before a transfer is treated as final. */
export function requiredConfirmations(network: string | null): number {
  const net = network ?? "";
  if (/bitcoin|btc/i.test(net)) return 3;
  if (/erc|ethereum|eth/i.test(net)) return 12;
  if (/bank|sepa|wire/i.test(net)) return 1;
  return 20;
}

/** Confirmations accrued so far - full when settled, time-derived while pending. */
export function confirmationsFor(
  status: TxStatus,
  network: string | null,
  createdAt: string,
): number {
  const required = requiredConfirmations(network);
  if (status === "successful") return required;
  if (status === "failed") return 0;
  const minutes = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 60000);
  return Math.min(required - 1, Math.floor(minutes / 2));
}

/** Block explorer link for the network + hash, when one is known. */
export function explorerUrl(network: string | null, txHash: string | null): string | null {
  if (!txHash) return null;
  const net = network ?? "";
  if (/bitcoin|btc/i.test(net)) return `https://mempool.space/tx/${txHash}`;
  if (/erc|ethereum|eth/i.test(net)) return `https://etherscan.io/tx/${txHash}`;
  if (/bep|bsc|binance/i.test(net)) return `https://bscscan.com/tx/${txHash}`;
  if (/trc|tron/i.test(net)) return `https://tronscan.org/#/transaction/${txHash}`;
  if (/solana|sol/i.test(net)) return `https://solscan.io/tx/${txHash}`;
  if (/polygon|matic|pol/i.test(net)) return `https://polygonscan.com/tx/${txHash}`;
  return null;
}

export function explorerName(network: string | null): string {
  const net = network ?? "";
  if (/bitcoin|btc/i.test(net)) return "mempool.space";
  if (/bep|bsc|binance/i.test(net)) return "BscScan";
  if (/trc|tron/i.test(net)) return "Tronscan";
  if (/solana|sol/i.test(net)) return "Solscan";
  if (/polygon|matic|pol/i.test(net)) return "Polygonscan";
  return "Etherscan";
}

/** Plain-language reason shown for failed transfers. */
export function failureReason(type: TxType, note: string | null): string {
  if (note) return note;
  return type === "withdrawal"
    ? "Broadcast failed - the network rejected the transaction (insufficient gas limit or congestion). Reserved funds were returned to your wallet."
    : "The transfer could not be confirmed on-chain. It may have been dropped due to network congestion or an underpaid fee.";
}
