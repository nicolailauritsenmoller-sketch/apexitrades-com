import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
const user = "11111111-1111-4111-8111-111111111111";
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE profiles(id uuid PRIMARY KEY, vip_tier text);
    CREATE TABLE vip_accounts(user_id uuid PRIMARY KEY,level int,recommended_level int,updated_at timestamptz);
    CREATE TABLE notifications(user_id uuid,title text,body text,kind text);
    CREATE TABLE admin_audit_logs(actor_id uuid,target_user_id uuid,action text,details jsonb);
    CREATE TABLE user_roles(user_id uuid,role text);
    INSERT INTO profiles VALUES('${user}','regular');
  `);
  await db.exec(readFileSync("drizzle/migrations/0064_prime_allocation_request.sql", "utf8"));
}, 30_000);
afterAll(async () => { await db.close(); });

describe("Reviewed Prime allocations", () => {
  it("does not allow customers to call the privileged allocation function directly", async () => {
    await db.exec("SET ROLE authenticated");
    try { await expect(db.query("SELECT request_prime_allocation($1,1)", [user])).rejects.toThrow("permission denied"); }
    finally { await db.exec("RESET ROLE"); }
  });
  it("records an upgrade recommendation without activating a financial level", async () => {
    await db.query("SELECT request_prime_allocation($1,1)", [user]);
    const { rows } = await db.query("SELECT level,recommended_level FROM vip_accounts WHERE user_id=$1", [user]);
    expect(rows[0]).toEqual({ level: 0, recommended_level: 1 });
    expect((await db.query("SELECT vip_tier FROM profiles WHERE id=$1", [user])).rows[0]).toEqual({ vip_tier: "vip_pending" });
  });
  it("deduplicates repeated requests and notifications", async () => {
    await db.query("SELECT request_prime_allocation($1,1)", [user]);
    expect((await db.query<{ count: number }>("SELECT count(*)::integer AS count FROM notifications WHERE user_id=$1", [user])).rows[0]?.count).toBe(1);
  });
  it("does not downgrade an approved account when a lower allocation is requested", async () => {
    await db.query("UPDATE vip_accounts SET level=3,recommended_level=NULL WHERE user_id=$1", [user]);
    await db.query("UPDATE profiles SET vip_tier='vip1' WHERE id=$1", [user]);
    await db.query("SELECT request_prime_allocation($1,1)", [user]);
    expect((await db.query("SELECT level,recommended_level FROM vip_accounts WHERE user_id=$1", [user])).rows[0]).toEqual({ level: 3, recommended_level: null });
  });
});