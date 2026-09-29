import { createFileRoute } from "@tanstack/react-router";

/** Daily 00:00 UTC VIP evaluation, called by the database scheduler with a private token. */
export const Route = createFileRoute("/api/public/hooks/vip-evaluate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-cron-token") ?? "";
        if (!token || token.length > 128) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const { data: ok } = await db.rpc("verify_cron_token", { p_name: "vip_evaluate", p_token: token });
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const { evaluateVipLevels } = await import("@/lib/vip-fees.server");
        const result = await evaluateVipLevels(db, null);
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
