import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinance, privileged } from "./desk.server";

/** Unified ledger rows (public.transactions) enriched with account, fee and destination metadata. */
export const getLedgerDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ from: z.string().max(40), to: z.string().max(40) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const db = await privileged();
    const { data: tx, error } = await db
      .from("transactions")
      .select("*")
      .gte("created_at", data.from)
      .lte("created_at", data.to)
      .order("created_at", { ascending: false })
      .limit(3000);
    if (error) throw new Error(error.message);
    const rows = (tx ?? []) as any[];
    const ids = (t: string) => [...new Set(rows.filter((r) => r.ref_table === t).map((r) => r.ref_id))];
    const users = [...new Set(rows.map((r) => r.user_id))];
    const q = (table: string, cols: string, list: string[], key = "id") =>
      list.length ? db.from(table).select(cols).in(key, list) : Promise.resolve({ data: [] });
    const [profiles, kyc, wd, dep, con, pos, sess] = await Promise.all([
      q("profiles", "id,display_name,uid,email", users),
      q("kyc_submissions", "user_id,status,level2_status", users, "user_id"),
      q("withdrawals", "id,destination_address,network", ids("withdrawals")),
      q("deposits", "id,network,tx_hash", ids("deposits")),
      q("contracts", "id,fee_paid,symbol", ids("contracts")),
      q("positions", "id,fees_paid,symbol", ids("positions")),
      users.length
        ? db.from("user_sessions").select("user_id,ip_address,last_active_at").in("user_id", users).order("last_active_at", { ascending: false }).limit(2000)
        : Promise.resolve({ data: [] }),
    ]);
    const map = (d: any, k = "id") => new Map(((d.data ?? []) as any[]).map((r) => [r[k], r]));
    const P = map(profiles), K = map(kyc, "user_id"), W = map(wd), D = map(dep), C = map(con), O = map(pos);
    const ip = new Map<string, string>();
    for (const s of (sess.data ?? []) as any[]) if (s.ip_address && !ip.has(s.user_id)) ip.set(s.user_id, s.ip_address);
    return rows.map((r) => {
      const p = P.get(r.user_id) ?? {};
      const k = K.get(r.user_id);
      const src = r.ref_table === "withdrawals" ? W.get(r.ref_id) : r.ref_table === "deposits" ? D.get(r.ref_id) : r.ref_table === "contracts" ? C.get(r.ref_id) : r.ref_table === "positions" ? O.get(r.ref_id) : null;
      const fee = Number(src?.fee_paid ?? src?.fees_paid ?? 0);
      return {
        ...r,
        amount: Number(r.amount),
        fee,
        net: Number(r.amount) - Math.sign(Number(r.amount) || 1) * fee,
        tx_hash: r.tx_hash ?? src?.tx_hash ?? null,
        network: src?.network ?? null,
        destination: src?.destination_address ?? null,
        name: p.display_name ?? null,
        uid: p.uid ?? null,
        email: p.email ?? null,
        kycLevel: k ? (k.level2_status === "approved" ? 2 : k.status === "approved" ? 1 : 0) : 0,
        ip: ip.get(r.user_id) ?? null,
      };
    });
  });
