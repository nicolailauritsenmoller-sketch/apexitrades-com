export const QUICK_DEPOSIT_ASSETS = ["USDT", "BTC", "ETH", "USDC"] as const;

export type QuickDepositAsset = (typeof QUICK_DEPOSIT_ASSETS)[number];

export function depositOptions<T extends { coin: string; address: string }>(addresses: T[], asset: QuickDepositAsset): T[] {
  return addresses.filter((address) => address.coin.toUpperCase() === asset && address.address.trim().length > 0);
}