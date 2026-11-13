import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import { BrandLockup } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { ANTI_FRAUD_NOTICE } from "@/lib/anti-fraud-content";

export const Route = createFileRoute("/legal/anti-fraud")({
  head: () => ({
    meta: [
      { title: `${ANTI_FRAUD_NOTICE.title} | Velocity Trade` },
      { name: "description", content: ANTI_FRAUD_NOTICE.summary },
      { property: "og:title", content: ANTI_FRAUD_NOTICE.title },
      { property: "og:description", content: ANTI_FRAUD_NOTICE.summary },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AntiFraudNoticePage,
});

function AntiFraudNoticePage() {
  const notice = ANTI_FRAUD_NOTICE;

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
          {notice.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{notice.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{notice.summary}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">Last updated: {notice.lastUpdated}</p>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-alert/40 bg-alert/5 p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-alert" strokeWidth={2.2} />
          <p className="text-sm leading-relaxed">
            Velocity Trade does not operate through, nor does it authorize, any third-party website
            or online platform to provide regulated financial services on its behalf. Verify the
            address in your browser before you sign in, fund an account or send documents.
          </p>
        </div>

        <section
          aria-label="Official domain verification"
          className="mt-6 rounded-2xl border border-border bg-surface p-5"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-bull" strokeWidth={2.2} />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Official domain
            </h2>
          </div>
          <a
            href={notice.officialDomain}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-ops-blue underline-offset-4 hover:underline"
          >
            <Globe className="size-4" />
            {notice.officialDomainLabel}
          </a>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            If the address in your browser is not exactly this domain, you are not on a Velocity
            Trade property.
          </p>
        </section>

        <div className="mt-10 space-y-10">
          {notice.sections.map((section) => (
            <section key={section.id} id={section.id}>
              <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((p) => (
                  <p key={p} className="text-sm leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>

              {section.id === "regulatory" ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {notice.jurisdictions.map((j) => (
                    <li
                      key={j}
                      className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium"
                    >
                      {j}
                    </li>
                  ))}
                </ul>
              ) : null}

              {section.bullets ? (
                <ul className="mt-4 space-y-2">
                  {section.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-bull" strokeWidth={2.2} />
                      <span className="text-muted-foreground">{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Security report contact
            </h2>
          </div>
          <a
            href={`mailto:${notice.contactEmail}`}
            className="mt-3 inline-block text-base font-semibold text-primary underline-offset-4 hover:underline"
          >
            {notice.contactEmail}
          </a>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Use this address for impersonation, phishing and scam reports. For account questions,
            use the live chat in the terminal instead.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
