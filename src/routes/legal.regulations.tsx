import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Landmark, ShieldCheck } from "lucide-react";
import { BrandLockup } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { REGULATIONS_PAGE } from "@/lib/regulations-content";

export const Route = createFileRoute("/legal/regulations")({
  head: () => ({
    meta: [
      { title: `${REGULATIONS_PAGE.title} | Velocity Trade` },
      { name: "description", content: REGULATIONS_PAGE.subtitle },
      { property: "og:title", content: REGULATIONS_PAGE.title },
      { property: "og:description", content: REGULATIONS_PAGE.subtitle },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegulationsPage,
});

function RegulationsPage() {
  const page = REGULATIONS_PAGE;

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <BrandLockup className="w-44" />
          </Link>
          <Link
            to="/"
            className="touch-manipulation text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to platform
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {page.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{page.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{page.subtitle}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">Last updated: {page.lastUpdated}</p>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
          <Landmark className="mt-0.5 size-5 shrink-0 text-ops-blue" strokeWidth={2.2} />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Each Velocity Trade entity is authorised and supervised by the regulator in its own
            jurisdiction. Expand a region below to view the licences, registrations and exchange
            memberships that apply to it.
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-8 space-y-3">
          {page.jurisdictions.map((j) => (
            <AccordionItem
              key={j.id}
              value={j.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface px-4"
            >
              <AccordionTrigger className="touch-manipulation gap-3 py-4 hover:no-underline">
                <span className="flex min-w-0 items-center gap-3 text-left">
                  <img
                    src={j.flag}
                    alt=""
                    aria-hidden
                    className="size-7 shrink-0 rounded-full border border-border object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold uppercase tracking-wide">
                      {j.country}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{j.entity}</span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <p className="text-sm leading-relaxed text-muted-foreground">{j.summary}</p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {j.badges.map((b) => (
                    <li
                      key={b.name}
                      className="rounded-xl border border-border bg-background p-3.5"
                    >
                      <span className="flex items-center gap-2">
                        <BadgeCheck className="size-4 shrink-0 text-bull" strokeWidth={2.2} />
                        <span className="text-xs font-semibold uppercase tracking-widest">
                          {b.name}
                        </span>
                      </span>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {b.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <section className="mt-10 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-bull" strokeWidth={2.2} />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Verify before you trade
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            You can confirm each entity's registration directly with the relevant national
            regulator before committing funds. If a website or individual claims to represent
            Velocity Trade outside these jurisdictions, treat it as suspicious and review our{" "}
            <Link
              to="/legal/anti-fraud"
              className="font-medium text-ops-blue underline-offset-4 hover:underline"
            >
              Anti-Fraud Notice
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
