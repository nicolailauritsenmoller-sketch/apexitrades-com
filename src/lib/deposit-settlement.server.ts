/**
 * Automatic deposit clearing once the network reports enough confirmations.
 * Mirrors the manual admin approval path: credit the wallet, notify the user,
 * flag VIP eligibility and write an audit entry.
 */
import { requiredConfirmations } from "@/lib/transactions";
import { fetchOnchainStatus } from "@/lib/chain-confirmations.server";

export type DepositConfirmation = {
  id: string;
  confirmations: number;
  required: number;
  /** "pending" | "approved" | "rejected" after this sync pass. */
  status: string;
  /** The hash was located on-chain. */
  tracked: boolean;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Credits the wallet and settles a pending deposit. Idempotent per deposit. */
async function settleDeposit(dep: any, confirmations: number) {
  const admin = await db();
  const { data: settled } = await admin
    .from("deposits")
    .update({
      status: "approved",
      admin_note: `Auto-confirmed on-chain (${confirmations} confirmations).`,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", dep.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!settled) return false; // another pass (or an admin) already handled it

  const { data: wallet } = await admin
    .from("wallets")
    .select("id,balance")
    .eq("user_id", dep.user_id)
    .eq("currency", dep.coin)
    .maybeSingle();

  if (wallet) {
    await admin
      .from("wallets")
      .update({
        balance: Number(wallet.balance) + Number(dep.amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id);
  } else {
    await admin
      .from("wallets")
      .insert({ user_id: dep.user_id, currency: dep.coin, balance: Number(dep.amount) });
  }

  await admin.from("notifications").insert({
    user_id: dep.user_id,
    title: "Deposit confirmed",
    body: `${Number(dep.amount)} ${dep.coin} (${dep.network}) cleared with ${confirmations} network confirmations and is now available in your balance.`,
    kind: "success",
  });

  await admin.from("admin_audit_logs").insert({
    actor_id: dep.user_id,
    actor_name: "Network confirmation service",
    action: "deposit.auto_confirm",
    target_user_id: dep.user_id,
    details: {
      amount: Number(dep.amount),
      coin: dep.coin,
      network: dep.network,
      tx_hash: dep.tx_hash,
      confirmations,
    },
  });

  try {
    const { maybeFlagVipRequest } = await import("./vip-activation.server");
    await maybeFlagVipRequest(dep.user_id);
  } catch {
    /* VIP flagging must never block a settled deposit */
  }

  return true;
}

/**
 * Checks every pending deposit of a user against its network and settles the
 * ones that reached the required confirmation depth.
 */
export async function syncUserDeposits(userId: string): Promise<DepositConfirmation[]> {
  const admin = await db();
  const { data: pending } = await admin
    .from("deposits")
    .select("id,user_id,coin,network,amount,tx_hash,status,created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = (pending ?? []) as any[];
  const out: DepositConfirmation[] = [];

  for (const dep of rows) {
    const required = requiredConfirmations(dep.network);
    if (!dep.tx_hash) {
      out.push({ id: dep.id, confirmations: 0, required, status: "pending", tracked: false });
      continue;
    }

    const chain = await fetchOnchainStatus(dep.network, dep.tx_hash);
    if (!chain.found) {
      out.push({ id: dep.id, confirmations: 0, required, status: "pending", tracked: false });
      continue;
    }

    let status = "pending";
    if (!chain.failed && chain.confirmations >= required) {
      const ok = await settleDeposit(dep, chain.confirmations);
      status = ok ? "approved" : "pending";
    }

    out.push({
      id: dep.id,
      confirmations: Math.min(chain.confirmations, required),
      required,
      status,
      tracked: true,
    });
  }

  return out;
}
