import { createFileRoute, Link } from "@tanstack/react-router";
import { Landmark, ShieldCheck } from "lucide-react";
import { BrandLockup } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { REGULATIONS_PAGE } from "@/lib/regulations-content";
import ciroMark from "@/assets/regulators/ciro.png.asset.json";
import cipfMark from "@/assets/regulators/cipf.png.asset.json";

const regulatorPresentation: Record<string, { label: string; caption: string; image?: string }> = {
  ASIC: { label: "ASIC", caption: "Australian Securities and Investments Commission" },
  ASX: { label: "ASX", caption: "Australian Securities Exchange" },
  CIRO: { label: "CIRO", caption: "Canadian Investment Regulatory Organization", image: ciroMark.url },
  CIPF: { label: "CIPF", caption: "Canadian Investor Protection Fund", image: cipfMark.url },
  "TMX / Toronto Stock Exchange": { label: "TMX", caption: "Toronto Stock Exchange" },
  FINTRAC: { label: "FINTRAC", caption: "Financial Transactions and Reports Analysis Centre of Canada" },
  AFM: { label: "AFM", caption: "Authority for the Financial Markets" },
  FMA: { label: "FMA", caption: "Financial Markets Authority New Zealand" },
  FSCA: { label: "FSCA", caption: "Financial Sector Conduct Authority" },
  STRATE: { label: "strate", caption: "Central Securities Depository" },
  FCA: { label: "FCA", caption: "Financial Conduct Authority" },
  MAS: { label: "MAS", caption: "Monetary Authority of Singapore" },
  "SEC / FINRA framework": { label: "SEC / FINRA", caption: "US regulatory framework" },
};

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

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
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
              className="overflow-hidden rounded-sm border border-border bg-background"
            >
              <AccordionTrigger className="touch-manipulation gap-3 px-5 py-5 hover:no-underline sm:px-8">
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
              <AccordionContent className="bg-surface px-5 py-7 sm:px-8 sm:py-8">
                <div className="grid items-start gap-7 md:grid-cols-2 md:gap-10">
                  <div>
                    <p className="text-sm leading-7 text-foreground">{j.summary}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
                      {j.badges.map((b) => <li key={b.name}>{b.detail}</li>)}
                    </ul>
                  </div>
                  <ul aria-label={`${j.country} regulators`} className="flex flex-wrap justify-center gap-y-4">
                    {j.badges.filter((b) => regulatorPresentation[b.name]).map((b) => {
                      const badge = regulatorPresentation[b.name];
                      if (!badge) return null;
                      return (
                        <li key={b.name} className="flex h-[120px] w-1/2 max-w-[185px] flex-col items-center justify-center border border-border bg-card px-3 text-center text-regulator-ink">
                          {badge.image ? (
                            <span className="flex h-[82px] w-full items-center justify-center bg-regulator-mark-surface">
                              <img src={badge.image} alt={badge.caption} className="max-h-[76px] w-[132px] max-w-full object-contain" />
                            </span>
                          ) : (
                            <>
                              <span className="text-2xl font-extrabold leading-tight">{badge.label}</span>
                              <span className="mt-1 text-xs leading-[1.4]">{badge.caption}</span>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
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
