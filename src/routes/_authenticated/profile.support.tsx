import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, FilePlus2, Inbox, MessageCircle, ShieldCheck } from "lucide-react";
import { SubPageHeader } from "@/components/profile/ui";
import { TicketDialog } from "@/components/support/TicketDialog";
import { VipChatDialog } from "@/components/support/VipChatDialog";
import { LiveChatDialog } from "@/components/support/LiveChatDialog";


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
  const [ticketTab, setTicketTab] = useState<"submit" | "tickets">("submit");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const openTickets = (tab: "submit" | "tickets") => {
    setTicketTab(tab);
    setTicketOpen(true);
  };

  const items = [
    {
      icon: FilePlus2,
      title: "Submit request",
      description: "Create a new support request and receive an instant ticket reference number.",
      onClick: () => openTickets("submit"),
      tone: "text-primary",
    },
    {
      icon: Inbox,
      title: "Support tickets",
      description: "View and manage existing support requests and conversation threads.",
      onClick: () => openTickets("tickets"),
      tone: "text-foreground",
    },
    {
      icon: MessageCircle,
      title: "Live chat",
      description: "Start a real-time chat with customer support.",
      onClick: () => setChatOpen(true),
      tone: "text-foreground",
    },
    {
      icon: ShieldCheck,
      title: "Priority support",
      description: "Priority support for eligible VIP customers.",
      onClick: () => setVipOpen(true),
      tone: "text-emerald-600",
    },
  ];

  return (
    <>
      <SubPageHeader title="Contact support" description="Requests, tickets and live help from the trading desk." />

      <div className="touch-manipulation overflow-hidden rounded-2xl border border-border bg-card">
        {items.map(({ icon: Icon, title, description, onClick, tone }, i) => (
          <button
            key={title}
            type="button"
            onClick={onClick}
            className={`flex w-full touch-manipulation items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary">
              <Icon className={`size-4.5 ${tone}`} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-muted-foreground">{description}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      <TicketDialog open={ticketOpen} onOpenChange={setTicketOpen} defaultTab={ticketTab} />
      <VipChatDialog open={vipOpen} onOpenChange={setVipOpen} />
      <LiveChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}

