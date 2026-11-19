import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLockup } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/important-information")({
  head: () => ({
    meta: [
      { title: "Important Information | Velocity Trade" },
      {
        name: "description",
        content:
          "Important regulatory information, risk disclosures and AML/ATF & Sanctions commitments for Velocity Trade.",
      },
      { property: "og:title", content: "Important Information | Velocity Trade" },
      {
        property: "og:description",
        content:
          "Important regulatory information, risk disclosures and AML/ATF & Sanctions commitments for Velocity Trade.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportantInformationPage,
});

function ImportantInformationPage() {
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
          Legal
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          Important Information
        </h1>

        <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            This website is operated by and on behalf of Velocity Trade and its related companies.
            The information on this website is not an offer or solicitation for the purchase of
            securities, investments, unless expressly stated otherwise.
          </p>
          <p>
            All securities and financial products or instrument transactions involve risks. Past
            performance of any product described on this website is not a consistent indication of
            future performance. This website may contain forward-looking statements, forecasts,
            estimates and projections. No member of the Velocity Trade represents or warrants that
            such forward statements will be achieved or will prove to be correct. Actual future
            results and operations could vary materially from estimates and intended outcomes.
          </p>
          <p>
            The information, material and content provided in the pages of our Websites, including
            pricing information is believed to be reliable when posted. However, there is no
            guarantee that it is accurate, complete or current at all times. The information may
            unintentionally include technical inaccuracies or typographical errors. Velocity Trade
            is not the obligated to update the information and the website may be changed,
            withdrawn or terminated at any time without notice. Velocity Trade specifically does
            not accept any liability for any direct, indirect, incidental or consequential damages
            arising out of or in any way connected with the access to or use of this website.
            Under no circumstances will Velocity Trade be liable for any loss or damage whatsoever
            caused by a user’s reliance on information obtained from this website or smart phone
            application, including from use of models, tools and calculators.
          </p>
          <p>
            You agree to review the terms and conditions regularly. Your continued access or use of
            the Websites will mean that you agree to any changes.
          </p>
          <p>
            Any submission by you of an application, instruction or other request is subject to
            acceptance by Velocity Trade and can be declined by us.
          </p>
          <p>
            Before acting on any information or advice on this website, you should consider its
            appropriateness and in the context of your objectives, financial situation or needs. If
            a current offer document is available, please read the offer document and product
            information prior to acquiring products named on this website. Please make direct
            contact with Velocity Trade staff before acting on material on this website.
          </p>
          <p>
            Velocity Trade may have or may in the future act in various roles including as
            underwriter, dealer, broker or financial advisor to issuers and may, where permitted by
            law, receive fees, brokerage or commission for acting in those capacities. Further,
            Velocity Trade and associated personnel may at any time buy, sell or hold interests in
            financial instruments referred to in this website. We may act as a liquidity provider
            or buy or sell securities and other products as principal or agent.
          </p>

          <h2 className="pt-4 text-base font-semibold text-foreground">
            Anti-Money Laundering, Anti-Terrorist Financing &amp; Sanctions
          </h2>
          <p>
            Velocity is committed to identifying and deterring persons engaged in money laundering
            or terrorist financing from transaction with our firm. Velocity is committed to
            ensuring its products and services are not used to violate or circumvent economic
            sanctions. Velocity accomplishes this through the establishment of an Anti-Money
            Laundering and Anti-Terrorist Financing (“AML/ATF”) and Sanctions risk and compliance
            management program that is designed to detect and report suspected money laundering and
            terrorist financing activity prohibited by sanctions. Velocity is obligated to comply
            with the AML/ATF and Sanctions laws and regulations in each of the jurisdictions in
            which it operates.
          </p>
          <p>
            For more information please see{" "}
            <Link
              to="/legal/regulations"
              className="text-foreground underline underline-offset-2 transition-colors hover:text-brand-teal"
            >
              Regulatory Disclosures
            </Link>
            .
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
