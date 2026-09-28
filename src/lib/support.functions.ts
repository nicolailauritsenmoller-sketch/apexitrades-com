import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reasons a customer can contact the desk. Legacy ids are kept so old tickets still label correctly. */
export const TICKET_CATEGORIES = [
  { id: "account", label: "Account & Login" },
  { id: "kyc", label: "Verification / KYC" },
  { id: "deposits", label: "Deposits" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "trading", label: "Trading" },
  { id: "wallet", label: "Wallet" },
  { id: "security", label: "Security" },
  { id: "technical", label: "Technical Issue" },
  { id: "fees", label: "Fees & Charges" },
  { id: "settings", label: "Account Settings" },
  { id: "general", label: "General enquiry" },
  { id: "other", label: "Other" },
] as const;

export const TICKET_PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
] as const;

/** Lifecycle states rendered as badges in the customer inbox. */
export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Under Review",
  pending: "Action Required",
  waiting_customer: "Action Required",
  in_progress: "Under Review",
  resolved: "Resolved",
  closed: "Closed",
};

export const TICKET_STATUSES = ["open", "in_progress", "pending", "resolved", "closed"] as const;

const categoryEnum = z.enum([
  "account",
  "kyc",
  "deposits",
  "withdrawals",
  "trading",
  "wallet",
  "security",
  "technical",
  "fees",
  "settings",
  "general",
  "other",
]);

const attachment = z
  .object({
    path: z.string().min(1).max(400),
    name: z.string().min(1).max(200),
    type: z.string().max(120).optional(),
  })
  .optional();

const createInput = z.object({
  subject: z.string().trim().min(4).max(140),
  body: z.string().trim().min(5).max(2000),
  category: categoryEnum,
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
  attachment,
});

/** Account identity used to pre-fill the contact form. */
export const getSupportIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("display_name,email")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      fullName: data?.display_name ?? "",
      email: data?.email ?? (context.claims as any)?.email ?? "",
    };
  });

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const contact = [
      data.fullName ? `Name: ${data.fullName}` : null,
      data.email ? `Email: ${data.email}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const body = contact ? `${data.body}\n\n-\n${contact}` : data.body;

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        subject: data.subject,
        body,
        category: data.category,
        priority: data.priority,
        full_name: data.fullName ?? null,
        email: data.email ?? null,
      } as any)
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: msgError } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: userId,
      sender_role: "user",
      body,
      attachment_path: data.attachment?.path ?? null,
      attachment_name: data.attachment?.name ?? null,
      attachment_type: data.attachment?.type ?? null,
    } as any);
    if (msgError) throw new Error(msgError.message);

    return ticket as typeof ticket & { reference: string | null };
  });

export const listMyTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: tickets, error } = await context.supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const ids = (tickets ?? []).map((t: any) => t.id);
    let messages: any[] = [];
    if (ids.length) {
      const { data: rows } = await context.supabase
        .from("support_ticket_messages")
        .select("*")
        .in("ticket_id", ids)
        .order("created_at");
      messages = rows ?? [];
    }
    return { tickets: tickets ?? [], messages };
  });

export const addTicketMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
        attachment,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id,user_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket || ticket.user_id !== userId) throw new Error("Ticket not found.");

    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: data.ticketId,
      sender_id: userId,
      sender_role: "user",
      body: data.body,
      attachment_path: data.attachment?.path ?? null,
      attachment_name: data.attachment?.name ?? null,
      attachment_type: data.attachment?.type ?? null,
    } as any);
    if (error) throw new Error(error.message);

    await supabase
      .from("support_tickets")
      .update({ status: "open" })
      .eq("id", data.ticketId)
      .eq("user_id", userId);

    return { ok: true };
  });
