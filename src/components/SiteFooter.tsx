import { Link } from "@tanstack/react-router";
import { LineChart } from "lucide-react";
import { openCookieSettings } from "@/lib/consent";

const NAV_GROUPS = [
  {
    title: "Platform",
    links: [
      { label: "Markets", to: "/markets" as const },
      { label: "Trading", to: "/terminal/$symbol" as const, params: { symbol: "BTCUSDT" } },
      { label: "Portfolio", to: "/dashboard" as const },
      { label: "Wallet", to: "/wallet" as const },
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
    <footer className="w-full max-w-full border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <LineChart className="size-4" strokeWidth={2.6} />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">VELOCITY</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            A multi-currency trading terminal for crypto, stocks, futures, forex and gold. Live
            market data with simulated execution.
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

      <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
        © {year} Velocity Terminal. All rights reserved.
      </div>
    </footer>
  );
}
