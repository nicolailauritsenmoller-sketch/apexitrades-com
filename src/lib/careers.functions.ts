import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { assertAdmin } from "@/lib/desk.server";
import { openingSchema, toOpeningRow, type CareerOpening } from "@/lib/careers-shared";

const PUBLIC_COLUMNS = "id,title,business_group,country,location,employment_type,work_mode,duration,tags,description,requirements,application_url,featured,status,published_at,updated_at";

export const listPublishedOpenings = createServerFn({ method: "GET" }).handler(async (): Promise<CareerOpening[]> => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const db = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization"); h.set("apikey", key); return fetch(input, { ...init, headers: h }); } },
  });
  const { data, error } = await db.from("careers_openings").select(PUBLIC_COLUMNS).eq("status", "published").order("published_at", { ascending: false }).limit(200);
  if (error) { console.error("Careers openings unavailable", error.message); return []; }
  return (data ?? []) as CareerOpening[];
});

export const listManagedOpenings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const { data, error } = await context.supabase.from("careers_openings").select(PUBLIC_COLUMNS).order("updated_at", { ascending: false }).limit(500);
  if (error) throw new Error("Could not load careers openings.");
  return (data ?? []) as CareerOpening[];
});

export const saveOpening = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => openingSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const row = toOpeningRow(data);
    const result = data.id
      ? await context.supabase.from("careers_openings").update(row).eq("id", data.id).select("id").single()
      : await context.supabase.from("careers_openings").insert(row).select("id").single();
    if (result.error) throw new Error("Could not save this opening. Check the required fields.");
    return { id: result.data.id as string };
  });

export const deleteOpening = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("careers_openings").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete this opening.");
    return { ok: true };
  });
