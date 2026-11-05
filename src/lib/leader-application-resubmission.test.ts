import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
const migration = readFileSync("drizzle/migrations/0062_leader_application_resubmission.sql", "utf8");
const applicant = "11111111-1111-4111-8111-111111111111";
const approvedOwner = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE public.copy_leader_applications(
      user_id uuid PRIMARY KEY,
      public_name text NOT NULL CHECK (char_length(public_name) BETWEEN 2 AND 60),
      bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 400),
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','review','approved','rejected','suspended')),
      consent_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    GRANT SELECT, INSERT ON public.copy_leader_applications TO authenticated;
    GRANT ALL ON public.copy_leader_applications TO service_role;
    ALTER TABLE public.copy_leader_applications ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Read own copy leader application" ON public.copy_leader_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
    CREATE POLICY "Apply as consenting copy leader" ON public.copy_leader_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
    INSERT INTO public.copy_leader_applications(user_id,public_name,bio,status) VALUES
      ('${applicant}','OldHandle','Original mandate','rejected'),
      ('${approvedOwner}','ApprovedTrader','Approved mandate','approved');
  `);
  await db.exec(migration);
}, 30000);
afterAll(async () => { await db.close(); });

async function asRole<T>(role: "anon" | "authenticated" | "service_role", uid: string, sql: string) {
  await db.exec(`SET ROLE ${role}`);
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
    return (await db.query<T>(sql)).rows;
  } finally { await db.exec("RESET ROLE"); }
}

async function state(userId: string) {
  return (await db.query<{ status: string; public_name: string; bio: string }>(
    `SELECT status,public_name,bio FROM public.copy_leader_applications WHERE user_id='${userId}'`,
  )).rows[0];
}

describe("Rejected leader application resubmission", () => {
  it("stops the applicant approving their own rejected application", async () => {
    await expect(asRole("authenticated", applicant, `UPDATE public.copy_leader_applications SET status='approved' WHERE user_id='${applicant}'`)).rejects.toThrow("row-level security");
    expect((await state(applicant)).status).toBe("rejected");
  });
  it("stops another trader rewriting a rejected application", async () => {
    await asRole("authenticated", stranger, `UPDATE public.copy_leader_applications SET public_name='Hijacked' WHERE user_id='${applicant}'`);
    expect((await state(applicant)).public_name).toBe("OldHandle");
  });
  it("keeps an approved application frozen", async () => {
    await asRole("authenticated", approvedOwner, `UPDATE public.copy_leader_applications SET public_name='Changed', status='rejected' WHERE user_id='${approvedOwner}'`);
    expect(await state(approvedOwner)).toEqual({ status: "approved", public_name: "ApprovedTrader", bio: "Approved mandate" });
  });
  it("returns a rejected application to review with the trader's revisions", async () => {
    await asRole("authenticated", applicant, `UPDATE public.copy_leader_applications SET public_name='NewHandle', bio='Revised mandate', status='pending', consent_at=now(), updated_at=now() WHERE user_id='${applicant}'`);
    expect(await state(applicant)).toEqual({ status: "pending", public_name: "NewHandle", bio: "Revised mandate" });
  });
});
