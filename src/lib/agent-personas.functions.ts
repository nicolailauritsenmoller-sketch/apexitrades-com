import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff, logAudit, privileged } from "@/lib/desk.server";

const personaShape = z.object({
  label: z.string().trim().min(2).max(60),
  fullName: z.string().trim().min(2).max(80),
  agentRole: z.string().trim().min(2).max(60),
  staffId: z.string().trim().min(2).max(40),
  avatarUrl: z.string().trim().url().max(600).nullable().optional(),
  signature: z.string().trim().max(300).nullable().optional(),
  welcomeMessage: z.string().trim().max(1000).nullable().optional(),
  language: z.enum(["en", "es", "fr", "de", "ar", "zh"]),
  presence: z.enum(["available", "busy", "offline"]),
});

function toRow(p: z.infer<typeof personaShape>) {
  return {
    label: p.label, full_name: p.fullName, agent_role: p.agentRole, staff_id: p.staffId,
    avatar_url: p.avatarUrl || null, signature: p.signature || null,
    welcome_message: p.welcomeMessage || null, language: p.language, presence: p.presence,
  };
}

/** Copies a persona onto the live agent profile that customers see. */
async function activate(db: any, userId: string, persona: any) {
  const { error } = await db.from("agent_profiles").upsert({
    user_id: userId, full_name: persona.full_name, agent_role: persona.agent_role, staff_id: persona.staff_id,
    avatar_url: persona.avatar_url, signature: persona.signature, welcome_message: persona.welcome_message,
    language: persona.language, presence: persona.presence, active_persona_id: persona.id,
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export const getMyPersonas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();
    const [{ data: personas }, { data: live }] = await Promise.all([
      db.from("agent_personas").select("*").eq("user_id", context.userId).order("created_at"),
      db.from("agent_profiles").select("*").eq("user_id", context.userId).maybeSingle(),
    ]);
    return { personas: personas ?? [], live: live ?? null };
  });

export const savePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => personaShape.extend({ id: z.string().uuid().optional(), activate: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    let row: any;
    if (data.id) {
      const { data: prev } = await db.from("agent_personas").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
      if (!prev) throw new Error("Persona not found.");
      const { data: upd, error } = await db.from("agent_personas").update(toRow(data)).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      row = upd;
      await logAudit(db, context.userId, "agent.persona.update", null, { personaId: data.id, label: data.label, avatarChanged: prev.avatar_url !== row.avatar_url });
      if (prev.avatar_url !== row.avatar_url) await logAudit(db, context.userId, "agent.persona.avatar", null, { personaId: data.id });
    } else {
      const { count } = await db.from("agent_personas").select("id", { count: "exact", head: true }).eq("user_id", context.userId);
      if ((count ?? 0) >= 12) throw new Error("Maximum of 12 personas per staff member.");
      const { data: ins, error } = await db.from("agent_personas").insert({ ...toRow(data), user_id: context.userId }).select("*").single();
      if (error) throw new Error(error.message);
      row = ins;
      await logAudit(db, context.userId, "agent.persona.create", null, { personaId: row.id, label: data.label });
    }
    const { data: live } = await db.from("agent_profiles").select("active_persona_id").eq("user_id", context.userId).maybeSingle();
    if (data.activate || !live || live.active_persona_id === row.id) {
      await activate(db, context.userId, row);
      if (data.activate) await logAudit(db, context.userId, "agent.persona.switch", null, { personaId: row.id, label: row.label });
    }
    return { id: row.id };
  });

export const switchPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: p } = await db.from("agent_personas").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!p) throw new Error("Persona not found.");
    await activate(db, context.userId, p);
    await logAudit(db, context.userId, "agent.persona.switch", null, { personaId: p.id, label: p.label });
    return { ok: true };
  });

export const setPersonaPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ presence: z.enum(["available", "busy", "offline"]) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: live } = await db.from("agent_profiles").select("active_persona_id").eq("user_id", context.userId).maybeSingle();
    if (!live) throw new Error("Activate a persona first.");
    await db.from("agent_profiles").update({ presence: data.presence }).eq("user_id", context.userId);
    if (live.active_persona_id) await db.from("agent_personas").update({ presence: data.presence }).eq("id", live.active_persona_id);
    await logAudit(db, context.userId, "agent.persona.presence", null, { presence: data.presence });
    return { ok: true };
  });

export const deletePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: live } = await db.from("agent_profiles").select("active_persona_id").eq("user_id", context.userId).maybeSingle();
    if (live?.active_persona_id === data.id) throw new Error("Switch to another persona before deleting the active one.");
    await db.from("agent_personas").delete().eq("id", data.id).eq("user_id", context.userId);
    await logAudit(db, context.userId, "agent.persona.delete", null, { personaId: data.id });
    return { ok: true };
  });

export const uploadPersonaAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ contentType: z.enum(["image/png", "image/jpeg", "image/webp"]), base64: z.string().max(3_000_000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 2_000_000) throw new Error("Image must be 2 MB or smaller.");
    await db.storage.createBucket("specialist-avatars", { public: true }).catch(() => undefined);
    const path = `agents/${context.userId}/${Date.now()}.${data.contentType.split("/")[1]}`;
    const { error } = await db.storage.from("specialist-avatars").upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, "agent.persona.avatar_upload", null, { path });
    return { url: db.storage.from("specialist-avatars").getPublicUrl(path).data.publicUrl as string };
  });

/** Server helper: active signature for outbound replies. */
export async function appendSignature(db: any, userId: string, body: string) {
  const { data } = await db.from("agent_profiles").select("signature").eq("user_id", userId).maybeSingle();
  const sig = (data?.signature ?? "").trim();
  return sig && !body.trimEnd().endsWith(sig) ? `${body.trimEnd()}\n\n${sig}` : body;
}
