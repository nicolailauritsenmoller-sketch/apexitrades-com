import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("requires an existing owned image for customer deposits while preserving legacy staff approval", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'authenticated'::text $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '11111111-1111-4111-8111-111111111111'::uuid $$;
      CREATE TABLE storage.objects (bucket_id text, name text, metadata jsonb);
      CREATE TABLE public.deposits (user_id uuid, receipt_path text, status text DEFAULT 'pending', tx_hash text);
    `);
    await db.exec(readFileSync(new URL("../../drizzle/migrations/0072_require_customer_deposit_payment_proof.sql", import.meta.url), "utf8"));
    const uid = "11111111-1111-4111-8111-111111111111";
    for (const path of [null, "", `${uid}/missing.png`, "other/payment.png"]) {
      await expect(db.query("INSERT INTO deposits(user_id, receipt_path) VALUES ($1,$2)", [uid, path])).rejects.toThrow();
    }
    await db.query("INSERT INTO storage.objects VALUES ('deposit-proofs', $1, $2)", [`${uid}/proof.png`, { size: 128, mimetype: "image/png" }]);
    await db.query("INSERT INTO deposits(user_id,receipt_path) VALUES ($1,$2)", [uid, `${uid}/proof.png`]);
    expect((await db.query<{ tx_hash: string | null }>("SELECT tx_hash FROM deposits")).rows[0]?.tx_hash).toBeNull();
    // Approval updates on old rows are deliberately outside the new INSERT guard.
    await db.exec("CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;");
    await db.query("INSERT INTO deposits(user_id) VALUES ($1)", [uid]);
    await db.exec("UPDATE deposits SET status = 'approved' WHERE receipt_path IS NULL;");
    expect((await db.query<{ status: string }>("SELECT status FROM deposits WHERE receipt_path IS NULL")).rows[0]?.status).toBe("approved");
  } finally { await db.close(); }
});