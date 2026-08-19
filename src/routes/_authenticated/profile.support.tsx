import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, MessageCircle, ShieldCheck } from "lucide-react";
import { Section, SubPageHeader } from "@/components/profile/ui";
import { TicketDialog } from "@/components/support/TicketDialog";
import { VipChatDialog } from "@/components/support/VipChatDialog";

export const Route = createFileRoute("/_authenticated/profile/support")({
  head: () => ({
    meta: [
      { title: "Contact Support | Velocity Trade" },
      {
        name: "description",
        content:
          "Open a Velocity Trade support ticket or start a live chat with an agent who can see your account context.",
      },
      { property: "og:title", content: "Contact Support — Velocity Trade" },
      {
        property: "og:description",
        content: "Submit a ticket or chat live with the Velocity Trade desk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactSupport,
});

function ContactSupport() {
  const [ticketOpen, setTicketOpen] = useState(false);

  return (
    <>
      <SubPageHeader title="Contact support" description="Tickets and live chat with the trading desk." />

      <Section icon={LifeBuoy} title="Support tickets" description="Track requests and agent replies in one thread.">
        <button
          type="button"
          onClick={() => setTicketOpen(true)}
          className="min-h-10 w-full touch-manipulation rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
        >
          Open ticket centre
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          Include amounts, currencies and timestamps so an agent can resolve your request on the first reply.
        </p>
      </Section>

      <Section icon={MessageCircle} title="Live chat" description="Talk to an agent in real time.">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("velocity:open-chat"))}
          className="min-h-10 w-full touch-manipulation rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary sm:w-auto"
        >
          Start live chat
        </button>
      </Section>

      <TicketDialog open={ticketOpen} onOpenChange={setTicketOpen} />
    </>
  );
}
