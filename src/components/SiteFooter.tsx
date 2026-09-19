import { Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, BadgeCheck } from "lucide-react";
import { BrandMark } from "@/components/Logo";
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
      { label: "Contact", to: "/legal/$doc" as const, params: { doc: "contact" } },
      { label: "Help / Support", to: "/legal/$doc" as const, params: { doc: "help" } },
      { label: "FAQ", to: "/legal/$doc" as const, params: { doc: "faq" } },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/legal/$doc" as const, params: { doc: "privacy" } },
      { label: "Cookie Policy", to: "/legal/$doc" as const, params: { doc: "cookies" } },
      { label: "Terms of Service", to: "/legal/$doc" as const, params: { doc: "terms" } },
      { label: "Risk Disclosure", to: "/legal/$doc" as const, params: { doc: "risk" } },
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
            <BrandMark className="size-8" />
            <span className="font-display text-sm font-bold tracking-tight">VELOCITY TRADE</span>
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
