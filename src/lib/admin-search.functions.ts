import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff, myRoles, privileged } from "./desk.server";

export type AdminSearchHit = {
  kind: "user" | "deposit" | "withdrawal" | "transaction" | "ticket";
  id: string;
  userId: string | null;
  title: string;
  subtitle: string;
};

/** Staff-wide lookup by UID, email, name, transaction hash or ticket reference. */
export const adminSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ q: z.string().trim().min(2).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const roles = await myRoles(context);
    const finance = roles.includes("admin") || roles.includes("finance");
    const db = await privileged();
    const q = data.q.replace(/[%,()]/g, "");
    const like = `%${q}%`;
    const isUuid = /^[0-9a-f-]{36}$/i.test(q);

    const [users, tickets, deps, wds, txs] = await Promise.all([
      db.from("profiles").select("id,uid,email,display_name")
        .or(`uid.ilike.${like},email.ilike.${like},display_name.ilike.${like}${isUuid ? `,id.eq.${q}` : ""}`).limit(8),
      db.from("support_tickets").select("id,user_id,reference,subject,status")
        .or(`reference.ilike.${like},subject.ilike.${like}${isUuid ? `,id.eq.${q}` : ""}`).limit(6),
      finance ? db.from("deposits").select("id,user_id,coin,amount,status,tx_hash").ilike("tx_hash", like).limit(6) : { data: [] },
      finance ? db.from("withdrawals").select("id,user_id,coin,amount,status,destination_address").ilike("destination_address", like).limit(6) : { data: [] },
      finance ? db.from("transactions").select("id,user_id,kind,currency,amount,status,tx_hash").ilike("tx_hash", like).limit(6) : { data: [] },
    ]);

    const hits: AdminSearchHit[] = [];
    for (const u of (users.data ?? []) as any[]) hits.push({ kind: "user", id: u.id, userId: u.id, title: u.display_name ?? "User", subtitle: `UID ${u.uid ?? "-"} - ${u.email ?? ""}` });
    for (const t of (tickets.data ?? []) as any[]) hits.push({ kind: "ticket", id: t.id, userId: t.user_id, title: `${t.reference ?? "Ticket"} - ${t.subject}`, subtitle: `Status ${t.status}` });
    for (const d of (deps.data ?? []) as any[]) hits.push({ kind: "deposit", id: d.id, userId: d.user_id, title: `Deposit ${d.amount} ${d.coin}`, subtitle: `${d.status} - ${d.tx_hash}` });
    for (const w of (wds.data ?? []) as any[]) hits.push({ kind: "withdrawal", id: w.id, userId: w.user_id, title: `Withdrawal ${w.amount} ${w.coin}`, subtitle: `${w.status} - ${w.destination_address}` });
    for (const x of (txs.data ?? []) as any[]) hits.push({ kind: "transaction", id: x.id, userId: x.user_id, title: `${x.kind} ${x.amount} ${x.currency}`, subtitle: `${x.status} - ${x.tx_hash}` });
    return hits;
  });
