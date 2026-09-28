import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, KeyRound, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { getChatUserContext, resetUserTwoFactor } from "@/lib/support-desk.functions";
import { setUserAccountControls } from "@/lib/admin-ops.functions";

export const MACROS = [
  {
    id: "kyc",
    label: "KYC submission instructions",
    body: "To complete identity verification, open Profile > Verification, upload a valid government-issued ID (front and back) and a clear selfie. Reviews are typically completed within 24 hours.",
  },
  {
    id: "deposit",
    label: "Deposit verification steps",
    body: "Please share the transaction hash (TXID), the network used and the exact amount. Once the network confirmations complete, our finance desk will credit your wallet.",
  },
  {
    id: "withdraw",
    label: "Withdrawal processing",
    body: "Withdrawals are reviewed by our finance desk before release. Ensure your withdrawal password is set and the destination address matches the selected network.",
  },
  {
    id: "2fa",
    label: "2FA reset procedure",
    body: "For security, a 2FA reset requires identity confirmation. Please confirm your UID and the email on file; once verified, we will reset your authenticator so you can enrol a new device.",
  },
  {
    id: "margin",
    label: "Margin & liquidation",
    body: "Account Health reflects your margin utilisation. Reducing leverage or adding collateral lowers liquidation risk. Positions may be liquidated when health falls to critical levels.",
  },
  {
    id: "close",
    label: "Closing message",
    body: "Is there anything else I can assist you with today? If not, I will close this session. Thank you for contacting Velocity Support.",
  },
] as const;

/** Live elapsed-wait badge; tone escalates at 2 and 5 minutes. */
export function SlaTimer({ since }: { since: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return null;
  const secs = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const label = h > 0 ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, "0")}`;
  const tone =
    secs >= 300 ? "bg-bear/15 text-bear" : secs >= 120 ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}>
      <Clock className="size-3" /> {label}
    </span>
  );
}

/** Short two-tone ping for new unassigned chats. */
export function playQueuePing() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.start(t);
      osc.stop(t + 0.18);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* audio blocked until user interaction */
  }
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate text-right font-medium">{v}</span>
    </div>
  );
}

export function ChatUserSidebar({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getChatUserContext);
  const reset2fa = useServerFn(resetUserTwoFactor);
  const controls = useServerFn(setUserAccountControls);
  const [showLogs, setShowLogs] = useState(false);
  const ctx = useQuery({
    queryKey: ["chat-user-context", userId],
    queryFn: () => fetchCtx({ data: { userId } }),
    refetchInterval: 20_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["chat-user-context", userId] });
  const resetM = useMutation({
    mutationFn: () => reset2fa({ data: { userId } }),
    onSuccess: () => {
      toast.success("Two-factor authentication reset");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const wdM = useMutation({
    mutationFn: (disabled: boolean) => controls({ data: { userId, withdrawalsDisabled: disabled } }),
    onSuccess: (_d, disabled) => {
      toast.success(disabled ? "Withdrawals disabled" : "Withdrawals re-enabled");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = ctx.data;
  const healthTone = !d ? "" : d.healthPct >= 70 ? "text-bull" : d.healthPct >= 40 ? "text-warning" : "text-bear";
  const expTone =
    d?.exposure === "High" || d?.exposure === "Elevated" ? "text-bear" : d?.exposure === "Moderate" ? "text-warning" : "text-bull";

  return (
    <aside className="hidden overflow-y-auto border-l border-border p-3 xl:block">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">User profile</p>
      {ctx.isLoading || !d ? (
        <Loader2 className="mt-4 size-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="mt-2 divide-y divide-border rounded-md border border-border px-2.5">
            <Row k="UID" v={d.uid ?? "-"} />
            <Row k="Full name" v={d.fullName ?? "-"} />
            <Row k="Email" v={<span title={d.email ?? ""}>{d.email ?? "-"}</span>} />
            <Row k="Verification" v={d.kycTier} />
            <Row k="2FA" v={d.twoFactor ? "Enabled" : "Not enabled"} />
          </div>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Risk</p>
          <div className="mt-2 divide-y divide-border rounded-md border border-border px-2.5">
            <Row k="Account Health" v={<span className={healthTone}>{d.healthPct}%</span>} />
            <Row k="Trader Trust Score" v={`${d.trustPct}%`} />
            <Row k="Active exposure" v={<span className={expTone}>{d.exposure}</span>} />
            <Row k="Withdrawals" v={d.withdrawalsDisabled ? <span className="text-bear">Disabled</span> : "Enabled"} />
            {d.tradingFrozen && <Row k="Trading" v={<span className="text-bear">Frozen</span>} />}
          </div>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</p>
          <div className="mt-2 grid gap-1.5">
            <button
              type="button"
              disabled={resetM.isPending || !d.twoFactor}
              onClick={() => window.confirm("Reset this user's 2FA? They will need to enrol a new authenticator.") && resetM.mutate()}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
            >
              <KeyRound className="size-3.5" /> {d.twoFactor ? "Reset 2FA Request" : "2FA not enabled"}
            </button>
            <button
              type="button"
              disabled={wdM.isPending}
              onClick={() =>
                window.confirm(d.withdrawalsDisabled ? "Re-enable withdrawals?" : "Disable withdrawals for this user?") &&
                wdM.mutate(!d.withdrawalsDisabled)
              }
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
            >
              {d.withdrawalsDisabled ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5 text-bear" />}
              {d.withdrawalsDisabled ? "Enable Withdrawals" : "Disable Withdrawals"}
            </button>
            <button
              type="button"
              onClick={() => setShowLogs((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
            >
              <ShieldCheck className="size-3.5" /> {showLogs ? "Hide Security Logs" : "View Security Logs"}
            </button>
          </div>
          {showLogs && (
            <ul className="mt-2 space-y-1.5">
              {d.securityLogs.length === 0 && <li className="text-xs text-muted-foreground">No security events.</li>}
              {d.securityLogs.map((l) => (
                <li key={l.id} className="rounded-md bg-secondary/50 px-2 py-1.5 text-[11px]">
                  <p className="font-medium">{l.event}</p>
                  {l.detail && <p className="text-muted-foreground">{l.detail}</p>}
                  <p className="text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                    {l.ip_address ? ` · ${l.ip_address}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
