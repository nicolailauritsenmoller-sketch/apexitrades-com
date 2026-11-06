import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const user = "11111111-1111-4111-8111-111111111111";
const ticket = "22222222-2222-4222-8222-222222222222";
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TABLE vip_fee_tiers(level integer PRIMARY KEY,name text,min_portfolio_usdt numeric,spot_maker numeric,spot_taker numeric,futures_maker numeric,futures_taker numeric,scalp_maker numeric,scalp_taker numeric);
    CREATE TABLE platform_settings(key text PRIMARY KEY,value jsonb);
    CREATE TABLE profiles(id uuid PRIMARY KEY,vip_tier text,vip_upgraded_at timestamptz);
    CREATE TABLE vip_accounts(user_id uuid PRIMARY KEY,level integer,recommended_level integer,grace_until timestamptz,updated_at timestamptz);
    CREATE TABLE support_tickets(id uuid PRIMARY KEY,user_id uuid,subject text,updated_at timestamptz);
    CREATE TABLE notifications(user_id uuid,title text,body text,kind text);
    CREATE TABLE admin_audit_logs(actor_id uuid,action text,target_user_id uuid,details jsonb);
    CREATE TABLE user_roles(user_id uuid,role text);`);
  for (const file of ["0067_vip_ecosystem_management.sql","0068_vip_credit_review_guards.sql","0069_vip_atomic_review_and_architecture.sql"]) await db.exec(readFileSync(`drizzle/migrations/${file}`,"utf8"));
  await db.exec(`INSERT INTO profiles(id,vip_tier) VALUES('${user}','regular'); INSERT INTO vip_fee_tiers(level,name,min_portfolio_usdt) VALUES(1,'Retail Prime',10000); INSERT INTO support_tickets(id,user_id,subject) VALUES('${ticket}','${user}','Treasury Operations - Credit Facility Simulation');`);
},30000);
afterAll(async () => db.close());
it("denies customer direct activation and liquidation RPCs", async () => {
  await db.exec("SET ROLE authenticated");
  try {
    await expect(db.query("SELECT activate_cleared_vip($1,1,$1)",[user])).rejects.toThrow("permission denied");
    await expect(db.query("SELECT review_vip_credit($1,'approved_simulation','Test review',$2)",[ticket,user])).rejects.toThrow("permission denied");
  } finally { await db.exec("RESET ROLE"); }
});
it("refuses liquidation or drawdown before simulation approval", async () => {
  await expect(db.query("SELECT review_vip_credit($1,'liquidated_simulation','Test liquidation',$2)",[ticket,user])).rejects.toThrow("approved simulation");
  await expect(db.query("SELECT record_vip_simulated_drawdown($1,$2)",[ticket,user])).rejects.toThrow("Approved simulation required");
});
it("records review and simulation drawdown without customer funds", async () => {
  await db.query("SELECT review_vip_credit($1,'approved_simulation','Approved test scenario',$2)",[ticket,user]);
  await db.query("SELECT record_vip_simulated_drawdown($1,$2)",[ticket,user]);
  const row = (await db.query<{ vip_credit_status: string; recorded: boolean }>("SELECT vip_credit_status,vip_credit_drawdown_at IS NOT NULL AS recorded FROM support_tickets WHERE id=$1",[ticket])).rows[0];
  expect(row).toEqual({ vip_credit_status: "approved_simulation", recorded: true });
  expect((await db.query("SELECT action FROM admin_audit_logs WHERE action='vip.credit_review'")).rows.length).toBe(1);
});
it("activates VIP atomically and deduplicates repeated promotion", async () => {
  await db.query("SELECT activate_cleared_vip($1,1,$1)",[user]);
  await db.query("SELECT activate_cleared_vip($1,1,$1)",[user]);
  expect((await db.query("SELECT level FROM vip_accounts WHERE user_id=$1",[user])).rows[0]).toEqual({ level: 1 });
  expect((await db.query("SELECT vip_tier FROM profiles WHERE id=$1",[user])).rows[0]).toEqual({ vip_tier: "vip1" });
  expect((await db.query("SELECT action FROM admin_audit_logs WHERE action='vip.auto_promotion'")).rows.length).toBe(1);
});