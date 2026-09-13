import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { LineChart } from "lucide-react";
import { LEGAL_DOCS } from "@/lib/legal-content";
import { SiteFooter } from "@/components/SiteFooter";
import { CookiePreferencesPanel } from "@/components/CookieConsent";

const EXTRA_DOCS: Record<string, { title: string; body: string[] }> = {
  cookies: {
    title: "Cookie Policy",
    body: [
      "We use first-party cookies and equivalent browser storage in four separate categories: essential, functional, analytics and marketing. Each category is consented to independently.",
      "Essential cookies keep you signed in, protect your session and prevent fraud. They are required for the platform to work and cannot be disabled.",
      "Functional storage remembers interface choices such as theme, language, chart timeframe, preferred markets and dismissed onboarding prompts.",
      "Analytics and marketing technologies do not load until you allow them. You can change or withdraw consent at any time through Cookie Settings in the footer.",
      "Cookies use SameSite protections, are served over HTTPS with the Secure attribute, and expire within a reasonable period. We never store passwords, private keys, authentication secrets or financial details in ordinary cookies.",
    ],
  },
  about: {
    title: "About Velocity Trade",
    body: [
      "Velocity Trade is a multi-asset trading environment covering crypto, equities, futures, forex and precious metals on live market data.",
      "The platform combines a professional charting terminal, micro-duration contracts, multi-fiat and digital asset settlement, and a full compliance workflow for identity verification.",
      "Prices are sourced live from public market venues so execution reflects real market structure.",
    ],
  },
  contact: {
    title: "Contact",
    body: [
      "Support is available in-app through the live chat widget, where an agent can review your account with full context.",
      "For compliance, verification or withdrawal questions, open a support conversation and include your account UID.",
      "We respond to most requests within a few hours during business days.",
    ],
  },
};

export const Route = createFileRoute("/legal/$doc")({
  loader: ({ params }) => {
    const doc =
      EXTRA_DOCS[params.doc] ?? LEGAL_DOCS[params.doc as keyof typeof LEGAL_DOCS] ?? null;
    if (!doc) throw notFound();
    return doc;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} | Velocity Trade` : "Velocity Trade";
    const description = loaderData?.body[0]?.slice(0, 155) ?? "Velocity Trade legal information.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: LegalPage,
  notFoundComponent: () => (
    <div className="p-8 text-sm">
      Document not found.{" "}
      <Link to="/" className="text-primary underline">
        Go home
      </Link>
    </div>
  ),
});

function LegalPage() {
  const doc = Route.useLoaderData();
  const { doc: slug } = Route.useParams();

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <LineChart className="size-4" strokeWidth={2.6} />
            </span>
            <span className="truncate font-display text-sm font-bold">VELOCITY TRADE</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
        <div className="mt-6 space-y-4">
          {doc.body.map((p: string) => (
            <p key={p} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </div>

        {slug === "cookies" && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-bold">Manage your cookie preferences</h2>
            <CookiePreferencesPanel />
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
