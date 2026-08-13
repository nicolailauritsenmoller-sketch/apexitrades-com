import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, X } from "lucide-react";
import { toast } from "sonner";
import { adjustUserBalance, getUserWallets } from "@/lib/admin.functions";

type Kind = "credit" | "debit" | "bonus";

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "credit", label: "Credit", hint: "Add funds to the wallet" },
  { id: "debit", label: "Debit", hint: "Remove funds from the wallet" },
  { id: "bonus", label: "Bonus", hint: "Promotional credit" },
];

const FALLBACK = ["USDT", "BTC", "ETH", "USD", "EUR", "GBP"];

/** Manual credit / debit / bonus tool with a mandatory audited reason note. */
export function BalanceAdjustDialog({
  userId,
  userName,
  onClose,
}: {
  userId: string;
  userName?: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fetchWallets = useServerFn(getUserWallets);
  const adjust = useServerFn(adjustUserBalance);

  const wallets = useQuery({
    queryKey: ["admin-user-wallets", userId],
    queryFn: () => fetchWallets({ data: { userId } }),
  });

  const currencies = ((wallets.data as any[]) ?? []).map((w) => w.currency);
  const options = currencies.length ? currencies : FALLBACK;

  const [currency, setCurrency] = useState("");
  const [kind, setKind] = useState<Kind>("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const active = currency || options[0] || "USDT";
  const current = ((wallets.data as any[]) ?? []).find((w) => w.currency === active);

  const mutation = useMutation({
    mutationFn: (vars: {
      currency: string;
      amount: number;
      kind: Kind;
      reason: string;
    }) =>
      adjust({
        data: {
          userId,
          currency: vars.currency,
          amount: vars.kind === "debit" ? -Math.abs(vars.amount) : Math.abs(vars.amount),
          mode: "delta" as const,
          kind: vars.kind,
          reason: vars.reason,
        },
      }),
    onSuccess: (res: any) => {
      toast.success(`Balance updated — new ${active} balance ${res?.balance ?? ""}`);
      setAmount("");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin-user-wallets", userId] });
      void qc.invalidateQueries({ queryKey: ["admin-user-workspace", userId] });
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return toast.error("Enter a valid amount.");
    if (reason.trim().length < 4) return toast.error("A reason note is required.");
    mutation.mutate({ currency: active, amount: value, kind, reason: reason.trim() });
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md touch-manipulation rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <header className="mb-3 flex items-center gap-2">
          <Coins className="size-4 text-primary" />
          <div className="min-w-0">
            <p className="font-display text-sm font-bold tracking-tight">Credit / debit balance</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {userName ?? userId.slice(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <label className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
          Asset
        </label>
        <select
          value={active}
          onChange={(e) => setCurrency(e.target.value)}
          className="mb-3 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="mb-3 grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              title={k.hint}
              onClick={() => setKind(k.id)}
              className={`rounded-md border px-2 py-2 text-xs font-semibold transition-colors ${
                kind === k.id
                  ? k.id === "debit"
                    ? "border-bear/50 bg-bear/15 text-bear"
                    : "border-primary/50 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
          Amount
        </label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="num mb-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
        <p className="mb-3 text-[11px] text-muted-foreground">
          Current balance: <span className="num">{Number(current?.balance ?? 0)}</span> {active}
        </p>

        <label className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
          Reason (required — recorded in the audit log)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Manual settlement of failed deposit #1234"
          className="mb-3 w-full rounded-md border border-border bg-background p-2 text-sm"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            disabled={mutation.isPending}
            onClick={submit}
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {mutation.isPending ? "Applying…" : "Apply adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}
