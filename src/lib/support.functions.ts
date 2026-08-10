import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TICKET_CATEGORIES = [
  { id: "account", label: "Account & access" },
  { id: "deposits", label: "Deposits" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "trading", label: "Trading & contracts" },
  { id: "kyc", label: "Identity verification" },
  { id: "general", label: "General enquiry" },
] as const;

export const TICKET_PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
] as const;

export const TICKET_STATUSES = ["open", "pending", "resolved"] as const;

const createInput = z.object({
  subject: z.string().trim().min(4).max(140),
  body: z.string().trim().min(5).max(2000),
  category: z.enum(["account", "deposits", "withdrawals", "trading", "kyc", "general"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        subject: data.subject,
        body: data.body,
        category: data.category,
        priority: data.priority,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: msgError } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: userId,
      sender_role: "user",
      body: data.body,
    });
    if (msgError) throw new Error(msgError.message);

    return ticket;
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
      .object({ ticketId: z.string().uuid(), body: z.string().trim().min(1).max(2000) })
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
    });
    if (error) throw new Error(error.message);

    await supabase
      .from("support_tickets")
      .update({ status: "open" })
      .eq("id", data.ticketId)
      .eq("user_id", userId);

    return { ok: true };
  });
