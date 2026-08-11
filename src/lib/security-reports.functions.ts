import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff, logAudit, privileged } from "@/lib/desk.server";

const category = z.enum([
  "account_takeover",
  "phishing",
  "vulnerability",
  "payment_fraud",
  "data_privacy",
  "other",
]);
const severity = z.enum(["low", "medium", "high", "critical"]);

export const createSecurityReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        category,
        severity,
        description: z.string().trim().min(10).max(4000),
        attachmentPath: z.string().trim().max(400).nullable().optional(),
        attachmentName: z.string().trim().max(200).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await privileged();
    const { error } = await db.from("security_reports").insert({
      user_id: context.userId,
      category: data.category,
      severity: data.severity,
      description: data.description,
      attachment_path: data.attachmentPath ?? null,
      attachment_name: data.attachmentName ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMySecurityReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("security_reports")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      category: r.category,
      severity: r.severity,
      description: r.description,
      status: r.status,
      adminNote: r.admin_note,
      attachmentName: r.attachment_name,
      createdAt: r.created_at,
    }));
  });

export const listSecurityReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: rows } = await db
      .from("security_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    const list: any[] = rows ?? [];
    const ids = [...new Set(list.map((r) => r.user_id))];
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id,display_name,uid").in("id", ids)
      : { data: [] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return list.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: (map.get(r.user_id) as any)?.display_name ?? "Trader",
      userUid: (map.get(r.user_id) as any)?.uid ?? r.user_id.slice(0, 8),
      category: r.category,
      severity: r.severity,
      description: r.description,
      status: r.status,
      adminNote: r.admin_note,
      attachmentPath: r.attachment_path,
      attachmentName: r.attachment_name,
      createdAt: r.created_at,
    }));
  });

export const reviewSecurityReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "investigating", "resolved", "dismissed"]),
        adminNote: z.string().trim().max(2000).optional(),
        notifyUser: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: report } = await db
      .from("security_reports")
      .select("id,user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!report) throw new Error("Report not found.");

    const { error } = await db
      .from("security_reports")
      .update({
        status: data.status,
        admin_note: data.adminNote ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.notifyUser) {
      await db.from("notifications").insert({
        user_id: report.user_id,
        title: `Security report ${data.status}`,
        body: data.adminNote?.length
          ? data.adminNote
          : `Our security team updated your report status to ${data.status}.`,
        kind: "security",
      });
    }

    await logAudit(db, context.userId, "security_report.review", report.user_id, {
      reportId: data.id,
      status: data.status,
    });
    return { ok: true };
  });

export const getSecurityAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: report } = await db
      .from("security_reports")
      .select("attachment_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!report?.attachment_path) return { url: null };
    const { data: signed } = await db.storage
      .from("security-reports")
      .createSignedUrl(report.attachment_path, 900);
    return { url: signed?.signedUrl ?? null };
  });
