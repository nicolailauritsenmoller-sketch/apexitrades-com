/** Server-only helpers for compliance certificates. */

export type CertificateRecord = {
  id: string;
  title: string;
  issuer: string;
  category: string;
  badgeKey: string;
  badgeUrl: string | null;
  documentUrl: string | null;
  summary: string;
  issueDate: string | null;
  expiryDate: string | null;
  isActive: boolean;
  sortOrder: number;
};

export function mapCertificate(row: any): CertificateRecord {
  return {
    id: row.id,
    title: row.title,
    issuer: row.issuer ?? "",
    category: row.category ?? "security",
    badgeKey: row.badge_key ?? "iso",
    badgeUrl: row.badge_url ?? null,
    documentUrl: row.document_url ?? null,
    summary: row.summary ?? "",
    issueDate: row.issue_date ?? null,
    expiryDate: row.expiry_date ?? null,
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/**
 * Resolves a certificate's verification document to an openable URL.
 * Absolute links pass through; storage paths are signed for five minutes.
 */
export async function signCertificateDoc(id: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data } = await db
    .from("certificates")
    .select("document_url,is_active")
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.is_active || !data.document_url) return null;

  const path = String(data.document_url);
  if (/^https?:\/\//i.test(path)) return path;

  const { data: signed } = await db.storage.from("certificates").createSignedUrl(path, 300);
  return signed?.signedUrl ?? null;
}
