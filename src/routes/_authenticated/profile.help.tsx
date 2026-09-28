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
import { isVip } from "@/lib/vip-tiers";

const FILTERS = ["Deposits", "Withdrawals", "Verification / KYC", "Trading & Margin", "Security"] as const;

const TOPICS = [
  {
    icon: ShieldCheck,
    title: "Getting Started & Account Security",
    summary: "Identity, access, and account protection standards.",
    tags: "verification kyc security account password 2fa",
    articles: ["Set up account security", "Reset your password", "Understand KYC levels"],
  },
  {
    icon: WalletCards,
    title: "Deposits & Withdrawals",
    summary: "Funding routes, network reviews, and transfer requirements.",
    tags: "deposits withdrawals network address memo tag pending",
    articles: ["Review supported networks", "Track a pending deposit", "Use address tags and memos"],
  },
  {
    icon: TrendingUp,
    title: "Margin & Derivatives Trading",
    summary: "Institutional guidance for leveraged market execution.",
    tags: "trading margin leverage liquidation contract settlement",
    articles: ["Check leverage limits", "Review liquidation rules", "Understand contract settlements"],
  },
  {
    icon: BadgeDollarSign,
    title: "Fees & VIP Tiers",
    summary: "Trading costs, eligibility, and client rebate structures.",
    tags: "fees vip trading qualification rebate tiers",
    articles: ["View trading fee schedules", "Review VIP qualification", "Understand rebate structures"],
  },
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

  const results = useMemo(() => {
    const term = [query.trim(), activeFilter ?? ""].filter(Boolean).join(" ").toLowerCase();
    if (!term) return TOPICS;
    const terms = term.split(/\s+/).filter((part) => part !== "/" && part !== "&");
    return TOPICS.filter((topic) => {
      const haystack = `${topic.title} ${topic.summary} ${topic.tags} ${topic.articles.join(" ")}`.toLowerCase();
      return terms.some((part) => haystack.includes(part));
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles, account issues, or trading topics..."
              aria-label="Search help articles"
              className="min-h-14 w-full rounded-md border border-help-surface bg-help-surface pl-12 pr-4 text-sm text-help-foreground outline-none transition-colors placeholder:text-help-muted/70 focus:border-help-accent focus:ring-2 focus:ring-help-accent/20"
            />
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Help categories">
            {FILTERS.map((filter) => (
              <Button
                key={filter}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={activeFilter === filter}
                onClick={() => chooseFilter(filter)}
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
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-help-accent">Knowledge base</p>
            <h2 className="mt-1 font-help-display text-xl font-semibold">Browse by topic</h2>
          </div>
          <span className="text-xs text-help-muted">{results.length} categories</span>
        </div>

        {results.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {results.map(({ icon: Icon, title, summary, articles }) => (
              <article key={title} className="group rounded-md border border-help-surface bg-help-surface/40 p-5 transition-colors hover:border-help-accent/60 hover:bg-help-surface/60 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-help-accent/10 text-help-accent">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-help-display text-base font-semibold">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-help-muted">{summary}</p>
                  </div>
                </div>
                <ul className="mt-5 divide-y divide-help-surface border-t border-help-surface">
                  {articles.map((article) => (
                    <li key={article}>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setQuery(article)}
                        className="h-auto min-h-11 w-full justify-between rounded-none px-0 py-3 text-left text-xs font-medium text-help-muted hover:bg-transparent hover:text-help-accent"
                      >
                        <span className="whitespace-normal">{article}</span>
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </article>
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
