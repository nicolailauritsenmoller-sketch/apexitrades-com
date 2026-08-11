import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Globe2, ShieldCheck, LineChart, Headphones, KeyRound, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import coinbaseLogo from "@/assets/logos/coinbase.png";
import binanceLogo from "@/assets/logos/binance.svg";
import metamaskLogo from "@/assets/logos/metamask.svg";
import cryptocomLogo from "@/assets/logos/cryptocom.svg";
import robinhoodLogo from "@/assets/logos/robinhood.svg";
import krakenLogo from "@/assets/logos/kraken.svg";
import shakepayLogo from "@/assets/logos/shakepay.svg";
import bitbuyLogo from "@/assets/logos/bitbuy.png";
import revolutLogo from "@/assets/logos/revolut.svg";

/* ---------------- Case in point: crypto trading services ---------------- */

type Brand = { name: string; logo: string };

const BRANDS: Brand[] = [
  { name: "Coinbase", logo: coinbaseLogo },
  { name: "Binance", logo: binanceLogo },
  { name: "MetaMask", logo: metamaskLogo },
  { name: "Crypto.com", logo: cryptocomLogo },
  { name: "Robinhood", logo: robinhoodLogo },
  { name: "Kraken", logo: krakenLogo },
  { name: "Shakepay", logo: shakepayLogo },
  { name: "Bitbuy", logo: bitbuyLogo },
  { name: "Revolut", logo: revolutLogo },
];

function BrandLogo({ brand }: { brand: Brand }) {
  return (
    <div className="flex min-w-0 touch-manipulation flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface px-4 py-8 text-center">
      <div className="grid h-16 w-full place-items-center rounded-xl bg-white p-2">
        <img
          src={brand.logo}
          alt={`${brand.name} logo`}
          loading="lazy"
          className="max-h-12 w-auto object-contain"
        />
      </div>
      <p className="w-full truncate text-sm font-semibold">{brand.name}</p>
    </div>
  );
}



export function CaseInPointSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Case in Point</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Examples of well-known crypto trading and wallet services available in the markets we
        cover. Listed for illustration only.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {BRANDS.map((b) => (
          <BrandLogo key={b.name} brand={b} />
        ))}
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        Third-party names and logos are displayed for informational purposes. No endorsement,
        sponsorship, or affiliation is implied unless expressly stated.
      </p>
    </section>
  );
}

/* ---------------- Global membership ---------------- */

type Membership = {
  totalMembers: number | null;
  countries: number | null;
  activeMembers: number | null;
  supportedMarkets: number | null;
  visible?: Partial<Record<"totalMembers" | "countries" | "activeMembers" | "supportedMarkets", boolean>>;
  verified?: boolean;
};

export function useMembershipStats() {
  return useQuery({
    queryKey: ["membership-stats"],
    queryFn: async (): Promise<Membership> => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "membership")
        .maybeSingle();
      return (data?.value ?? {}) as Membership;
    },
    staleTime: 5 * 60_000,
  });
}

const BENEFITS = [
  { icon: KeyRound, title: "Account access", body: "One login for wallets, positions and identity verification across every device." },
  { icon: LineChart, title: "Trading tools", body: "Professional candlestick charting, timed scalp contracts and leverage up to 20x." },
  { icon: Wallet, title: "Market access", body: "Crypto, US equities, index and commodity futures, major forex pairs and metals." },
  { icon: ShieldCheck, title: "Security features", body: "Session and device monitoring, verified withdrawals and encrypted document storage." },
  { icon: Headphones, title: "Customer support", body: "In-app live chat with agents who can see your account context immediately." },
  { icon: Globe2, title: "Global community", body: "A trading community spanning multiple regions and currencies." },
];

export function GlobalMembershipSection() {
  const { data } = useMembershipStats();
  const vis = data?.visible ?? {};
  const stats = (
    [
      { key: "totalMembers", label: "Total members", value: data?.totalMembers },
      { key: "countries", label: "Countries represented", value: data?.countries },
      { key: "activeMembers", label: "Active members", value: data?.activeMembers },
      { key: "supportedMarkets", label: "Supported markets", value: data?.supportedMarkets },
    ] as const
  ).filter(
    (s) => vis[s.key] !== false && typeof s.value === "number" && s.value !== null,
  );


  return (
    <section className="w-full max-w-full border-y border-border bg-surface/70 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <Globe2 className="size-3.5" /> Global Membership
          </span>
          <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            Join a worldwide trading community
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Membership unlocks the full terminal: multi-currency wallets, five asset classes,
            verified withdrawals and round-the-clock support.
          </p>
        </div>

        {stats.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-background p-4">
                <p className="num text-2xl font-bold">{(s.value as number).toLocaleString("en-US")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-background p-5">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link
            to="/auth"
            className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Join now — create account
          </Link>
        </div>
      </div>
    </section>
  );
}
