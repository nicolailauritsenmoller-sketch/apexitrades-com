import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, PieChart } from "lucide-react";
import { getAccountingReport } from "@/lib/admin-ops.functions";
import { downloadCsv } from "@/lib/csv";

const money = (v: number) =>
  `$${Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const RANGES = [7, 30, 90, 365];

/** Net deposits, fee income, system P&L and one-click compliance exports. */
export function AccountingPanel() {
  const fetchReport = useServerFn(getAccountingReport);
  const [days, setDays] = useState(30);

  const q = useQuery({
    queryKey: ["admin-accounting", days],
    queryFn: () => fetchReport({ data: { days } }),
  });

  const t = (q.data?.totals ?? {}) as any;
  const ledger = (q.data?.ledger ?? []) as any[];

  const cards = [
    { label: "Total deposits", value: money(t.totalDeposits), tone: "text-ops-emerald" },
    { label: "Total withdrawals", value: money(t.totalWithdrawals), tone: "text-ops-red" },
    {
      label: "Net deposits",
      value: money(t.netDeposits),
      tone: t.netDeposits >= 0 ? "text-ops-emerald" : "text-ops-red",
    },
    { label: "Fees collected", value: money(t.tradingFees), tone: "text-primary" },
    { label: "Contract stakes", value: money(t.contractStakes), tone: "" },
    { label: "Contract payouts", value: money(t.contractPayouts), tone: "" },
    {
      label: "Trader realised P&L",
      value: money(t.traderRealized),
      tone: t.traderRealized >= 0 ? "text-ops-emerald" : "text-ops-red",
    },
    {
      label: "System P&L",
      value: money(t.systemPnl),
      tone: t.systemPnl >= 0 ? "text-ops-emerald" : "text-ops-red",
    },
  ];

  function exportPdf() {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const rows = ledger
      .slice(0, 200)
      .map(
        (r) =>
          `<tr><td>${new Date(r.date).toLocaleString()}</td><td>${r.type}</td><td>${r.asset ?? ""}</td><td style="text-align:right">${Number(r.amount).toFixed(2)}</td><td>${r.status ?? ""}</td></tr>`,
      )
      .join("");
    win.document.write(`<!doctype html><html><head><title>Accounting report</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}
      h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:11px;margin-top:16px}
      td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}
      ul{font-size:12px;padding-left:18px}</style></head><body>
      <h1>Platform accounting &amp; revenue report</h1>
      <p>Window: last ${days} days · generated ${new Date().toLocaleString()}</p>
      <ul>${cards.map((c) => `<li><b>${c.label}:</b> ${c.value}</li>`).join("")}</ul>
      <table><thead><tr><th>Date</th><th>Type</th><th>Asset</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/70 bg-card/50 p-4">
        <header className="flex flex-wrap items-center gap-2">
          <PieChart className="size-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">Accounting & platform revenue</h3>
          <div className="ml-auto flex flex-wrap gap-1">
            {RANGES.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`touch-manipulation rounded-full px-3 py-1.5 text-xs font-semibold ${
                  days === d
                    ? "bg-primary/15 text-primary"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </header>

        {q.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Compiling ledger…</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-border/70 bg-surface/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {c.label}
                </p>
                <p className={`num mt-1 text-base font-semibold ${c.tone}`}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() =>
              downloadCsv(`accounting-ledger-${days}d`, ledger as any) ||
              undefined
            }
            className="inline-flex min-h-10 touch-manipulation items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Download className="size-4" /> Export ledger CSV
          </button>
          <button
            onClick={() =>
              downloadCsv(`accounting-summary-${days}d`, [
                { window_days: days, generated_at: new Date().toISOString(), ...t },
              ])
            }
            className="inline-flex min-h-10 touch-manipulation items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            <Download className="size-4" /> Tax summary CSV
          </button>
          <button
            onClick={exportPdf}
            className="inline-flex min-h-10 touch-manipulation items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            <FileText className="size-4" /> Audit report PDF
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/50">
        <header className="border-b border-border/70 px-4 py-3">
          <h3 className="font-display text-sm font-semibold">Consolidated ledger</h3>
        </header>
        {ledger.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No financial activity in this window.
          </p>
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Asset</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ledger.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(r.date).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs capitalize">{String(r.type).replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-xs">{r.asset}</td>
                    <td
                      className={`num px-3 py-2 text-right ${r.amount >= 0 ? "text-ops-emerald" : "text-ops-red"}`}
                    >
                      {Number(r.amount).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
