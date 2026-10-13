import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CandlestickChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AssetIcon } from "@/lib/asset-icons";
import { displaySymbol, formatMoney, formatPrice } from "@/lib/instruments";
import type { getProfileOverview } from "@/lib/profile.functions";

type Overview = Awaited<ReturnType<typeof getProfileOverview>>;
const RISK_LABEL = { none: "None", low: "Low", moderate: "Moderate", high: "High", critical: "Critical" } as const;
const RISK_TONE = { none: "text-muted-foreground", low: "text-bull", moderate: "text-foreground", high: "text-bear", critical: "text-bear" };

export function TradingRiskOverview({ data, hidden, format, failed }: {
  data: Overview | undefined; hidden: boolean; format: (amount: number) => string; failed: boolean;
}) {
  const margin = data?.risk.margin;
  const exposure = data?.risk.exposure;
  const risk = exposure?.risk ?? "none";
  const money = (amount: number | undefined) => !data || amount == null ? "-" : hidden ? "••••" : format(amount);
  const utilization = !data ? "-" : margin ? margin.utilizationPct == null ? "N/A" : `${margin.utilizationPct.toFixed(1)}%` : "0.0%";
  return (
    <section aria-labelledby="risk-heading" className="mt-6 border-y border-border py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="risk-heading" className="text-sm font-semibold">Margin & exposure</h2>
        <span className="text-xs text-muted-foreground">{failed ? "Account metrics unavailable" : !data ? "Updating account metrics" : "Open margin and scalp trades"}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-5 lg:grid-cols-5">
        <Metric label="Committed margin" value={money(data ? margin?.usedUsdt ?? 0 : undefined)} />
        <Metric label="Available margin" value={money(margin?.availableUsdt ?? exposure?.equityUsdt)} />
        <Metric label="Margin utilization" value={hidden && data ? "••••" : utilization} />
        <Metric label="Notional exposure" value={money(exposure?.notionalUsdt)} />
        <div>
          <dt className="text-xs text-muted-foreground">Exposure risk</dt>
          <dd className={`mt-1.5 text-base font-semibold ${RISK_TONE[risk]}`}>{data ? RISK_LABEL[risk] : "-"}</dd>
          <p className="mt-1 text-xs text-muted-foreground">Max leverage <span className="num">{data ? hidden ? "••••" : `${exposure?.leverageMax ?? 0}x` : "-"}</span></p>
        </div>
      </dl>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="num mt-1.5 break-words text-base font-semibold">{value}</dd></div>;
}

export function ActiveTradingPositions({ hidden }: { hidden: boolean }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["home-active-trades"],
    queryFn: async () => {
      const [positions, contracts] = await Promise.all([
        supabase.from("positions").select("id,symbol,side,quantity,entry_price,leverage,currency,opened_at").eq("status", "open").order("opened_at", { ascending: false }),
        supabase.from("contracts").select("id,symbol,direction,stake,entry_price,leverage,currency,expires_at,opened_at").eq("status", "open").order("opened_at", { ascending: false }),
      ]);
      if (positions.error) throw positions.error;
      if (contracts.error) throw contracts.error;
      return [
        ...(positions.data ?? []).map(p => {
          const leverage = Math.max(Number(p.leverage) || 1, 1);
          const notional = Number(p.quantity) * Number(p.entry_price);
          return { id: p.id, symbol: p.symbol, side: p.side === "long" ? "Long" : "Short", type: "Margin", leverage, margin: notional / leverage, notional, currency: p.currency, entry: Number(p.entry_price), expiry: null as string | null, opened: p.opened_at };
        }),
        ...(contracts.data ?? []).map(c => ({ id: c.id, symbol: c.symbol, side: c.direction === "up" ? "Up" : "Down", type: "Scalp", leverage: Number(c.leverage) || 1, margin: Number(c.stake), notional: Number(c.stake) * (Number(c.leverage) || 1), currency: c.currency, entry: Number(c.entry_price), expiry: c.expires_at, opened: c.opened_at })),
      ].sort((a, b) => b.opened.localeCompare(a.opened));
    },
    refetchInterval: 10_000,
  });
  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: ["home-active-trades"] }); };
    const channel = supabase.channel("home-active-trades")
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts" }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);

  return (
    <section aria-labelledby="positions-heading" className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="positions-heading" className="text-sm font-semibold">Open positions {query.data && <span className="num ml-1 text-muted-foreground">({query.data.length})</span>}</h2>
        <Button asChild variant="ghost" size="sm" className="min-h-11 text-foreground"><Link to="/portfolio">Portfolio <ArrowUpRight /></Link></Button>
      </div>
      {query.isError ? <p role="alert" className="border-y border-border py-6 text-sm text-bear">Open positions could not be loaded.</p> : query.isPending ? <p className="border-y border-border py-6 text-sm text-muted-foreground">Loading open positions...</p> : query.data.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-7">
          <div className="flex items-center gap-3"><CandlestickChart className="size-5 text-muted-foreground" /><p className="text-sm text-muted-foreground">No open margin or scalp positions</p></div>
          <Button asChild variant="outline" className="min-h-11"><Link to="/trade" search={{ symbol: "BTCUSDT" }}>Open terminal <ArrowUpRight /></Link></Button>
        </div>
      ) : <div className="overflow-x-auto border-y border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground">{["Instrument", "Product / side", "Leverage", "Entry", "Committed margin", "Notional", "Expiry (UTC)"].map((label, i) => <th key={label} className={`px-3 py-3 font-medium ${i < 2 ? "text-left" : "text-right"}`}>{label}</th>)}</tr></thead>
          <tbody>{query.data.map(row => <tr key={row.id} className="border-b border-border/60 last:border-0">
            <td className="px-3 py-3"><Link to="/terminal/$symbol" params={{ symbol: row.symbol }} className="flex min-h-11 items-center gap-2 font-medium"><AssetIcon symbol={row.symbol} size={24} />{displaySymbol(row.symbol)}</Link></td>
            <td className="px-3 py-3"><span className="text-xs text-muted-foreground">{row.type}</span><span className={`ml-2 font-medium ${row.side === "Long" || row.side === "Up" ? "text-bull" : "text-bear"}`}>{row.side}</span></td>
            <td className="num px-3 py-3 text-right">{row.leverage}x</td>
            <td className="num px-3 py-3 text-right">{hidden ? "••••" : formatPrice(row.entry, row.symbol)}</td>
            <td className="num whitespace-nowrap px-3 py-3 text-right">{hidden ? "••••" : formatMoney(row.margin, row.currency)}</td>
            <td className="num whitespace-nowrap px-3 py-3 text-right">{hidden ? "••••" : formatMoney(row.notional, row.currency)}</td>
            <td className="num whitespace-nowrap px-3 py-3 text-right">{row.expiry ? new Date(row.expiry).toISOString().slice(11, 19) : "-"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  );
}