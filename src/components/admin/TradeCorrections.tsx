import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Wrench } from "lucide-react";
import { correctContract, correctPosition, getDeskTrades } from "@/lib/desk.functions";

type Row = Record<string, any>;

function num(v: string): number | undefined {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md bg-secondary px-2 py-1.5 text-sm outline-none"
      />
    </label>
  );
}

/** Remote edit / force-settle console for live contracts and positions. */
export function TradeCorrections() {
  const qc = useQueryClient();
  const [view, setView] = useState<"contracts" | "positions">("contracts");
  const fetchTrades = useServerFn(getDeskTrades);
  const fixContract = useServerFn(correctContract);
  const fixPosition = useServerFn(correctPosition);

  const q = useQuery({
    queryKey: ["desk-trades"],
    queryFn: () => fetchTrades(),
    refetchInterval: 15_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["desk-trades"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const contractMutation = useMutation({
    mutationFn: (v: any) => fixContract({ data: v }),
    onSuccess: () => {
      toast.success("Contract updated and synced to the trader.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const positionMutation = useMutation({
    mutationFn: (v: any) => fixPosition({ data: v }),
    onSuccess: () => {
      toast.success("Position updated and synced to the trader.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows: Row[] = (view === "contracts" ? q.data?.contracts : q.data?.positions) ?? [];

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight">
          <Wrench className="size-4 text-primary" />
          Trade starts &amp; corrections
        </h2>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["contracts", "positions"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
                view === v ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="divide-y divide-border">
        {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading trades…</p>}
        {!q.isLoading && rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No trades found.</p>
        )}
        {rows.map((r) =>
          view === "contracts" ? (
            <ContractRow
              key={r["id"]}
              row={r}
              pending={contractMutation.isPending}
              onSubmit={(v) => contractMutation.mutateAsync({ id: r["id"], ...v })}
            />
          ) : (
            <PositionRow
              key={r["id"]}
              row={r}
              pending={positionMutation.isPending}
              onSubmit={(v) => positionMutation.mutateAsync({ id: r["id"], ...v })}
            />
          ),
        )}
      </div>
    </section>
  );
}

function RowHead({ row, right }: { row: Row; right: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-sm font-semibold">
          {row["display_symbol"]}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {row["direction"] ?? row["side"]}
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          {row["userName"]} · UID {row["userUid"]} · opened{" "}
          {new Date(row["opened_at"]).toLocaleString()}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">{right}</span>
    </div>
  );
}

function ContractRow({
  row,
  pending,
  onSubmit,
}: {
  row: Row;
  pending: boolean;
  onSubmit: (v: Record<string, unknown>) => Promise<unknown>;
}) {
  const [entry, setEntry] = useState("");
  const [confirmation, setConfirmation] = useState<boolean | null>(null);
  const [exit, setExit] = useState("");
  const [payout, setPayout] = useState("");
  const [result, setResult] = useState<"" | "win" | "loss" | "draw">("");

  const patch = (settle: boolean) => ({
    entryPrice: num(entry),
    exitPrice: num(exit),
    payout: num(payout),
    result: result || undefined,
    settle,
  });

  return (
    <div className="space-y-3 p-4">
      <AdminActionConfirm open={confirmation !== null} title={confirmation ? "Execute Settlement" : "Save Changes"} description={`Apply corrections to ${row["display_symbol"]}. Settlement and outcome overrides may change the customer wallet.`} pending={pending} destructive={confirmation === true} onClose={() => setConfirmation(null)} onConfirm={async (reason) => { if (confirmation !== null) await onSubmit({ ...patch(confirmation), reason }); }} />
      <RowHead
        row={row}
        right={`${row["status"]}${row["result"] ? ` · ${row["result"]}` : ""} · stake ${Number(row["stake"]).toFixed(2)} ${row["currency"]}`}
      />
      <div className="grid gap-2 sm:grid-cols-4">
        <Field
          label="Entry price"
          value={entry}
          onChange={setEntry}
          placeholder={String(row["entry_price"])}
        />
        <Field
          label="Exit price"
          value={exit}
          onChange={setExit}
          placeholder={row["exit_price"] ? String(row["exit_price"]) : "-"}
        />
        <Field
          label="Payout override"
          value={payout}
          onChange={setPayout}
          placeholder={row["payout"] ? String(row["payout"]) : "auto"}
        />
        <label className="space-y-1 text-[11px]">
          <span className="text-muted-foreground">Outcome</span>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value as any)}
            className="w-full rounded-md bg-secondary px-2 py-1.5 text-sm outline-none"
          >
            <option value="">Keep</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="draw">Draw</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
        <Button
          disabled={pending}
          onClick={() => setConfirmation(false)}
          className="min-h-9"
        >
          {pending && <Loader2 className="size-3 animate-spin" />}
          Save adjustments
        </Button>
        <Button
          disabled={pending}
          onClick={() => setConfirmation(true)}
          variant="destructive"
        >
          Force settle now
        </Button>
      </div>
    </div>
  );
}

function PositionRow({
  row,
  pending,
  onSubmit,
}: {
  row: Row;
  pending: boolean;
  onSubmit: (v: Record<string, unknown>) => Promise<unknown>;
}) {
  const [entry, setEntry] = useState("");
  const [confirmation, setConfirmation] = useState<boolean | null>(null);
  const [exit, setExit] = useState("");
  const [pnl, setPnl] = useState("");

  const patch = (close: boolean) => ({
    entryPrice: num(entry),
    exitPrice: num(exit),
    realizedPnl: num(pnl),
    close,
  });

  return (
    <div className="space-y-3 p-4">
      <AdminActionConfirm open={confirmation !== null} title={confirmation ? "Execute Settlement" : "Save Changes"} description={`Apply corrections to ${row["display_symbol"]}. Settlement and outcome overrides may change the customer wallet.`} pending={pending} destructive={confirmation === true} onClose={() => setConfirmation(null)} onConfirm={async (reason) => { if (confirmation !== null) await onSubmit({ ...patch(confirmation), reason }); }} />
      <RowHead
        row={row}
        right={`${row["status"]} · qty ${row["quantity"]} · ${row["leverage"]}x ${row["currency"]}`}
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <Field
          label="Entry price"
          value={entry}
          onChange={setEntry}
          placeholder={String(row["entry_price"])}
        />
        <Field
          label="Exit price"
          value={exit}
          onChange={setExit}
          placeholder={row["exit_price"] ? String(row["exit_price"]) : "-"}
        />
        <Field
          label="Realised P/L override"
          value={pnl}
          onChange={setPnl}
          placeholder={row["realized_pnl"] ? String(row["realized_pnl"]) : "auto"}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
        <Button
          disabled={pending}
          onClick={() => setConfirmation(false)}
          className="min-h-9"
        >
          {pending && <Loader2 className="size-3 animate-spin" />}
          Save adjustments
        </Button>
        <Button
          disabled={pending}
          onClick={() => setConfirmation(true)}
          variant="destructive"
        >
          Force close now
        </Button>
      </div>
    </div>
  );
}
