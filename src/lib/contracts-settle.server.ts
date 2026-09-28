import { fetchPrice } from "./market.server";

/** Settles one expired contract: compares entry vs expiry mark price and credits payouts. */
export async function settleContractRow(supabase: any, db: any, userId: string, contract: any) {
    const exit = await fetchPrice(contract.symbol);
    const entry = Number(contract.entry_price);
    const stake = Number(contract.stake);
    const pct = Number(contract.payout_pct);

    // Settlement outcome can be overridden by an administrator, either for this
    // single contract or globally for the account.
    const { data: profile } = await supabase
      .from("profiles")
      .select("outcome_mode")
      .eq("id", userId)
      .maybeSingle();

    // Platform-wide default applies when neither the contract nor the account
    // carries an explicit override.
    const { data: globalSetting } = await db
      .from("platform_settings")
      .select("value")
      .eq("key", "trading")
      .maybeSingle();
    const globalDefault = (globalSetting?.value?.defaultOutcome ?? "normal") as string;

    const override =
      contract.outcome_override && contract.outcome_override !== "normal"
        ? contract.outcome_override
        : profile?.outcome_mode && profile.outcome_mode !== "normal"
          ? profile.outcome_mode
          : globalDefault;

    let result: "win" | "loss" | "draw";
    if (override === "force_win") result = "win";
    else if (override === "force_loss") result = "loss";
    else if (exit === entry) result = "draw";
    else if ((exit > entry && contract.direction === "up") || (exit < entry && contract.direction === "down"))
      result = "win";
    else result = "loss";

    const payout = result === "win" ? stake + (stake * pct) / 100 : result === "draw" ? stake : 0;

    const { data: settled, error: updateError } = await db
      .from("contracts")
      .update({
        status: "settled",
        exit_price: exit,
        result,
        payout,
        settled_at: new Date().toISOString(),
      })
      .eq("id", contract.id)
      .eq("user_id", userId)
      .eq("status", "open")
      .select("id");
    if (updateError) throw new Error(updateError.message);
    // Another concurrent settle already credited this contract.
    if (!settled || settled.length === 0) throw new Error("Contract already settled.");

    if (payout > 0) {
      const { data: wallet } = await db
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .eq("currency", contract.currency)
        .maybeSingle();
      if (wallet) {
        await db
          .from("wallets")
          .update({
            balance: Number(wallet.balance) + payout,
            updated_at: new Date().toISOString(),
          })
          .eq("id", wallet.id)
          .eq("user_id", userId);
      }
    }


    return { result, exitPrice: exit, payout, currency: contract.currency as string };
}
