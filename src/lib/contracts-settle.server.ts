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

    const { data: r, error: rpcError } = await db.rpc("settle_contract_atomic", {
      p_id: contract.id, p_user: userId, p_exit: exit, p_result: result, p_payout: payout,
    });
    if (rpcError) throw new Error(rpcError.message);
    // Already settled by a concurrent call - return the stored result.
    return {
      result: (r?.result ?? result) as typeof result,
      exitPrice: Number(r?.exit_price ?? exit),
      payout: Number(r?.payout ?? 0),
      currency: (r?.currency ?? contract.currency) as string,
    };
}
