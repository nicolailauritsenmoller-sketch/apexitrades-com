import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeDollarSign,
  BookOpen,
  Crown,
  FileCheck2,
  FileLock2,
  Headphones,
  Landmark,
  LockKeyhole,
  ReceiptText,
  Scale,
  Search,
  ShieldCheck,
  TicketCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveChatDialog } from "@/components/support/LiveChatDialog";
import { TicketDialog } from "@/components/support/TicketDialog";
import { VipChatDialog } from "@/components/support/VipChatDialog";
import { getProfileOverview } from "@/lib/profile.functions";
import { StatusBadge } from "@/components/support/TicketDialog";
import { listMyTickets } from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isVip } from "@/lib/vip-tiers";

type FaqCategory = "Getting Started" | "Security & KYC" | "Deposits & Withdrawals" | "Trading & Margin" | "VIP Services";
const CATEGORIES: { name: FaqCategory; icon: typeof ShieldCheck }[] = [
  { name: "Getting Started", icon: BookOpen },
  { name: "Security & KYC", icon: ShieldCheck },
  { name: "Deposits & Withdrawals", icon: WalletCards },
  { name: "Trading & Margin", icon: TrendingUp },
  { name: "VIP Services", icon: Crown },
];

const FAQ: { cat: FaqCategory; q: string; a: string }[] = [
  { cat: "Getting Started", q: "How do I start trading on Velocity Trade?", a: "Complete Level 1 verification, fund your account from the Assets page, then open the Trade Terminal from Markets to place your first order." },
  { cat: "Getting Started", q: "Where can I see my balances and positions?", a: "Portfolio shows your estimated total value, open positions with live P&L, asset breakdown and full trade history." },
  { cat: "Getting Started", q: "How do I contact support?", a: "Use Live Chat for instant help from the Support Assistant or a live agent, or submit a ticket for tracked cases. Your chat history is saved across every page." },
  { cat: "Security & KYC", q: "What are KYC Level 1 and Level 2?", a: "Level 1 confirms your identity with personal details and a government ID. Level 2 adds proof of address and enhanced review. Each level is reviewed independently." },
  { cat: "Security & KYC", q: "Why was my verification rejected?", a: "The rejection reason is shown on your Verification page. Correct the noted issue and use Re-submit to send new documents." },
  { cat: "Security & KYC", q: "How do I enable an authenticator app?", a: "Open Profile > Security, choose Authenticator App, scan the QR code and confirm the 6-digit code. Store your backup codes safely." },
  { cat: "Security & KYC", q: "How do I reset my password?", a: "Signed in: Profile > Security > Change Password. Locked out: use Forgot password on the sign-in screen. Withdrawals may be paused briefly after a change." },
  { cat: "Deposits & Withdrawals", q: "Why is my deposit still pending?", a: "Deposits are credited after the required network confirmations and desk review. Track status and TXID in Assets > Transaction History." },
  { cat: "Deposits & Withdrawals", q: "How long do withdrawals take?", a: "Withdrawals are reviewed by the operations desk before release. Status updates appear live in your Transaction History." },
  { cat: "Deposits & Withdrawals", q: "Do I need a memo or tag?", a: "Some networks require a memo or destination tag. Always copy it exactly as shown on the deposit screen, or funds may be delayed." },
  { cat: "Trading & Margin", q: "How do scalp contracts settle?", a: "A scalp contract locks the entry price at open and settles automatically when the countdown expires, crediting any payout to your wallet." },
  { cat: "Trading & Margin", q: "What is Account Health?", a: "Account Health measures margin and liquidation risk on your open leveraged positions. Add margin or reduce exposure to improve it." },
  { cat: "Trading & Margin", q: "How do I close a position?", a: "Open the Trade Terminal, find the position under Open Positions and click Close. P&L settles into your USDT wallet immediately." },
  { cat: "VIP Services", q: "How do I qualify for VIP?", a: "VIP eligibility is based on your balance and 30-day trading activity. Track your progress on the VIP Upgrade page." },
  { cat: "VIP Services", q: "What does VIP include?", a: "VIP clients receive reduced fees, priority support routing and, at higher levels, a dedicated relationship manager." },
  { cat: "VIP Services", q: "How do I reach my account manager?", a: "Once VIP is active, use Contact VIP Account Manager on the VIP Upgrade page or the VIP Priority Desk below." },
];

const POLICIES = [
  { doc: "terms", label: "Terms of Service", icon: FileCheck2 },
  { doc: "privacy", label: "Privacy Policy", icon: FileLock2 },
  { doc: "risk", label: "Risk Disclosure", icon: Scale },
  { doc: "aml", label: "AML Policy", icon: Landmark },
] as const;

