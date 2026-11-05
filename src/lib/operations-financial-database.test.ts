import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const user = "bcb48f8e-1f83-46e4-a492-9f63ba39c15a";
const a = "ce4e4ee3-68b3-4c8e-98a4-19ae6dd1c2d3";
const b = "de4e4ee3-68b3-4c8e-98a4-19ae6dd1c2d3";
const migration = readFileSync("drizzle/migrations/0057_operations_health_and_financial_guards.sql", "utf8");
const guard = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.settle_deposit_atomic"), migration.indexOf("REVOKE EXECUTE ON FUNCTION public.settle_deposit_atomic"));
beforeAll(async () => {
  await db.exec(`CREATE TYPE request_status AS ENUM('pending','approved','rejected','unsubmitted');
    CREATE TABLE user_roles(user_id uuid,role text);
    CREATE TABLE deposits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,coin text,network text,amount numeric,tx_hash text,status request_status DEFAULT 'pending',admin_note text,reviewed_by uuid,reviewed_at timestamptz);
    CREATE TABLE withdrawals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,coin text,network text,amount numeric,status request_status DEFAULT 'pending',admin_note text,reviewed_by uuid,reviewed_at timestamptz);
    CREATE TABLE wallets(user_id uuid,currency text,balance numeric,PRIMARY KEY(user_id,currency));
    CREATE TABLE notifications(user_id uuid,title text,body text,kind text);
    CREATE TABLE platform_settings(key text PRIMARY KEY,value jsonb);
    CREATE TABLE credited_deposit_transfers(network text,coin text,transfer_id text,deposit_id uuid UNIQUE,PRIMARY KEY(network,coin,transfer_id));
    CREATE TABLE financial_review_approvals(request_kind text,request_id uuid,approver_id uuid,PRIMARY KEY(request_kind,request_id,approver_id));
    ALTER TABLE withdrawals ADD COLUMN created_at timestamptz DEFAULT now(), ADD COLUMN destination_address text;
    CREATE TABLE profiles(id uuid PRIMARY KEY, withdrawals_disabled boolean DEFAULT false, account_frozen boolean DEFAULT false);
    CREATE TABLE kyc_submissions(user_id uuid,status text);
    CREATE TABLE user_withdrawal_limits(user_id uuid,daily_limit_usdt numeric);
    CREATE FUNCTION wallet_adjust(p_user uuid,p_currency text,p_delta numeric) RETURNS numeric LANGUAGE plpgsql AS $$ DECLARE v numeric; BEGIN UPDATE wallets SET balance=balance+p_delta WHERE user_id=p_user AND currency=p_currency RETURNING balance INTO v; IF v<0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF; RETURN v; END $$;
    INSERT INTO user_roles VALUES('${a}','admin'),('${b}','finance');`);
  await db.exec(guard);
  const withdrawalSql = readFileSync("drizzle/migrations/0059_atomic_withdrawal_request_holds.sql", "utf8");
  await db.exec(withdrawalSql.slice(0, withdrawalSql.indexOf("REVOKE EXECUTE")));
}, 30000);
beforeEach(async () => { await db.exec(`DELETE FROM deposits;DELETE FROM withdrawals;DELETE FROM wallets;DELETE FROM notifications;DELETE FROM credited_deposit_transfers;DELETE FROM financial_review_approvals;DELETE FROM platform_settings; DELETE FROM profiles;DELETE FROM kyc_submissions;DELETE FROM user_withdrawal_limits; INSERT INTO profiles(id) VALUES('${user}');INSERT INTO kyc_submissions VALUES('${user}','approved'); INSERT INTO wallets VALUES('${user}','USDT',1000);`); });
afterAll(async () => { await db.close(); });
async function deposit(hash = "0xABC") { return (await db.query<{ id: string }>("INSERT INTO deposits(user_id,coin,network,amount,tx_hash) VALUES($1,'USDT','ERC20',100,$2) RETURNING id", [user, hash])).rows[0]?.id; }
describe("Atomic financial safeguards", () => {
  it("credits the same deposit only once and records one financial confirmation", async () => {
    const id = await deposit();
    await db.query("SELECT settle_deposit_atomic($1,'approved',NULL,$2)", [id, a]);
    await db.query("SELECT settle_deposit_atomic($1,'approved',NULL,$2)", [id, a]);
    expect(Number((await db.query<{ balance: string }>("SELECT balance FROM wallets")).rows[0]?.balance)).toBe(1100);
    expect((await db.query("SELECT * FROM notifications")).rows).toHaveLength(1);
  });
  it("prevents the same EVM transfer being credited through another deposit row", async () => {
    await db.query("SELECT settle_deposit_atomic($1,'approved',NULL,$2)", [await deposit(), a]);
    await expect(db.query("SELECT settle_deposit_atomic($1,'approved',NULL,$2)", [await deposit("0xabc"), b])).rejects.toThrow("already been credited");
  });
  it("rejects unsubmitted as a settlement transition", async () => {
    await expect(db.query("SELECT settle_deposit_atomic($1,'unsubmitted',NULL,$2)", [await deposit(), a])).rejects.toThrow("Invalid settlement status");
  });
  it("rejects missing transaction evidence without crediting funds", async () => {
    await expect(db.query("SELECT settle_deposit_atomic($1,'approved',NULL,$2)", [await deposit(""), a])).rejects.toThrow("transaction reference");
    expect(Number((await db.query<{ balance: string }>("SELECT balance FROM wallets")).rows[0]?.balance)).toBe(1000);
  });
  it("requires two distinct authorized operators for enabled large withdrawals", async () => {
    await db.exec(`INSERT INTO platform_settings VALUES('risk_controls','{"largeWithdrawalReview":true,"largeWithdrawalThresholdUsd":10000}');`);
    const id = (await db.query<{ id: string }>("INSERT INTO withdrawals(user_id,coin,network,amount) VALUES($1,'USDT','ERC20',10001) RETURNING id", [user])).rows[0]?.id;
    await db.query("SELECT review_withdrawal_atomic($1,'approved',NULL,$2)", [id,a]);
    await db.query("SELECT review_withdrawal_atomic($1,'approved',NULL,$2)", [id,a]);
    expect((await db.query<{ status: string }>("SELECT status FROM withdrawals")).rows[0]?.status).toBe("pending");
    expect((await db.query("SELECT * FROM notifications")).rows).toHaveLength(0);
    await db.query("SELECT review_withdrawal_atomic($1,'approved',NULL,$2)", [id,b]);
    expect((await db.query<{ status: string }>("SELECT status FROM withdrawals")).rows[0]?.status).toBe("approved");
    expect((await db.query("SELECT * FROM notifications")).rows).toHaveLength(1);
  });
  it("rejects an ordinary user as a reviewer", async () => {
    await expect(db.query("SELECT settle_deposit_atomic($1,'approved',NULL,$2)", [await deposit(),user])).rejects.toThrow("Finance access required");
  });
  it("records a withdrawal and holds its amount in the same transaction", async () => {
    await db.query("SELECT request_withdrawal_atomic($1,'USDT','ERC20',200,'destination')", [user]);
    expect(Number((await db.query<{ balance: string }>("SELECT balance FROM wallets")).rows[0]?.balance)).toBe(800);
    expect((await db.query("SELECT * FROM withdrawals WHERE amount=200 AND status='pending'")).rows).toHaveLength(1);
  });
  it("rolls back the hold if the withdrawal insert fails", async () => {
    await db.exec("ALTER TABLE withdrawals ADD CONSTRAINT destination_test_guard CHECK(destination_address <> 'invalid')");
    try {
      await expect(db.query("SELECT request_withdrawal_atomic($1,'USDT','ERC20',200,'invalid')", [user])).rejects.toThrow();
      expect(Number((await db.query<{ balance: string }>("SELECT balance FROM wallets")).rows[0]?.balance)).toBe(1000);
      expect((await db.query("SELECT * FROM withdrawals")).rows).toHaveLength(0);
    } finally { await db.exec("ALTER TABLE withdrawals DROP CONSTRAINT destination_test_guard"); }
  });
  it("enforces the shared USDT and USDC daily cap before a second hold", async () => {
    await db.exec(`INSERT INTO user_withdrawal_limits VALUES('${user}',300);INSERT INTO wallets VALUES('${user}','USDC',1000);`);
    await db.query("SELECT request_withdrawal_atomic($1,'USDT','ERC20',200,'destination')", [user]);
    await expect(db.query("SELECT request_withdrawal_atomic($1,'USDC','ERC20',101,'destination')", [user])).rejects.toThrow("Daily withdrawal limit exceeded");
    expect(Number((await db.query<{ balance: string }>("SELECT balance FROM wallets WHERE currency='USDC'")).rows[0]?.balance)).toBe(1000);
  });
  it("refunds a rejected withdrawal only once", async () => {
    const row = await db.query<{ result: { id: string } }>("SELECT request_withdrawal_atomic($1,'USDT','ERC20',200,'destination') AS result", [user]);
    const id = row.rows[0]?.result.id;
    await db.query("SELECT review_withdrawal_atomic($1,'rejected',NULL,$2)", [id,a]);
    await db.query("SELECT review_withdrawal_atomic($1,'rejected',NULL,$2)", [id,a]);
    expect(Number((await db.query<{ balance: string }>("SELECT balance FROM wallets")).rows[0]?.balance)).toBe(1000);
  });
});