import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gauge, KeyRound, ScrollText, WalletMinimal } from "lucide-react";
import {
  forceTwoFactorReauth,
  getComplianceProfile,
  setDailyWithdrawalLimit,
} from "@/lib/compliance.functions";
import { setUserAccountControls } from "@/lib/admin-ops.functions";

const TONE: Record<string, string> = {
  Low: "border-ops-emerald/40 bg-ops-emerald/10 text-ops-emerald",
  Medium: "border-ops-amber/40 bg-ops-amber/10 text-ops-amber",
  High: "border-ops-red/40 bg-ops-red/10 text-ops-red",
};

const clean = (s: string) => s.replace(/[\u2013\u2014]/g, "-");

function describe(action: string, details: any): string {
  const d = details ?? {};
  if (action.startsWith("kyc.")) {
    const parts = [d.tier ?? action.split(".")[1], action.endsWith("approve") ? "approved" : action.endsWith("reject") ? "rejected" : action];
    if (d.code) parts.push(`code ${d.code}`);
    return parts.join(" - ");
  }
  if (action === "compliance.withdrawal_limit") return `Daily limit ${d.from ?? "none"} - ${d.to ?? "none"} USDT`;
  if (action === "compliance.force_2fa_reauth") return "Forced 2FA re-authentication";
  if (action === "user.controls") return `Controls: ${Object.entries(d).map(([k, v]) => `${k}=${v}`).join(", ")}`;
  return action;
}

/** Risk category, account overrides and the immutable compliance audit trail. */
export function CompliancePanel({ userId }: { userId: string }) {
  const fetchProfile = useServerFn(getComplianceProfile);
  const reauth = useServerFn(forceTwoFactorReauth);
  const setLimit = useServerFn(setDailyWithdrawalLimit);
  const setControls = useServerFn(setUserAccountControls);
  const [limitInput, setLimitInput] = useState("");

  const q = useQuery({
    queryKey: ["admin-compliance", userId],
    queryFn: () => fetchProfile({ data: { userId } }),
  });
  const p = q.data;

  const freeze = useMutation({
    mutationFn: (v: boolean) => setControls({ data: { userId, withdrawalsDisabled: v } }),
    onSuccess: () => {
      toast.success("Withdrawal status updated.");
      void q.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const twoFa = useMutation({
    mutationFn: () => reauth({ data: { userId } }),
    onSuccess: () => {
      toast.success("User must re-enter their 2FA code.");
      void q.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const limit = useMutation({
    mutationFn: (v: number | null) => setLimit({ data: { userId, limit: v } }),
    onSuccess: () => {
      toast.success("Daily withdrawal limit updated.");
      setLimitInput("");
      void q.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-xs text-muted-foreground">Evaluating risk...</p>;
  if (q.isError || !p) return <p className="text-xs text-ops-red">{(q.error as Error)?.message ?? "Failed."}</p>;

  const btn = "flex touch-manipulation items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-wider ${TONE[p.category]}`}>
          {p.category} Risk
        </span>
        <span className="text-[11px] text-muted-foreground">
          Tier {p.tier === 0 ? "unverified" : `Lv.${p.tier}`} · 2FA {p.twoFactorEnabled ? "on" : "off"} · {p.country ?? "no country"} · {p.velocity24h} tx / 24h
        </span>
      </div>
      {p.factors.length > 0 ? (
        <ul className="space-y-0.5 text-[11px] text-muted-foreground">
          {p.factors.map((f) => (
            <li key={f.label}>- {f.label}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">No risk factors detected.</p>
      )}

      <div className="grid gap-2">
        <button
          disabled={freeze.isPending}
          onClick={() => freeze.mutate(!p.withdrawalsDisabled)}
          className={`${btn} ${p.withdrawalsDisabled ? "border-ops-red/50 bg-ops-red/10 text-ops-red" : "border-border"}`}
        >
          <WalletMinimal className="size-3.5" />
          {p.withdrawalsDisabled ? "Unfreeze Account Withdrawals" : "Freeze Account Withdrawals"}
        </button>
        <button disabled={twoFa.isPending || !p.twoFactorEnabled} onClick={() => twoFa.mutate()} className={`${btn} border-border`}>
          <KeyRound className="size-3.5" /> Force 2FA Re-authentication
        </button>
        <div className="rounded-lg border border-border p-2">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Gauge className="size-3" /> Adjust Daily Withdrawal Limit
          </p>
          <p className="mb-1.5 text-[11px]">
            Current: {p.dailyLimitUsdt === null ? "platform default (no custom limit)" : `${p.dailyLimitUsdt.toLocaleString()} USDT / 24h`}
          </p>
          <div className="flex gap-1.5">
            <input
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              inputMode="decimal"
              placeholder="USDT per 24h"
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
            />
            <button
              disabled={limit.isPending}
              onClick={() => {
                const v = Number(limitInput);
                if (!limitInput || !Number.isFinite(v) || v < 0) return toast.error("Enter a valid amount.");
                limit.mutate(v);
              }}
              className="rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Set
            </button>
            {p.dailyLimitUsdt !== null && (
              <button disabled={limit.isPending} onClick={() => limit.mutate(null)} className="rounded-md border border-border px-2 text-xs">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 p-2">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <ScrollText className="size-3" /> Compliance audit log (immutable)
        </p>
        {p.audit.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No compliance actions recorded.</p>
        ) : (
          <ol className="max-h-60 space-y-1.5 overflow-y-auto">
            {p.audit.map((a: any) => (
              <li key={a.id} className="border-l-2 border-border pl-2 text-[11px]">
                <p className="font-medium">{clean(describe(a.action, a.details))}</p>
                {a.details?.note && <p className="text-muted-foreground">{clean(String(a.details.note))}</p>}
                <p className="font-mono text-[10px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()} - {a.actor_name ?? "Admin"} ({String(a.actor_id).slice(0, 8)})
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
