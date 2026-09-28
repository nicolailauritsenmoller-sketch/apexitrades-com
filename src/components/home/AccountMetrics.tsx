import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getProfileOverview } from "@/lib/profile.functions";

type Overview = Awaited<ReturnType<typeof getProfileOverview>>;

/** Server-computed account metrics, recalculated whenever trades, balances or security state change. */
export function useAccountOverview() {
  const fetchOverview = useServerFn(getProfileOverview);
  const qc = useQueryClient();
  const query = useQuery<Overview>({
    queryKey: ["profile-overview"],
    queryFn: () => fetchOverview() as Promise<Overview>,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => qc.invalidateQueries({ queryKey: ["profile-overview"] }), 400);
    };
    const channel = supabase.channel("dashboard-metrics");
    for (const table of ["positions", "contracts", "wallets", "deposits", "profiles", "kyc_submissions"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

const RISK_LABEL = { none: "None", low: "Low", moderate: "Medium", high: "High" } as const;
const RISK_TONE = { none: "text-muted-foreground", low: "text-bull", moderate: "text-primary", high: "text-bear" };

export function AccountMetrics({
  data,
  hidden,
  format,
}: {
  data: Overview | undefined;
  hidden: boolean;
  format: (usdt: number) => string;
}) {
  const margin = data?.risk.margin;
  const volume = data?.volume;
  const riskKey = (data?.risk.exposure.risk ?? "none") as keyof typeof RISK_LABEL;
  const trust = data?.trust.scorePct ?? 0;
  const target = volume?.nextTier?.thresholdUsdt ?? volume?.tier.thresholdUsdt ?? 0;
  const dash = !data;

  return (
    <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card label="Margin Utilization">
        <p className="num text-lg font-bold">
          {dash ? "-" : margin?.utilizationPct != null ? `${margin.utilizationPct.toFixed(1)}%` : "0.0%"}
        </p>
        <Bar pct={margin?.utilizationPct ?? 0} tone={(margin?.utilizationPct ?? 0) >= 60 ? "bear" : "primary"} />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {margin ? `${hidden ? "••••" : format(margin.usedUsdt)} in use` : "No leveraged exposure"}
        </p>
      </Card>

      <Card label="Monthly Trading Volume">
        <p className="num truncate text-sm font-bold">
          {dash ? "-" : hidden ? "•••• / ••••" : `${format(volume!.monthUsdt)} / ${format(target)}`}
        </p>
        <Bar pct={volume?.progressPct ?? 0} tone="primary" />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {volume ? `${volume.tier.label}${volume.nextTier ? ` · next: ${volume.nextTier.label}` : " · top tier"}` : ""}
        </p>
      </Card>

      <Card label="Trader Trust Score">
        <p className="num text-lg font-bold">{dash ? "-" : `${Math.round(trust)}%`}</p>
        <Bar pct={trust} tone="bull" />
        <p className="mt-1 text-[11px] text-muted-foreground">Updates with verified milestones</p>
      </Card>

      <Card label="Exposure Risk">
        <p className={`text-lg font-bold ${RISK_TONE[riskKey]}`}>{dash ? "-" : RISK_LABEL[riskKey]}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {data && data.risk.exposure.leverageMax > 0
            ? `Max leverage ${data.risk.exposure.leverageMax}x`
            : "No open leveraged positions"}
        </p>
      </Card>
    </section>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel touch-manipulation p-3.5">
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Bar({ pct, tone }: { pct: number; tone: "primary" | "bull" | "bear" }) {
  const bg = tone === "bull" ? "bg-bull" : tone === "bear" ? "bg-bear" : "bg-primary";
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${bg} transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
