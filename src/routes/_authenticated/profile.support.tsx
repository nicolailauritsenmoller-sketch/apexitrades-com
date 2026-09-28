import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CircleCheck,
  Crown,
  Headphones,
  LifeBuoy,
  Search,
  ShieldCheck,
  TicketCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketDialog } from "@/components/support/TicketDialog";
import { VipChatDialog } from "@/components/support/VipChatDialog";
import { SupportUnreadBadge } from "@/components/support/SupportUnreadBadge";
import { LiveChatDialog } from "@/components/support/LiveChatDialog";

export const Route = createFileRoute("/_authenticated/profile/support")({
  head: () => ({
    meta: [
      { title: "Velocity Support Desk | Velocity Trade" },
      {
        name: "description",
        content:
          "Search help topics, manage support tickets, or reach the Velocity Trade trading desk around the clock.",
      },
      { property: "og:title", content: "Velocity Support Desk — Velocity Trade" },
      {
        property: "og:description",
        content: "Search help topics, manage tickets, or reach 24/7 trading desk assistance.",
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
  const [search, setSearch] = useState("");

  const openTickets = (tab: "submit" | "tickets") => {
    setTicketTab(tab);
    setTicketOpen(true);
  };

  const items = [
    {
      icon: Headphones,
      title: "Live Support & Desk Chat",
      description: "Launch real-time messaging with support agents immediately.",
      action: "Start live chat",
      keywords: "agent message assistance help",
      onClick: () => setChatOpen(true),
    },
    {
      icon: WalletCards,
      title: "Deposit & Withdrawal Issues",
      description:
        "Self-service tools for missing hashes, delayed network confirmations, or memo tags.",
      action: "Report a transaction",
      keywords: "deposit withdrawal transaction hash network confirmation memo funds",
      onClick: () => openTickets("submit"),
    },
    {
      icon: ShieldCheck,
      title: "Account Security & KYC",
      description: "Quick access to security resets, password changes, and verification reviews.",
      action: "Review account security",
      keywords: "security password verification kyc identity account reset",
      to: "/profile/security",
    },
    {
      icon: TicketCheck,
      title: "Support Ticket Center",
      description: "View active, resolved, or pending support tickets with reference numbers.",
      action: "Manage tickets",
      keywords: "ticket request active resolved pending reference case",
      onClick: () => openTickets("tickets"),
    },
  ];

  const term = search.trim().toLowerCase();
  const visibleItems = term
    ? items.filter((item) =>
        `${item.title} ${item.description} ${item.keywords}`.toLowerCase().includes(term),
      )
    : items;

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-7 sm:px-8 sm:py-9">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <LifeBuoy className="size-4 text-primary" />
            Institutional Client Services
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
            Velocity Support Desk
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Search topics, manage tickets, or reach 24/7 trading desk assistance.
          </p>

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search help articles, transaction issues, or security..."
              aria-label="Search support topics"
              className="min-h-14 w-full rounded-lg border border-input bg-background pl-12 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 bg-secondary/40 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="inline-flex items-center gap-2 font-semibold text-bull">
            <span className="size-2 rounded-full bg-bull" /> All Systems Operational
          </span>
          <span className="text-muted-foreground">Average Response Time: &lt; 2 mins</span>
        </div>
      </section>

      <section className="rounded-xl border border-primary/40 bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Crown className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold">VIP Dedicated Desk</h2>
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                  Priority
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Eligible VIP clients receive direct one-on-one priority messaging with an assigned
                account manager.
              </p>
            </div>
          </div>
          <Button onClick={() => setVipOpen(true)} className="min-h-11 shrink-0">
            Open VIP concierge <ArrowRight />
          </Button>
        </div>
      </section>

      <section aria-labelledby="support-paths-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="support-paths-heading" className="font-display text-lg font-bold">
              How can we help?
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Choose a desk for faster routing.</p>
          </div>
          <Link
            to="/profile/help"
            className="hidden text-xs font-semibold text-primary hover:underline sm:block"
          >
            Browse all articles
          </Link>
        </div>

        {visibleItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleItems.map(({ icon: Icon, title, description, action, onClick, to }) => {
              const content = (
                <>
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-secondary text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                    <Icon className="size-4.5" />
                    {title.startsWith("Live Support") && <SupportUnreadBadge />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-foreground">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {description}
                    </span>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                      {action} <ArrowRight className="size-3.5" />
                    </span>
                  </span>
                </>
              );

              return to ? (
                <Link
                  key={title}
                  to={to}
                  className="group flex min-h-44 touch-manipulation items-start gap-4 rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/50"
                >
                  {content}
                </Link>
              ) : (
                <Button
                  key={title}
                  type="button"
                  variant="ghost"
                  onClick={onClick}
                  className="group h-auto min-h-44 w-full items-start justify-start whitespace-normal rounded-lg border border-border bg-card p-5 text-left shadow-none hover:border-primary/40 hover:bg-secondary/50"
                >
                  {content}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card px-5 py-10 text-center">
            <CircleCheck className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No direct support path found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse the help center or start a live chat with the desk.
            </p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link to="/profile/help">Browse help center</Link>
              </Button>
              <Button onClick={() => setChatOpen(true)} className="relative">Start live chat<SupportUnreadBadge /></Button>
            </div>
          </div>
        )}
      </section>

      <TicketDialog open={ticketOpen} onOpenChange={setTicketOpen} defaultTab={ticketTab} />
      <VipChatDialog open={vipOpen} onOpenChange={setVipOpen} />
      <LiveChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
