import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { moderateRows } from "./discovery-policy";

const db = new PGlite();
const migration = readFileSync("drizzle/migrations/0055_scope_scalping_and_discovery_reads.sql", "utf8");
const publicPolicyFix = readFileSync("drizzle/migrations/0056_separate_public_moderation_policy.sql", "utf8");
const userId = "bcb48f8e-1f83-46e4-a492-9f63ba39c15a";
const adminId = "ce4e4ee3-68b3-4c8e-98a4-19ae6dd1c2d3";

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
    CREATE FUNCTION public.has_role(id uuid, role public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT id = '${adminId}'::uuid AND role = 'admin'::public.app_role $$;
    REVOKE EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;
    CREATE TABLE public.scalping_tier_rules(id text, active boolean, deleted_at timestamptz, audit_reason text);
    CREATE TABLE public.discovery_moderation(content_kind text, content_id text, status text, priority integer, reason text, reviewed_by uuid);
    GRANT SELECT(id, active, deleted_at) ON public.scalping_tier_rules TO authenticated;
    GRANT SELECT(content_kind, content_id, status, priority) ON public.discovery_moderation TO anon, authenticated;
    GRANT ALL ON public.scalping_tier_rules, public.discovery_moderation TO service_role;
    ALTER TABLE public.scalping_tier_rules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.discovery_moderation ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Authenticated users read configuration metadata" ON public.scalping_tier_rules FOR SELECT TO authenticated USING(true);
    CREATE POLICY moderation_read ON public.discovery_moderation FOR SELECT TO anon, authenticated USING(true);
    INSERT INTO public.scalping_tier_rules VALUES ('live',true,NULL,''),('inactive',false,NULL,''),('deleted',true,now(),'');
    INSERT INTO public.discovery_moderation VALUES ('news','approved','approved',0,'private', '${adminId}'),('news','hidden','hidden',0,'private','${adminId}'),('news','featured','featured',5,'private','${adminId}');
  `);
  await db.exec(migration);
  await db.exec(publicPolicyFix);
}, 30000);
afterAll(async () => { await db.close(); });

async function asRole<T>(role: "anon" | "authenticated" | "service_role", uid: string, sql: string) {
  await db.exec(`SET ROLE ${role}`);
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
    return (await db.query<T>(sql)).rows;
  } finally { await db.exec("RESET ROLE"); }
}

describe("Scoped configuration read policies", () => {
  it("exposes only live non-deleted tiers to ordinary traders", async () => {
    expect(await asRole("authenticated", userId, "SELECT id FROM public.scalping_tier_rules ORDER BY id")).toEqual([{ id: "live" }]);
  });
  it("preserves administrator access to inactive and deleted tiers", async () => {
    expect(await asRole("authenticated", adminId, "SELECT id FROM public.scalping_tier_rules ORDER BY id")).toHaveLength(3);
  });
  it("denies anonymous access to trading configuration", async () => {
    await expect(asRole("anon", "", "SELECT id FROM public.scalping_tier_rules")).rejects.toThrow("permission denied");
  });
  it.each(["anon", "authenticated"] as const)("limits %s moderation reads without changing feed filtering", async role => {
    const rules = await asRole<{ content_kind: string; content_id: string; status: string; priority: number }>(role, role === "anon" ? "" : userId, "SELECT content_kind,content_id,status,priority FROM public.discovery_moderation");
    expect(rules.map(row => row.status).sort()).toEqual(["featured", "hidden"]);
    expect(moderateRows(["approved", "hidden", "featured", "unmoderated"], "news", rules, row => row)).toEqual(["featured", "approved", "unmoderated"]);
  });
  it("preserves administrator inspection of all moderation decisions", async () => {
    expect(await asRole("authenticated", adminId, "SELECT content_id FROM public.discovery_moderation")).toHaveLength(3);
  });
  it("keeps private columns inaccessible despite administrator row visibility", async () => {
    await expect(asRole("authenticated", adminId, "SELECT reason,reviewed_by FROM public.discovery_moderation")).rejects.toThrow("permission denied");
    await expect(asRole("authenticated", userId, "SELECT audit_reason FROM public.scalping_tier_rules")).rejects.toThrow("permission denied");
  });
  it("preserves authorized privileged access", async () => {
    expect(await asRole("service_role", "", "SELECT * FROM public.discovery_moderation")).toHaveLength(3);
  });
  it("serves public feed directives without permission to inspect administrator roles", async () => {
    await expect(asRole("anon", "", "SELECT public.has_role(auth.uid(),'admin'::public.app_role)")).rejects.toThrow("permission denied");
    expect(await asRole("anon", "", "SELECT content_id FROM public.discovery_moderation")).toHaveLength(2);
  });
});