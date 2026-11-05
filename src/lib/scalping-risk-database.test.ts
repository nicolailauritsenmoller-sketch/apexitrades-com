import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
const tierId = "ce4e4ee3-68b3-4c8e-98a4-19ae6dd1c2d3";
const userId = "bcb48f8e-1f83-46e4-a492-9f63ba39c15a";
const version = "2026-11-05T05:23:00Z";
const migration = readFileSync("drizzle/migrations/0053_scalping_tier_risk_controls.sql", "utf8");
const guard = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.validate_contract_tier()"), migration.indexOf("CREATE OR REPLACE FUNCTION public.audit_scalping_rule()"));
beforeAll(async () => {
  await db.exec(`CREATE TABLE scalping_tier_rules(id uuid PRIMARY KEY,active boolean,deleted_at timestamptz,updated_at timestamptz,duration_seconds integer,roi_pct numeric,min_trade_amount numeric,max_trade_amount numeric,allowed_pairs text[],commission_pct numeric,daily_payout_cap numeric);
    CREATE TABLE wallets(user_id uuid,currency text,balance numeric,PRIMARY KEY(user_id,currency));
    CREATE TABLE contracts(id uuid DEFAULT gen_random_uuid(),user_id uuid,tier_id uuid,tier_version timestamptz,duration_seconds integer,payout_pct numeric,stake numeric,symbol text,currency text,leverage numeric,status text DEFAULT 'open',expires_at timestamptz,opened_at timestamptz,protocol_fee_pct numeric,fee_paid numeric,payout numeric);
    CREATE FUNCTION wallet_adjust(p_user uuid,p_currency text,p_delta numeric) RETURNS numeric LANGUAGE plpgsql AS $$ DECLARE b numeric; BEGIN UPDATE wallets SET balance=balance+p_delta WHERE user_id=p_user AND currency=p_currency RETURNING balance INTO b; IF b IS NULL OR b<0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF; RETURN b; END $$;`);
  await db.exec(guard);
  await db.exec("CREATE TRIGGER enforce_contract_tier BEFORE INSERT ON contracts FOR EACH ROW EXECUTE FUNCTION validate_contract_tier();");
}, 30000);
beforeEach(async () => {
  await db.exec("DELETE FROM contracts; DELETE FROM wallets; DELETE FROM scalping_tier_rules;");
  await db.query("INSERT INTO scalping_tier_rules VALUES($1,true,NULL,$2,60,10,100,500,ARRAY['BTCUSDT'],1.5,550)", [tierId, version]);
  await db.query("INSERT INTO wallets VALUES($1,'USDT',10000)", [userId]);
});
afterAll(async () => { await db.close(); });
async function place(stake = 500, symbol = "BTCUSDT", fee = 7.5) {
  return db.query<{ protocol_fee_pct: string }>("INSERT INTO contracts(user_id,tier_id,tier_version,duration_seconds,payout_pct,stake,symbol,currency,leverage,expires_at,fee_paid) VALUES($1,$2,$3,60,10,$4,$5,'USDT',1,now()+interval '60 seconds',$6) RETURNING *",[userId,tierId,version,stake,symbol,fee]);
}
async function balance() { return (await db.query<{ balance: string }>("SELECT balance FROM wallets")).rows[0]?.balance; }
describe("Database-enforced scalping risks", () => {
  it("accepts the exact aggregate cap and atomically charges stake plus fee", async () => {
    const { rows } = await place();
    expect(rows[0]?.protocol_fee_pct).toBe('1.5');
    expect(Number(await balance())).toBe(9492.5);
    await expect(place(100,'BTCUSDT',1.5)).rejects.toThrow('Daily payout capacity');
    expect(Number(await balance())).toBe(9492.5);
  });
  it("serializes competing entries so only one fits the tier payout budget", async () => {
    const results = await Promise.allSettled([place(),place()]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect((await db.query("SELECT * FROM contracts")).rows).toHaveLength(1);
    expect(Number(await balance())).toBe(9492.5);
  });
  it("rejects forbidden pairs and excessive stakes without debiting funds", async () => {
    await expect(place(501)).rejects.toThrow('tier maximum');
    await expect(place(500,'ETHUSDT')).rejects.toThrow('not eligible');
    expect(Number(await balance())).toBe(10000);
  });
  it("rejects missing protocol fees and insufficient funds atomically", async () => {
    await expect(place(500,'BTCUSDT',0)).rejects.toThrow('commission is missing');
    await db.exec('UPDATE wallets SET balance=500');
    await expect(place()).rejects.toThrow('Insufficient balance');
    expect(Number(await balance())).toBe(500);
    expect((await db.query('SELECT * FROM contracts')).rows).toHaveLength(0);
  });
  it("keeps paid wins committed and frees only unpaid loss capacity", async () => {
    await place();
    await db.exec("UPDATE contracts SET status='settled',payout=550");
    await expect(place(100,'BTCUSDT',1.5)).rejects.toThrow('Daily payout capacity');
    await db.exec("UPDATE contracts SET payout=0");
    await expect(place()).resolves.toBeDefined();
  });
  it("uses the expiry UTC day rather than opening day for long-duration contracts", async () => {
    await place();
    await db.exec('UPDATE scalping_tier_rules SET duration_seconds=86400');
    const { rows } = await db.query("INSERT INTO contracts(user_id,tier_id,tier_version,duration_seconds,payout_pct,stake,symbol,currency,leverage,expires_at,fee_paid) VALUES($1,$2,$3,86400,10,500,'BTCUSDT','USDT',1,now()+interval '1 day',7.5) RETURNING *",[userId,tierId,version]);
    expect(rows).toHaveLength(1);
    expect(Number(await balance())).toBe(8985);
  });
});