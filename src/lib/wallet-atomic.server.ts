/** Atomic wallet increment/decrement via the wallet_adjust DB function (service role only). */
export async function walletAdjust(db: any, userId: string, currency: string, delta: number) {
  if (!delta) return null;
  const { data, error } = await db.rpc("wallet_adjust", {
    p_user: userId,
    p_currency: currency,
    p_delta: delta,
  });
  if (error) {
    if (/insufficient/i.test(error.message)) throw new Error(`Insufficient ${currency} balance.`);
    throw new Error(error.message);
  }
  return Number(data);
}
