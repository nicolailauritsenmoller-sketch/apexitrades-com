import { Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, BadgeCheck } from "lucide-react";
import { BrandLockup } from "@/components/Logo";
import { openCookieSettings } from "@/lib/consent";
import { TrustCertificates } from "@/components/TrustBadges";

const NAV_GROUPS = [
  {
    title: "Platform",
    links: [
      { label: "Markets", to: "/markets" as const },
      { label: "Trading", to: "/terminal/$symbol" as const, params: { symbol: "BTCUSDT" } },
      { label: "Portfolio", to: "/dashboard" as const },
      { label: "Assets", to: "/wallet" as const },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/legal/$doc" as const, params: { doc: "about" } },
      { label: "Blog", to: "/blog" as const },
      { label: "Contact", to: "/legal/$doc" as const, params: { doc: "contact" } },
      { label: "Help / Support", to: "/legal/$doc" as const, params: { doc: "help" } },
      { label: "FAQ", to: "/legal/$doc" as const, params: { doc: "faq" } },
      { label: "Important Information", to: "/important-information" as const },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/legal/$doc" as const, params: { doc: "privacy" } },
      { label: "Cookie Policy", to: "/legal/$doc" as const, params: { doc: "cookies" } },
      { label: "Terms of Service", to: "/legal/$doc" as const, params: { doc: "terms" } },
      { label: "Risk Disclosure", to: "/legal/$doc" as const, params: { doc: "risk" } },
      { label: "Anti-Fraud Notice", to: "/legal/anti-fraud" as const },
      { label: "Regulated Internationally", to: "/legal/regulations" as const },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full max-w-full border-t border-border bg-surface/80 backdrop-blur-sm">
      <TrustCertificates />
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BrandLockup className="w-44" />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            An institutional-grade multi-asset trading terminal for crypto, equities, futures, FX
            and metals. Live market data with low-latency execution.
          </p>
        </div>

        {NAV_GROUPS.map((group) => (
          <nav key={group.title} className="min-w-0">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
              {group.title}
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {group.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    params={("params" in l ? l.params : undefined) as never}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              {group.title === "Legal" && (
                <li>
                  <button
                    onClick={openCookieSettings}
                    className="touch-manipulation text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Cookie Settings
                  </button>
                </li>
              )}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Important Information
          </h3>
          <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              This website is operated by and on behalf of Velocity Trade and its related
              companies. The information on this website is not an offer or solicitation for the
              purchase of securities, investments, unless expressly stated otherwise.
            </p>
            <p>
              All securities and financial products or instrument transactions involve risks. Past
              performance of any product described on this website is not a consistent indication
              of future performance. This website may contain forward-looking statements,
              forecasts, estimates and projections. No member of the Velocity Trade represents or
              warrants that such forward statements will be achieved or will prove to be correct.
              Actual future results and operations could vary materially from estimates and
              intended outcomes.
            </p>
            <p>
              The information, material and content provided in the pages of our Websites,
              including pricing information is believed to be reliable when posted. However, there
              is no guarantee that it is accurate, complete or current at all times. The
              information may unintentionally include technical inaccuracies or typographical
              errors. Velocity Trade is not the obligated to update the information and the
              website may be changed, withdrawn or terminated at any time without notice. Velocity
              Trade specifically does not accept any liability for any direct, indirect,
              incidental or consequential damages arising out of or in any way connected with the
              access to or use of this website. Under no circumstances will Velocity Trade be
              liable for any loss or damage whatsoever caused by a user’s reliance on information
              obtained from this website or smart phone application, including from use of models,
              tools and calculators.
            </p>
            <p>
              You agree to review the terms and conditions regularly. Your continued access or use
              of the Websites will mean that you agree to any changes.
            </p>
            <p>
              Any submission by you of an application, instruction or other request is subject to
              acceptance by Velocity Trade and can be declined by us.
            </p>
            <p>
              Before acting on any information or advice on this website, you should consider its
              appropriateness and in the context of your objectives, financial situation or needs.
              If a current offer document is available, please read the offer document and product
              information prior to acquiring products named on this website. Please make direct
              contact with Velocity Trade staff before acting on material on this website.
            </p>
            <p>
              Velocity Trade may have or may in the future act in various roles including as
              underwriter, dealer, broker or financial advisor to issuers and may, where permitted
              by law, receive fees, brokerage or commission for acting in those capacities.
              Further, Velocity Trade and associated personnel may at any time buy, sell or hold
              interests in financial instruments referred to in this website. We may act as a
              liquidity provider or buy or sell securities and other products as principal or
              agent.
            </p>
            <h4 className="pt-1 text-xs font-medium text-foreground/80">
              Anti-Money Laundering, Anti-Terrorist Financing &amp; Sanctions
            </h4>
            <p>
              Velocity is committed to identifying and deterring persons engaged in money
              laundering or terrorist financing from transaction with our firm. Velocity is
              committed to ensuring its products and services are not used to violate or
              circumvent economic sanctions. Velocity accomplishes this through the establishment
              of an Anti-Money Laundering and Anti-Terrorist Financing (“AML/ATF”) and Sanctions
              risk and compliance management program that is designed to detect and report
              suspected money laundering and terrorist financing activity prohibited by sanctions.
              Velocity is obligated to comply with the AML/ATF and Sanctions laws and regulations
              in each of the jurisdictions in which it operates.
            </p>
            <p>
              For more information please see{" "}
              <Link
                to="/legal/regulations"
                className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Regulatory Disclosures
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-muted/30 px-4 py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BadgeCheck className="size-3.5" />
            ISO 27001
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            SOC 2 Type II
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" />
            256-Bit SSL Encryption
          </span>
        </div>
      </div>

      <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
        © {year} Velocity Trade. All rights reserved.
      </div>
    </footer>
  );
}
