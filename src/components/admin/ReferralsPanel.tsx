import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  adminListReferrals,
  reviewReferral,
  saveReferralSettings,
} from "@/lib/referrals.functions";
import { APPROVE_BTN, DANGER_BTN } from "@/lib/admin-accents";

const STATUS_STYLE: Record<string, string> = {
  pending: "border-ops-amber/50 bg-ops-amber/15 text-ops-amber",
  approved: "border-ops-blue/50 bg-ops-blue/15 text-ops-blue",
  rewarded: "border-ops-emerald/50 bg-ops-emerald/15 text-ops-emerald",
  rejected: "border-ops-red/50 bg-ops-red/15 text-ops-red",
};

export function ReferralsPanel() {
  const queryClient = useQueryClient();
  const list = useServerFn(adminListReferrals);
  const review = useServerFn(reviewReferral);
  const saveSettings = useServerFn(saveReferralSettings);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const data = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: () => list(),
    refetchInterval: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-referrals"] });

  const act = useMutation({
    mutationFn: (input: { id: string; action: "grant" | "reject"; note?: string }) =>
      review({ data: input }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "grant" ? "Referral reward credited" : "Referral rejected");
      setRejecting(null);
      setNote("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });

  const settings = useMutation({
    mutationFn: (input: { autoApprove: boolean; rewardAmount: number }) =>
      saveSettings({ data: input }),
    onSuccess: () => {
      toast.success("Referral settings saved");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save settings"),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data.data?.rows ?? []).filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return [r.referrerName, r.referrerEmail, r.refereeName, r.refereeEmail, r.code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [data.data, search, status]);

  const cfg = data.data?.settings;
  const totals = useMemo(() => {
    const all = data.data?.rows ?? [];
    return {
      total: all.length,
      pending: all.filter((r) => r.status === "pending" || r.status === "approved").length,
      rewarded: all.filter((r) => r.status === "rewarded").length,
      paid: all
        .filter((r) => r.status === "rewarded")
        .reduce((s, r) => s + r.rewardAmount, 0),
    };
  }, [data.data]);

  return (
    <div className="space-y-4 [touch-action:manipulation]">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total referrals", value: String(totals.total) },
          { label: "Awaiting reward", value: String(totals.pending) },
          { label: "Rewarded", value: String(totals.rewarded) },
          { label: "USDT paid out", value: totals.paid.toFixed(2) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Gift className="size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Reward approval mode</p>
          <p className="text-xs text-muted-foreground">
            Automatic credits the referrer as soon as the invited trader passes identity
            verification. Manual queues every referral for an agent to grant.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Reward</span>
          <input
            type="number"
            min={1}
            defaultValue={cfg?.rewardAmount ?? 10}
            key={cfg?.rewardAmount}
            onBlur={(e) =>
              cfg &&
              Number(e.target.value) > 0 &&
              Number(e.target.value) !== cfg.rewardAmount &&
              settings.mutate({ autoApprove: cfg.autoApprove, rewardAmount: Number(e.target.value) })
            }
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <span className="text-muted-foreground">USDT</span>
        </label>
        <button
          disabled={!cfg || settings.isPending}
          onClick={() =>
            cfg && settings.mutate({ autoApprove: !cfg.autoApprove, rewardAmount: cfg.rewardAmount })
          }
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            cfg?.autoApprove ? APPROVE_BTN : "bg-secondary text-foreground"
          }`}
        >
          {cfg?.autoApprove ? "Automatic" : "Manual approval"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search referrer, invited user or code"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        {["all", "pending", "approved", "rewarded", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1.5 text-xs capitalize ${
              status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-3">Referrer</th>
              <th className="px-4 py-3">Invited user</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Date joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No referrals match this view.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.referrerName}</p>
                    <p className="text-xs text-muted-foreground">{r.referrerEmail ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.refereeName}</p>
                    <p className="text-xs text-muted-foreground">{r.refereeEmail ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.code ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                        STATUS_STYLE[r.status] ?? "border-border text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.note ? (
                      <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                        {r.note}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {rejecting === r.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          autoFocus
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Reviewer note"
                          className="w-40 rounded-md border border-border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => act.mutate({ id: r.id, action: "reject", note })}
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${DANGER_BTN}`}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setRejecting(null)}
                          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={r.status === "rewarded" || act.isPending}
                          onClick={() => act.mutate({ id: r.id, action: "grant" })}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ${APPROVE_BTN}`}
                        >
                          Grant {r.rewardAmount || 10} USDT
                        </button>
                        <button
                          disabled={r.status === "rewarded"}
                          onClick={() => {
                            setRejecting(r.id);
                            setNote("");
                          }}
                          className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
