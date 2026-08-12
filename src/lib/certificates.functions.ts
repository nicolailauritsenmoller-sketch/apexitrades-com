import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, privileged } from "@/lib/desk.server";
import { mapCertificate, signCertificateDoc } from "@/lib/certificates.server";

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  issuer: z.string().trim().max(120).default(""),
  category: z.string().trim().max(60).default("security"),
  badgeKey: z.enum(["iso", "soc2", "gdpr", "ssl", "custody"]).default("iso"),
  badgeUrl: z.string().trim().max(500).optional().nullable(),
  documentUrl: z.string().trim().max(500).optional().nullable(),
  summary: z.string().trim().max(600).default(""),
  issueDate: z.string().trim().max(20).optional().nullable(),
  expiryDate: z.string().trim().max(20).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

/** Full list for the admin console. */
export const listCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data } = await db
      .from("certificates")
      .select("*")
      .order("sort_order", { ascending: true });
    return (data ?? []).map(mapCertificate);
  });

export const upsertCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const row = {
      title: data.title,
      issuer: data.issuer,
      category: data.category,
      badge_key: data.badgeKey,
      badge_url: data.badgeUrl || null,
      document_url: data.documentUrl || null,
      summary: data.summary,
      issue_date: data.issueDate || null,
      expiry_date: data.expiryDate || null,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    };
    const { error } = data.id
      ? await db.from("certificates").update(row).eq("id", data.id)
      : await db.from("certificates").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db.from("certificates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Short-lived link so visitors can open a stored verification document. */
export const getCertificateDocumentUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    return { url: await signCertificateDoc(data.id) };
  });
