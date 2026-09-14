import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Bell, Eraser, MessagesSquare, Receipt, RotateCcw, TrendingUp } from "lucide-react";
import {
  resetUserActivity,
  type MaintenanceScope,
} from "@/lib/admin-maintenance.functions";

type Action = {
  key: string;
  label: string;
  icon: any;
  scopes: MaintenanceScope[];
  description: string;
  master?: boolean;
};

const ACTIONS: Action[] = [
  {
    key: "chat",
    label: "Clear chat, ticket & request history",
    icon: MessagesSquare,
    scopes: ["chat"],
    description:
      "Removes live chat sessions and messages, VIP desk messages, support tickets, submitted requests and rating feedback for this account.",
  },
  {
    key: "trades",
    label: "Clear trade history",
    icon: TrendingUp,
    scopes: ["trades"],
    description:
      "Removes settled contracts, scalp positions and all open/closed order records for this account.",
  },
  {
    key: "transactions",
    label: "Clear transaction history",
    icon: Receipt,
    scopes: ["transactions"],
    description: "Removes deposit, withdrawal and swap receipts from the user's ledger view.",
  },
  {
    key: "notifications",
    label: "Clear notification history",
    icon: Bell,
    scopes: ["notifications"],
    description:
      "Removes every in-app notification for this account and resets the unread badge counter to zero.",
  },
  {
    key: "all",
    label: "Reset account to fresh state",
    icon: RotateCcw,
    scopes: ["chat", "trades", "transactions", "notifications"],
    description:
      "Clears chat, trades, transactions and the full notification history at once so the account interface looks brand new. Balances are preserved.",
    master: true,
  },
];

/** Destructive activity-wipe tools for a single account. Balances are never affected. */
export function AccountMaintenancePanel({
  userId,
  userName,
  onDone,
}: {
  userId: string;
  userName?: string | null;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const reset = useServerFn(resetUserActivity);
  const [pending, setPending] = useState<Action | null>(null);
  const [typed, setTyped] = useState("");

  const run = useMutation({
    mutationFn: (action: Action) =>
      reset({ data: { userId, scopes: action.scopes, confirm: "RESET" as const } }),
    onSuccess: () => {
      toast.success("Account activity cleared. Balances untouched.");
      setPending(null);
      setTyped("");
      for (const key of [
        "admin-user-workspace",
        "admin-user-directory",
        "admin-users",
        "admin-overview",
        "support-threads",
        "support-tickets",
        "desk-trades",
        "chat-ratings",
        "notifications",
        "my-notifications",
      ]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-950/10 p-3">
      <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ops-red">
        <AlertTriangle className="size-3" /> Account maintenance &amp; reset
      </p>
      <p className="mb-2.5 text-[11px] text-muted-foreground">
        Permanently clears activity records for this account. Asset balances (USDT, ETH, BTC, fiat)
        are never modified.
      </p>

      <div className="grid gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => {
              setTyped("");
              setPending(a);
            }}
            className={`flex touch-manipulation items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
              a.master
                ? "border-ops-red/60 bg-ops-red/15 text-ops-red hover:bg-ops-red/25"
                : "border-red-500/30 text-foreground hover:bg-red-500/10"
            }`}
          >
            <a.icon className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{a.label}</span>
            <Eraser className="size-3.5 shrink-0 opacity-60" />
          </button>
        ))}
      </div>

      {pending && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-background p-4 shadow-2xl">
            <p className="flex items-center gap-1.5 font-display text-sm font-bold tracking-tight text-ops-red">
              <AlertTriangle className="size-4" /> Confirm destructive action
            </p>
            <p className="mt-2 text-xs font-semibold">{pending.label}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{pending.description}</p>
            <p className="mt-2 rounded-lg border border-border/70 bg-muted/30 p-2 text-[11px] text-muted-foreground">
              Target: <span className="font-semibold text-foreground">{userName ?? userId}</span>
              <br />
              Balances are retained. This cannot be undone.
            </p>

            <label className="mt-3 block text-[10px] uppercase tracking-widest text-muted-foreground">
              Type RESET to continue
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="RESET"
              className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-ring"
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setTyped("");
                }}
                className="touch-manipulation rounded-lg border border-border px-3 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={typed.trim() !== "RESET" || run.isPending}
                onClick={() => run.mutate(pending)}
                className="touch-manipulation rounded-lg bg-ops-red px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {run.isPending ? "Clearing…" : "Confirm wipe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
