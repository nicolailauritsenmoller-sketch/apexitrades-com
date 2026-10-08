import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight,
  CircleCheck,
  Crown,
  Headphones,
  LifeBuoy,
  Loader2,
  Search,
  ShieldCheck,
  TicketCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TicketDialog } from "@/components/support/TicketDialog";
import { SupportUnreadBadge } from "@/components/support/SupportUnreadBadge";
import { LiveChatDialog } from "@/components/support/LiveChatDialog";
import { getProfileOverview } from "@/lib/profile.functions";
import { createSupportTicket } from "@/lib/support.functions";
import { VIP1_THRESHOLD_USDT, isVip } from "@/lib/vip-tiers";

export const Route = createFileRoute("/_authenticated/profile/support")({
  head: () => ({
    meta: [
      { title: "Velocity Support Desk | Velocity Trade" },
      {
        name: "description",
        content:
          "Search help topics, manage support tickets, or reach the Velocity Trade trading desk around the clock.",
      },
      { property: "og:title", content: "Velocity Support Desk - Velocity Trade" },
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
  const navigate = useNavigate();
  const [ticketTab, setTicketTab] = useState<"submit" | "tickets">("submit");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [vipGateOpen, setVipGateOpen] = useState(false);
  const [txidOpen, setTxidOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAction, setChatAction] = useState<"agent" | "vip-desk" | undefined>(undefined);
  const [search, setSearch] = useState("");

  const fetchOverview = useServerFn(getProfileOverview);
  const overview = useQuery({
    queryKey: ["profile-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 30_000,
  });
  const vipActive = isVip((overview.data as any)?.profile?.vipTier);

  const openTickets = (tab: "submit" | "tickets") => {
    setTicketTab(tab);
    setTicketOpen(true);
  };

  const openChat = (action?: "agent" | "vip-desk") => {
    setChatAction(action);
    setChatOpen(true);
  };

  const openConcierge = () => {
    if (vipActive) {
      openChat("vip-desk");
    } else {
      setVipGateOpen(true);
    }
  };

  const items = [
    {
      icon: Headphones,
      title: "Live Support & Desk Chat",
      description: "Launch real-time messaging with support agents immediately.",
      action: "Start live chat",
      keywords: "agent message assistance help",
      onClick: () => openChat("agent"),
    },
    {
      icon: WalletCards,
      title: "Deposit & Withdrawal Issues",
      description:
        "Self-service tools for missing hashes, delayed network confirmations, or memo tags.",
      action: "Report a transaction",
      keywords: "deposit withdrawal transaction hash network confirmation memo funds",
      onClick: () => setTxidOpen(true),
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
          <Button onClick={openConcierge} className="min-h-11 shrink-0">
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
                  className="group flex touch-manipulation items-start gap-4 rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/50 sm:min-h-44"
                >
                  {content}
                </Link>
              ) : (
                <Button
                  key={title}
                  type="button"
                  variant="ghost"
                  onClick={onClick}
                  className="group h-auto w-full items-start justify-start whitespace-normal rounded-lg border border-border bg-card p-5 text-left shadow-none hover:border-primary/40 hover:bg-secondary/50 sm:min-h-44"
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
              <Button onClick={() => openChat("agent")} className="relative">
                Start live chat
                <SupportUnreadBadge />
              </Button>
            </div>
          </div>
        )}
      </section>

      <TicketDialog open={ticketOpen} onOpenChange={setTicketOpen} defaultTab={ticketTab} />
      <LiveChatDialog open={chatOpen} onOpenChange={setChatOpen} initialAction={chatAction} />

      {/* VIP qualification gate for non-VIP accounts */}
      <Dialog open={vipGateOpen} onOpenChange={setVipGateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="size-5 text-primary" /> VIP Dedicated Desk
            </DialogTitle>
            <DialogDescription>
              The VIP concierge is reserved for accounts with active VIP status.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm leading-6">
            <p className="font-semibold">VIP qualification</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                {VIP1_THRESHOLD_USDT.toLocaleString("en-US")} USDT minimum balance requirement
              </li>
              <li>Zero trading fees on all markets</li>
              <li>Priority 24/7 dedicated account manager</li>
              <li>Elevated daily withdrawal limits</li>
            </ul>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="min-h-11 flex-1"
              onClick={() => {
                setVipGateOpen(false);
                void navigate({ to: "/vip-upgrade" });
              }}
            >
              Upgrade to VIP / Deposit Funds <ArrowRight />
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => setVipGateOpen(false)}>
              Not now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TxidReportDialog
        open={txidOpen}
        onOpenChange={setTxidOpen}
        onSubmitted={() => openTickets("tickets")}
      />
    </>
  );
}

/** Streamlined delayed deposit/withdrawal report: paste the TXID and submit. */
function TxidReportDialog({
  open,
  onOpenChange,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmitted: () => void;
}) {
  const [kind, setKind] = useState<"deposits" | "withdrawals">("deposits");
  const [txid, setTxid] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createTicket = useServerFn(createSupportTicket);

  const reset = () => {
    setTxid("");
    setNote("");
    setKind("deposits");
  };

  const submit = async () => {
    const hash = txid.trim();
    if (hash.length < 8) {
      toast.error("Paste a valid transaction hash (TXID).");
      return;
    }
    setSubmitting(true);
    try {
      await createTicket({
        data: {
          subject: `${kind === "deposits" ? "Deposit" : "Withdrawal"} review - TXID ${hash.slice(0, 12)}...`,
          body: `Transaction hash (TXID): ${hash}\n\n${note.trim() || "Please review this delayed transaction."}`,
          category: kind,
          priority: "normal",
        },
      });
      toast.success("Transaction reported - the desk is reviewing it.");
      onOpenChange(false);
      reset();
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit the report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletCards className="size-5 text-primary" /> Report a transaction
          </DialogTitle>
          <DialogDescription>
            Paste the transaction hash (TXID) for a delayed deposit or withdrawal review.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "deposits", label: "Deposit" },
              { id: "withdrawals", label: "Withdrawal" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setKind(opt.id)}
              className={`min-h-11 rounded-lg border text-sm font-semibold transition-colors ${
                kind === opt.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="block text-xs font-semibold text-muted-foreground">
          Transaction hash (TXID)
          <input
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            placeholder="e.g. 0x9f2c... or a64b..."
            className="mt-1.5 min-h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </label>

        <label className="block text-xs font-semibold text-muted-foreground">
          Note for the desk (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Asset, amount, when you sent it..."
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </label>

        <Button onClick={() => void submit()} disabled={submitting} className="min-h-11 w-full">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Submit for review
        </Button>
      </DialogContent>
    </Dialog>
  );
}