export const Route = createFileRoute("/_authenticated/profile/help")({
  head: () => ({
    meta: [
      { title: "Help Center | Velocity Trade" },
      {
        name: "description",
        content:
          "Search the Velocity Trade knowledge base for deposits, withdrawals, verification, trading, margin, fees and account security.",
      },
      { property: "og:title", content: "Help Center - Velocity Trade" },
      {
        property: "og:description",
        content: "FAQs and platform documentation for traders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpCenter,
});

function HelpCenter() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);
  const fetchProfile = useServerFn(getProfileOverview);
  const profile = useQuery({
    queryKey: ["profile-overview"],
    queryFn: () => fetchProfile(),
    staleTime: 60_000,
  });
  const vipEligible = isVip(profile.data?.profile.vipTier);

  const [tab, setTab] = useState<"kb" | "tickets">("kb");
  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return FAQ.filter((f) => {
      if (activeFilter && f.cat !== activeFilter) return false;
      const hay = `${f.cat} ${f.q} ${f.a}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [activeFilter, query]);

  const chooseFilter = (filter: string) => {
    setActiveFilter((current) => (current === filter ? null : filter));
  };

  return (
    <div className="-mx-1 overflow-hidden rounded-lg border border-help-surface bg-help-background font-help-sans text-help-foreground sm:-mx-2">
      <header className="border-b border-help-surface px-5 py-10 text-center sm:px-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="mx-auto mb-4 grid size-10 place-items-center rounded-md border border-help-surface bg-help-surface text-help-accent">
            <BookOpen className="size-5" />
          </div>
          <h1 className="font-help-display text-3xl font-bold sm:text-4xl">How can we help you?</h1>
          <p className="mt-3 text-sm text-help-muted sm:text-base">
            Search our knowledge base or select a topic below.
          </p>

          <div className="relative mx-auto mt-7 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-help-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setTab("kb"); setQuery(event.target.value); }}
              placeholder="Search articles, account issues, or trading topics..."
              aria-label="Search help articles"
              className="min-h-14 w-full rounded-md border border-help-surface bg-help-surface pl-12 pr-4 text-sm text-help-foreground outline-none transition-colors placeholder:text-help-muted/70 focus:border-help-accent focus:ring-2 focus:ring-help-accent/20"
            />
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Help categories">
            {CATEGORIES.map(({ name: filter }) => (
              <Button
                key={filter}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={activeFilter === filter}
                onClick={() => { setTab("kb"); chooseFilter(filter); }}
                className={activeFilter === filter
                  ? "border border-help-accent bg-help-accent/10 text-help-accent hover:bg-help-accent/15 hover:text-help-accent"
                  : "border border-help-surface bg-help-surface/60 text-help-muted hover:bg-help-surface hover:text-help-foreground"}
              >
                {filter}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 flex gap-1 rounded-md border border-help-surface bg-help-surface/40 p-1" role="tablist">
          {(["kb", "tickets"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-10 flex-1 touch-manipulation rounded px-3 text-sm font-semibold transition-colors ${tab === t ? "bg-help-accent text-help-background" : "text-help-muted hover:text-help-foreground"}`}
            >
              {t === "kb" ? "Knowledge Base" : "My Support Tickets"}
            </button>
          ))}
        </div>

        {tab === "tickets" ? (
          <MyTickets onNew={() => setTicketOpen(true)} onOpen={() => setTicketOpen(true)} />
        ) : results.length ? (
          <div className="space-y-6">
            {CATEGORIES.filter((c) => results.some((r) => r.cat === c.name)).map(({ name, icon: Icon }) => (
              <section key={name}>
                <h3 className="mb-2 flex items-center gap-2 font-help-display text-sm font-semibold">
                  <Icon className="size-4 text-help-accent" /> {name}
                </h3>
                <div className="divide-y divide-help-surface overflow-hidden rounded-md border border-help-surface bg-help-surface/30">
                  {results.filter((r) => r.cat === name).map((f) => (
                    <details key={f.q} className="group" open={Boolean(query.trim())}>
                      <summary className="flex min-h-12 cursor-pointer touch-manipulation list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium hover:text-help-accent">
                        {f.q}
                        <ArrowRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
                      </summary>
                      <p className="px-4 pb-4 text-xs leading-5 text-help-muted">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-help-surface px-5 py-12 text-center">
            <Search className="mx-auto size-7 text-help-muted" />
            <p className="mt-3 text-sm font-semibold">No articles matched your search</p>
            <p className="mt-1 text-xs text-help-muted">Try another phrase or speak with the support desk.</p>
            <Button type="button" variant="outline" className="mt-4 border-help-surface bg-help-surface text-help-foreground" onClick={() => { setQuery(""); setActiveFilter(null); }}>
              Clear search
            </Button>
          </div>
        )}

        <section className="mt-10 border-t border-help-surface pt-8" aria-labelledby="documentation-heading">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-help-surface text-help-accent">
              <ReceiptText className="size-4" />
            </span>
            <div>
              <h2 id="documentation-heading" className="font-help-display text-base font-semibold">Platform documentation</h2>
              <p className="text-xs text-help-muted">Legal and compliance policies governing your account.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POLICIES.map(({ doc, label, icon: Icon }) => (
              <Link
                key={doc}
                to="/legal/$doc"
                params={{ doc }}
                className="group flex min-h-24 touch-manipulation flex-col justify-between rounded-md border border-help-surface bg-help-surface/40 p-4 text-sm font-semibold transition-colors hover:border-help-accent/60 hover:bg-help-surface/70"
              >
                <Icon className="size-4 text-help-muted transition-colors group-hover:text-help-accent" />
                <span className="mt-5 flex items-center justify-between gap-2">
                  {label} <ArrowRight className="size-3.5 text-help-muted" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <aside className="sticky bottom-16 z-20 mx-4 mb-4 rounded-md border border-help-surface bg-help-surface p-4 shadow-xl sm:bottom-4 sm:mx-8 sm:mb-6 sm:p-5" aria-label="Direct support">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-help-background text-help-accent">
              <Headphones className="size-5" />
            </span>
            <div>
              <h2 className="font-help-display text-base font-semibold">Still need assistance?</h2>
              <p className="text-xs text-help-muted">Connect with the support desk or open a tracked case.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex">
            <Button type="button" onClick={() => setChatOpen(true)} className="min-h-10 bg-help-accent text-help-background hover:bg-help-accent/90">
              <Headphones /> Start Live Chat
            </Button>
            <Button type="button" variant="outline" onClick={() => setTicketOpen(true)} className="min-h-10 border-help-muted/30 bg-help-background text-help-foreground hover:bg-help-background/70 hover:text-help-foreground">
              <TicketCheck /> Submit Support Ticket
            </Button>
            {vipEligible ? (
              <Button type="button" onClick={() => setVipOpen(true)} className="min-h-10 sm:col-span-2">
                <Crown /> VIP Priority Desk
              </Button>
            ) : null}
          </div>
        </div>
      </aside>

      <LiveChatDialog open={chatOpen} onOpenChange={setChatOpen} />
      <TicketDialog open={ticketOpen} onOpenChange={setTicketOpen} />
      <VipChatDialog open={vipOpen} onOpenChange={setVipOpen} />
    </div>
  );
}

function MyTickets({ onNew, onOpen }: { onNew: () => void; onOpen: () => void }) {
  const fetchTickets = useServerFn(listMyTickets);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-tickets"], queryFn: () => fetchTickets(), refetchInterval: 20_000 });
  useEffect(() => {
    const ch = supabase
      .channel("help-my-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        qc.invalidateQueries({ queryKey: ["my-tickets"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
  const tickets = ((q.data as { tickets?: unknown[] } | undefined)?.tickets ?? (Array.isArray(q.data) ? q.data : [])) as {
    id: string; reference: string | null; subject: string; category: string; status: string; created_at: string; updated_at: string;
  }[];
  if (q.isLoading) return <p className="py-10 text-center text-sm text-help-muted">Loading your cases...</p>;
  if (!tickets.length)
    return (
      <div className="rounded-md border border-dashed border-help-surface px-5 py-12 text-center">
        <TicketCheck className="mx-auto size-7 text-help-muted" />
        <p className="mt-3 text-sm font-semibold">No support tickets yet</p>
        <p className="mt-1 text-xs text-help-muted">Open a tracked case and follow its status here in real time.</p>
        <Button type="button" className="mt-4 bg-help-accent text-help-background hover:bg-help-accent/90" onClick={onNew}>
          Submit Support Ticket
        </Button>
      </div>
    );
  return (
    <div className="overflow-hidden rounded-md border border-help-surface">
      <div className="hidden grid-cols-[8rem_1fr_9rem_7rem] gap-3 border-b border-help-surface bg-help-surface/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-help-muted sm:grid">
        <span>Case No.</span><span>Subject</span><span>Submitted</span><span className="text-right">Status</span>
      </div>
      <ul className="divide-y divide-help-surface">
        {tickets.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={onOpen} className="grid w-full touch-manipulation grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-help-surface/50 sm:grid-cols-[8rem_1fr_9rem_7rem] sm:items-center">
              <span className="font-mono text-xs font-semibold tabular-nums">#{t.reference ?? t.id.slice(0, 8).toUpperCase()}</span>
              <span className="justify-self-end sm:order-last"><StatusBadge status={t.status} /></span>
              <span className="col-span-2 truncate text-sm sm:col-span-1">{t.subject}<span className="ml-2 text-[11px] text-help-muted">{t.category}</span></span>
              <span className="col-span-2 font-mono text-[11px] tabular-nums text-help-muted sm:col-span-1">
                {new Date(t.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
