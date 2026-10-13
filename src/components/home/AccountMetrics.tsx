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

const RISK_LABEL = { none: "None", low: "Low", moderate: "Moderate", high: "High", critical: "Critical" } as const;
const RISK_TONE = { none: "text-muted-foreground", low: "text-bull", moderate: "text-primary", high: "text-bear", critical: "text-bear" };

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
  const exposure = data?.risk.exposure;
  const riskKey = (data?.risk.exposure.risk ?? "none") as keyof typeof RISK_LABEL;
  const dash = !data;
  const utilization = margin?.utilizationPct ?? 0;
  const masked = (v: number) => (hidden ? "••••" : format(v));

  return (
    <section className="mt-4 grid grid-cols-2 gap-3">
      <Card label="Margin Utilization">
        <p className="num text-lg font-bold">{dash ? "-" : `${utilization.toFixed(1)}%`}</p>
        <Bar pct={utilization} tone={utilization >= 60 ? "bear" : "primary"} />
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {margin
            ? `${masked(margin.usedUsdt)} committed · ${masked(margin.availableUsdt)} free`
            : "No margin committed"}
        </p>
        {margin && margin.scalpUsdt > 0 ? (
          <p className="truncate text-[11px] text-muted-foreground">
            incl. {masked(margin.scalpUsdt)} from scalp trades
          </p>
        ) : null}
      </Card>

      <Card label="Exposure Risk">
        <p className={`text-lg font-bold ${RISK_TONE[riskKey]}`}>{dash ? "-" : RISK_LABEL[riskKey]}</p>
        <p className="mt-2 truncate text-[11px] text-muted-foreground">
          {exposure && exposure.notionalUsdt > 0
            ? `${masked(exposure.notionalUsdt)} exposed${
                exposure.leverageMax > 0 ? ` · max ${exposure.leverageMax}x` : ""
              }`
            : "No open margin or scalp trades"}
        </p>
        {margin ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {margin.openPositions} open position{margin.openPositions === 1 ? "" : "s"}
          </p>
        ) : null}
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
