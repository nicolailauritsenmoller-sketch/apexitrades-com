import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listDepositMinimums, saveDepositMinimum } from "@/lib/deposit-minimums.functions";

/** Global defaults (userId null) or one account's overrides. */
export function DepositMinimumsPanel({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const list = useServerFn(listDepositMinimums);
  const save = useServerFn(saveDepositMinimum);
  const key = ["admin-deposit-minimums", userId ?? "global"];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { userId } }) });
  const [coin, setCoin] = useState("USDT");
  const [amount, setAmount] = useState("");
  const m = useMutation({
    mutationFn: (v: { coin: string; minAmount: number | null }) =>
      save({ data: { userId, coin: v.coin, minAmount: v.minAmount } }),
    onSuccess: () => {
      toast.success("Deposit minimum updated");
      setAmount("");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        {userId
          ? "Overrides for this account replace the global default for the same asset."
          : "Global minimum per asset. Applies to every account without an override."}
      </p>
      <div className="divide-y divide-border rounded-md border border-border">
        {(q.data ?? []).map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 p-2.5">
            <div>
              <span className="font-semibold">{r.coin}</span>{" "}
              <span className="num">{Number(r.min_amount)}</span>
              {r.note && <p className="text-[11px] text-muted-foreground">{r.note}</p>}
            </div>
            <Button size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate({ coin: r.coin, minAmount: null })}>
              Remove
            </Button>
          </div>
        ))}
        {q.data?.length === 0 && <p className="p-2.5 text-xs text-muted-foreground">No rules set.</p>}
      </div>
      <div className="grid gap-2 sm:grid-cols-[90px_1fr_auto]">
        <input value={coin} onChange={(e) => setCoin(e.target.value.toUpperCase())} placeholder="Coin" className="rounded-md bg-secondary px-2 py-2 text-sm outline-none" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Minimum amount" className="rounded-md bg-secondary px-2 py-2 text-sm outline-none" />
        <Button
          size="sm"
          disabled={m.isPending || !coin || !(Number(amount) >= 0) || amount === ""}
          onClick={() => m.mutate({ coin, minAmount: Number(amount) })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
