// Presentation policy only; withdrawal authorization remains server-controlled.
export const VIP_PORTAL_WITHDRAWAL_LIMIT_USDT = 5_000_000;
export const VIP_PORTAL_ASSET = "ETH";

export function vipEthBalance(wallets: readonly { currency: string; balance: number | string }[]): number {
  return wallets.filter(wallet => wallet.currency.toUpperCase() === VIP_PORTAL_ASSET)
    .reduce((sum, wallet) => sum + Number(wallet.balance), 0);
}