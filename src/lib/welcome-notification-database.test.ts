import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";

const db = new PGlite();
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}', last_sign_in_at timestamptz);
    CREATE TABLE profiles (id uuid PRIMARY KEY, display_name text, email text, avatar_url text, referred_by uuid, referral_code text, vip_tier text DEFAULT 'regular');
    CREATE TABLE referrals (referrer_id uuid, referee_id uuid UNIQUE, referral_code text);
    CREATE TABLE wallets (user_id uuid, currency text, balance numeric, UNIQUE(user_id,currency));
    CREATE TABLE watchlist (user_id uuid, symbol text, UNIQUE(user_id,symbol));
    CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(id), title text NOT NULL, body text NOT NULL, kind text DEFAULT 'info', read_at timestamptz, created_at timestamptz DEFAULT now());
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0076_institutional_welcome_notification.sql", import.meta.url), "utf8"));
  await db.exec("CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();");
  await db.query("INSERT INTO auth.users(id,email) VALUES ($1,'first@example.test'),($2,'second@example.test')", [first, second]);
}, 30000);

afterAll(async () => { await db.close(); });

it("creates one notification per newly registered account, before first login", async () => {
  const result = await db.query<{ user_id: string; count: number }>("SELECT user_id, count(*)::integer AS count FROM notifications GROUP BY user_id ORDER BY user_id");
  expect(result.rows).toEqual([{ user_id: first, count: 1 }, { user_id: second, count: 1 }]);
});

it("starts the welcome unread without changing account eligibility or balances", async () => {
  expect((await db.query("SELECT read_at FROM notifications WHERE user_id=$1", [first])).rows).toEqual([{ read_at: null }]);
  expect((await db.query("SELECT vip_tier FROM profiles WHERE id=$1", [first])).rows).toEqual([{ vip_tier: "regular" }]);
  expect((await db.query("SELECT count(*)::integer AS wallets, sum(balance)::float AS funds FROM wallets WHERE user_id=$1", [first])).rows).toEqual([{ wallets: 6, funds: 0 }]);
  expect((await db.query("SELECT count(*)::integer AS count FROM watchlist WHERE user_id=$1", [first])).rows).toEqual([{ count: 7 }]);
});

it("does not resend or reset read state on subsequent sign-ins or profile updates", async () => {
  await db.query("UPDATE notifications SET read_at=now() WHERE user_id=$1", [first]);
  await db.query("UPDATE auth.users SET last_sign_in_at=now() WHERE id=$1", [first]);
  await db.query("UPDATE profiles SET display_name='Updated' WHERE id=$1", [first]);
  expect((await db.query("SELECT count(*)::integer AS count, bool_and(read_at IS NOT NULL) AS read FROM notifications WHERE user_id=$1", [first])).rows).toEqual([{ count: 1, read: true }]);
});

it("preserves OAuth metadata and referral provisioning", async () => {
  await db.query("UPDATE profiles SET referral_code='PRIME' WHERE id=$1", [first]);
  const third = "33333333-3333-4333-8333-333333333333";
  await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,'oauth@example.test',$2)", [third, { full_name: "OAuth Trader", picture: "https://example.test/avatar.png", referral_code: "prime" }]);
  expect((await db.query("SELECT display_name,avatar_url,referred_by FROM profiles WHERE id=$1", [third])).rows).toEqual([{ display_name: "OAuth Trader", avatar_url: "https://example.test/avatar.png", referred_by: first }]);
  expect((await db.query("SELECT referrer_id,referee_id FROM referrals WHERE referee_id=$1", [third])).rows).toEqual([{ referrer_id: first, referee_id: third }]);
  expect((await db.query("SELECT count(*)::integer AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL", [third])).rows).toEqual([{ count: 1 }]);
});