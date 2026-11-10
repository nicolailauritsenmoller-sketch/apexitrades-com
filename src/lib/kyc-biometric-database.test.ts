import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";

const db = new PGlite();
const id = "11111111-1111-4111-8111-111111111111";
const customer = "22222222-2222-4222-8222-222222222222";
const officer = "33333333-3333-4333-8333-333333333333";
const path = `${customer}/level2-selfie-live.jpg`;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA private;
    CREATE FUNCTION private.validate_selfie_capture(jsonb) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE TABLE user_roles(user_id uuid, role text);
    CREATE TABLE admin_audit_logs(actor_id uuid, action text, target_user_id uuid, details jsonb);
    CREATE TABLE kyc_submissions(id uuid PRIMARY KEY, user_id uuid, status text, level2_status text,
      kyc_level_1_status text, kyc_level_2_status text, full_name text, country text, document_type text,
      date_of_birth date, address text, document_number text, document_expires_at date,
      document_path text, document_back_path text, selfie_path text, selfie_capture jsonb,
      level2_selfie_path text, level2_selfie_capture jsonb, level2_reviewed_by uuid, level2_reviewed_at timestamptz,
      level2_proof_path text, level2_proof_type text, level2_proof_issued_at date, level2_tax_id text);
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0077_approved_kyc_biometric_purge.sql", import.meta.url), "utf8"));
  await db.query("INSERT INTO user_roles VALUES($1,'admin')", [officer]);
  await db.query(`INSERT INTO kyc_submissions(id,user_id,status,level2_status,kyc_level_1_status,kyc_level_2_status,level2_selfie_path,level2_selfie_capture,level2_reviewed_by,level2_reviewed_at)
    VALUES($1,$2,'approved','approved','approved','approved',$3,'{"source":"camera","capturedAt":"2026-11-10"}',$4,'2026-11-10T08:00:00Z')`, [id, customer, path, officer]);
  await db.exec("CREATE TRIGGER validate_kyc BEFORE INSERT OR UPDATE ON kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.validate_kyc_submission();");
}, 30000);
afterAll(async () => { await db.close(); });

it("rejects direct evidence removal even on an already approved profile", async () => {
  await expect(db.query("UPDATE kyc_submissions SET level2_selfie_path=NULL WHERE id=$1", [id])).rejects.toThrow("valid live selfie");
});
it("rejects client-supplied purge metadata", async () => {
  await expect(db.query("UPDATE kyc_submissions SET level2_selfie_deleted_at=now() WHERE id=$1", [id])).rejects.toThrow("officer-managed");
});
it("requires an administrator and an audit reason", async () => {
  await expect(db.query("SELECT finalize_kyc_biometric_purge($1,$2,$3,'Privacy request')", [id, customer, path])).rejects.toThrow("Administrator");
  await expect(db.query("SELECT finalize_kyc_biometric_purge($1,$2,$3,'')", [id, officer, path])).rejects.toThrow("audit reason");
});
it("preserves approved status and officer review while clearing capture and appending the audit", async () => {
  await db.query("SELECT finalize_kyc_biometric_purge($1,$2,$3,'Approved privacy request')", [id, officer, path]);
  expect((await db.query("SELECT status,level2_status,kyc_level_1_status,kyc_level_2_status,level2_selfie_path,level2_selfie_capture,level2_reviewed_by,level2_selfie_deleted_at IS NOT NULL AS deleted FROM kyc_submissions WHERE id=$1", [id])).rows).toEqual([{
    status: "approved", level2_status: "approved", kyc_level_1_status: "approved", kyc_level_2_status: "approved",
    level2_selfie_path: null, level2_selfie_capture: null, level2_reviewed_by: officer, deleted: true,
  }]);
  expect((await db.query("SELECT actor_id,action,target_user_id,details->>'note' AS reason FROM admin_audit_logs")).rows).toEqual([{
    actor_id: officer, action: "kyc.level2.biometric_deleted", target_user_id: customer, reason: "Approved privacy request",
  }]);
});
it("does not duplicate the audit on a completed retry", async () => {
  await db.query("SELECT finalize_kyc_biometric_purge($1,$2,$3,'Approved privacy request')", [id, officer, path]);
  expect((await db.query("SELECT count(*)::integer AS count FROM admin_audit_logs")).rows).toEqual([{ count: 1 }]);
});
it("still requires a selfie for a new pending Lv.2 submission", async () => {
  await expect(db.query("UPDATE kyc_submissions SET level2_status='pending' WHERE id=$1", [id])).rejects.toThrow("valid live selfie");
});