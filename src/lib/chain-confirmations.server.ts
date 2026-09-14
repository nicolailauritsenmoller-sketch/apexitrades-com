/**
 * On-chain confirmation lookups for pending deposits.
 *
 * Every call is best-effort: public endpoints fail, rate-limit or go dark, so
 * an unknown result always degrades to `found: false` and the deposit simply
 * stays in manual review.
 */

export type ChainStatus = {
  /** The transaction was located on the network. */
  found: boolean;
  /** Blocks mined on top of the including block (0 while unconfirmed). */
  confirmations: number;
  /** The network reports the transaction reverted / failed. */
  failed: boolean;
};

const UNKNOWN: ChainStatus = { found: false, confirmations: 0, failed: false };

const EVM_RPC: Array<[RegExp, string]> = [
  [/bnb|bep|bsc|binance/i, "https://bsc-rpc.publicnode.com"],
  [/arbitrum/i, "https://arbitrum-one-rpc.publicnode.com"],
  [/optimism/i, "https://optimism-rpc.publicnode.com"],
  [/base/i, "https://base-rpc.publicnode.com"],
  [/polygon|matic|pol\b/i, "https://polygon-bor-rpc.publicnode.com"],
  [/avalanche|avax/i, "https://avalanche-c-chain-rpc.publicnode.com"],
  [/scroll/i, "https://rpc.scroll.io"],
  [/erc-?20|ethereum|^eth$/i, "https://ethereum-rpc.publicnode.com"],
];

async function timedFetch(url: string, init?: RequestInit, ms = 7000): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(url: string, method: string, params: unknown[]): Promise<any> {
  const res = await timedFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as { result?: unknown };
    return json.result ?? null;
  } catch {
    return null;
  }
}

async function evmStatus(rpcUrl: string, hash: string): Promise<ChainStatus> {
  const receipt = await rpc(rpcUrl, "eth_getTransactionReceipt", [hash]);
  if (!receipt || typeof receipt !== "object") return UNKNOWN;
  const r = receipt as { status?: string; blockNumber?: string };
  if (r.status === "0x0") return { found: true, confirmations: 0, failed: true };
  const tipHex = await rpc(rpcUrl, "eth_blockNumber", []);
  if (!r.blockNumber || typeof tipHex !== "string") return { found: true, confirmations: 1, failed: false };
  const tip = Number.parseInt(tipHex, 16);
  const block = Number.parseInt(r.blockNumber, 16);
  if (!Number.isFinite(tip) || !Number.isFinite(block)) return { found: true, confirmations: 1, failed: false };
  return { found: true, confirmations: Math.max(1, tip - block + 1), failed: false };
}

async function bitcoinStatus(hash: string): Promise<ChainStatus> {
  const res = await timedFetch(`https://mempool.space/api/tx/${hash}/status`);
  if (!res || !res.ok) return UNKNOWN;
  const status = (await res.json().catch(() => null)) as
    | { confirmed?: boolean; block_height?: number }
    | null;
  if (!status) return UNKNOWN;
  if (!status.confirmed) return { found: true, confirmations: 0, failed: false };
  const tipRes = await timedFetch("https://mempool.space/api/blocks/tip/height");
  const tip = tipRes && tipRes.ok ? Number(await tipRes.text()) : NaN;
  const height = Number(status.block_height);
  if (!Number.isFinite(tip) || !Number.isFinite(height)) {
    return { found: true, confirmations: 1, failed: false };
  }
  return { found: true, confirmations: Math.max(1, tip - height + 1), failed: false };
}

async function solanaStatus(hash: string): Promise<ChainStatus> {
  const result = await rpc("https://api.mainnet-beta.solana.com", "getSignatureStatuses", [
    [hash],
    { searchTransactionHistory: true },
  ]);
  const entry = (result as { value?: Array<any> } | null)?.value?.[0];
  if (!entry) return UNKNOWN;
  if (entry.err) return { found: true, confirmations: 0, failed: true };
  const level = String(entry.confirmationStatus ?? "");
  if (level === "finalized") return { found: true, confirmations: 100, failed: false };
  return { found: true, confirmations: Number(entry.confirmations ?? 1) || 1, failed: false };
}

async function tronStatus(hash: string): Promise<ChainStatus> {
  const res = await timedFetch(
    `https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(hash)}`,
  );
  if (!res || !res.ok) return UNKNOWN;
  const info = (await res.json().catch(() => null)) as
    | { confirmations?: number; confirmed?: boolean; contractRet?: string }
    | null;
  if (!info || (info.confirmations === undefined && info.confirmed === undefined)) return UNKNOWN;
  if (info.contractRet && info.contractRet !== "SUCCESS") {
    return { found: true, confirmations: 0, failed: true };
  }
  const confirmations = Number(info.confirmations ?? (info.confirmed ? 20 : 0)) || 0;
  return { found: true, confirmations, failed: false };
}

/** Best-effort confirmation lookup for a transfer hash on a given network. */
export async function fetchOnchainStatus(
  network: string | null,
  txHash: string | null,
): Promise<ChainStatus> {
  const hash = (txHash ?? "").trim();
  const net = network ?? "";
  if (!hash) return UNKNOWN;

  try {
    if (/bitcoin|segwit|taproot|^btc$/i.test(net) && !/bep|bsc/i.test(net)) {
      return await bitcoinStatus(hash);
    }
    if (/solana|^sol$/i.test(net)) return await solanaStatus(hash);
    if (/tron|trc-?20/i.test(net)) return await tronStatus(hash);
    for (const [re, url] of EVM_RPC) {
      if (re.test(net)) return await evmStatus(url, hash);
    }
  } catch {
    return UNKNOWN;
  }
  return UNKNOWN;
}
