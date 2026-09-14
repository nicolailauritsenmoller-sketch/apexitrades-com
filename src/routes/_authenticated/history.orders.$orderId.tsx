import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { TradeSnapshotChart } from "@/components/TradeSnapshotChart";
import { AssetIcon } from "@/lib/asset-icons";
import { getContracts } from "@/lib/contracts.functions";
import { formatMoney, formatPrice } from "@/lib/instruments";
import { buildContractSummary, buildPositionSummary, type TradeSummary } from "@/lib/trade-summary";
import { getPortfolio } from "@/lib/trading.functions";

export const Route = createFileRoute("/_authenticated/history/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order Details — Velocity Trade" },
      { name: "description", content: "Review settlement, execution, fees, and technical details for a completed order." },
      { property: "og:title", content: "Order Details — Velocity Trade" },
      { property: "og:description", content: "Detailed trading order settlement and execution record." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderDetailsPage,
});

function orderCode(id: string) {
  return `ORD-${id.slice(0, 8).toUpperCase()}`;
}

function toCsv(summary: TradeSummary) {
  const rows = ["Section,Metric,Value"];
  for (const section of summary.sections) {
    for (const [metric, value] of section.rows) {
      rows.push(`"${section.title}","${metric}","${value.replaceAll('"', '""')}"`);
    }
  }
  return rows.join("\n");
}

function downloadCsv(summary: TradeSummary) {
  const url = URL.createObjectURL(new Blob([toCsv(summary)], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${summary.orderId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function OrderDetailsPage() {
  const { orderId } = Route.useParams();
  const fetchPortfolio = useServerFn(getPortfolio);
  const fetchContracts = useServerFn(getContracts);
  const data = useQuery({
    queryKey: ["order-details", orderId],
    queryFn: async () => {
      const [portfolio, contracts] = await Promise.all([fetchPortfolio(), fetchContracts()]);
      return { portfolio, contracts };
    },
  });

  const summary = useMemo(() => {
    const position = data.data?.portfolio.positions.find((item) => orderCode(item.id) === orderId && item.status === "closed" && item.exitPrice != null);
    if (position && position.exitPrice != null) {
      return buildPositionSummary({
        id: position.id,
        symbol: position.symbol,
        displaySymbol: position.displaySymbol,
        side: position.side,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        exitPrice: position.exitPrice,
        leverage: position.leverage,
        currency: position.currency,
        pnl: position.realizedPnl ?? 0,
        openedAt: position.openedAt,
        closedAt: position.closedAt ?? position.openedAt,
      });
    }
    const contract = data.data?.contracts.find((item) => orderCode(item.id) === orderId && item.status === "settled" && item.exitPrice != null);
    if (!contract || contract.exitPrice == null) return null;
    return buildContractSummary({
      id: contract.id,
      symbol: contract.symbol,
      displaySymbol: contract.displaySymbol,
      direction: contract.direction,
      stake: contract.stake,
      currency: contract.currency,
      entryPrice: contract.entryPrice,
      exitPrice: contract.exitPrice,
      payout: contract.payout ?? 0,
      result: contract.result ?? "draw",
      openedAt: contract.openedAt,
      closedAt: contract.settledAt ?? contract.expiresAt,
    });
  }, [data.data, orderId]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <Link to="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to history
        </Link>

        {data.isLoading ? (
          <div className="panel flex min-h-64 items-center justify-center"><div className="size-7 animate-spin rounded-full border-2 border-border border-t-primary" /></div>
        ) : !summary ? (
          <div className="panel px-6 py-16 text-center">
            <h1 className="text-xl font-semibold">Order not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This order is unavailable or does not belong to your account.</p>
          </div>
        ) : (
          <>
            <section className="panel overflow-hidden p-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5">
                <div className="flex items-center gap-3">
                  <AssetIcon symbol={summary.symbol} size={42} />
                  <div>
                    <h1 className="text-xl font-semibold">{summary.pair} order details</h1>
                    <p className="num text-xs text-muted-foreground">{summary.orderId} · {summary.status}</p>
                  </div>
                </div>
                <div className="flex gap-2 print:hidden">
                  <Button variant="outline" onClick={() => window.print()}><Printer /> PDF Receipt</Button>
                  <Button variant="outline" onClick={() => downloadCsv(summary)}><Download /> CSV</Button>
                </div>
              </div>
              <div className="grid gap-5 p-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Net Realized PnL</p>
                  <p className={`num mt-1 text-3xl font-bold ${summary.netPnl >= 0 ? "text-bull" : "text-bear"}`}>
                    {summary.netPnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(summary.netPnl), summary.currency)}
                  </p>
                  <p className="num mt-2 text-sm text-muted-foreground">
                    ROI {summary.profitPct >= 0 ? "+" : ""}{summary.profitPct.toFixed(2)}% · {formatPrice(summary.entryPrice, summary.symbol)} → {formatPrice(summary.exitPrice, summary.symbol)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface px-2"><TradeSnapshotChart summary={summary} /></div>
              </div>
            </section>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {summary.sections.map((section) => (
                <section key={section.title} className="panel p-4">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</h2>
                  <dl className="divide-y divide-border">
                    {section.rows.map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="num text-right font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>

            <section className="panel mt-4 p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order timeline</h2>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {summary.timeline.map((event, index) => (
                  <li key={`${event.at}-${index}`} className="relative">
                    <span className="absolute -left-[23px] top-1.5 size-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium">{event.label}</p>
                    <p className="num text-xs text-muted-foreground">{event.at}{event.detail ? ` · ${event.detail}` : ""}</p>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}