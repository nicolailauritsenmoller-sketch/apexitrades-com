import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Search, Scale } from "lucide-react";
import { Section, SubPageHeader } from "@/components/profile/ui";

const FAQS = [
  {
    q: "How do I deposit funds?",
    a: "Open Wallet, choose Deposit, pick the currency and network, then send to the displayed address. Deposits are credited after review.",
  },
  {
    q: "Why is my withdrawal pending?",
    a: "Withdrawals are queued for identity and risk checks. Verified accounts are normally processed within one business day.",
  },
  {
    q: "What is a scalp contract?",
    a: "A timed contract settles automatically after the selected duration using the live market price at expiry against your entry price.",
  },
  {
    q: "How does leverage work here?",
    a: "Leverage multiplies your position size against posted margin, up to 20x. Margin is drawn from the wallet matching the instrument currency.",
  },
  {
    q: "How do I verify my identity?",
    a: "Go to Profile, then Account verification, and upload a government ID plus a proof of address. Review usually completes within 24 hours.",
  },
  {
    q: "Can I change my display currency?",
    a: "Yes — Profile, Settings, Preferences lets you choose USD, EUR, GBP, BTC or USDT for displayed balances.",
  },
  {
    q: "What happens if a position is liquidated?",
    a: "If margin falls below the maintenance level the position closes automatically and the remaining margin returns to your wallet.",
  },
  {
    q: "How do I secure my account?",
    a: "Use a unique password, keep email one-time codes private and remove unknown devices from the Security Center.",
  },
];

export const Route = createFileRoute("/_authenticated/profile/help")({
  head: () => ({
    meta: [
      { title: "Help Center | Velocity Trade" },
      {
        name: "description",
        content:
          "Search the Velocity Trade knowledge base: deposits, withdrawals, micro-duration contracts, leverage, verification and account security.",
      },
      { property: "og:title", content: "Help Center — Velocity Trade" },
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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <>
      <SubPageHeader title="Help Center" description="Answers, documentation and legal resources." />

      <Section icon={Search} title="Search the knowledge base" description="Find an answer before opening a ticket.">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search deposits, leverage, verification…"
          aria-label="Search help articles"
          className="min-h-10 w-full touch-manipulation rounded-xl border border-border bg-background px-3 text-sm"
        />
      </Section>

      <Section icon={BookOpen} title="Frequently asked questions" description={`${results.length} article(s)`}>
        <div className="space-y-2">
          {results.map((f) => (
            <details key={f.q} className="touch-manipulation rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-semibold">{f.q}</summary>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No article matched that search. Try the support desk for a direct answer.
            </p>
          )}
        </div>
      </Section>

      <Section icon={Scale} title="Platform documentation" description="Policies that govern your account.">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { doc: "terms", label: "Terms of Service" },
            { doc: "privacy", label: "Privacy Policy" },
            { doc: "risk", label: "Risk Disclosure" },
            { doc: "aml", label: "AML Policy" },
          ].map((d) => (
            <Link
              key={d.doc}
              to="/legal/$doc"
              params={{ doc: d.doc }}
              className="touch-manipulation rounded-xl border border-border p-3 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              {d.label}
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
