import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  CircleDollarSign,
  Eye,
  LifeBuoy,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { OPS_ACCENTS, type OpsAccent } from "@/lib/admin-accents";

export type Analytics = {
  metrics: Record<string, number>;
  series: {
    date: string;
    signups: number;
    deposits: number;
    withdrawals: number;
    revenue: number;
    visitors: number;
  }[];
  contracts: any[];
  tradeStats: { settled: number; wins: number; losses: number; volume: number };
  ledger: any[];
  walletTotals: Record<string, number>;
  sessions: any[];
  chats: any[];
  kycExpiring: any[];
  referrals: number;
  referralRewards: number;
};

export type DeskFilter = {
  status?: string;
  users?: "today" | "week" | "month" | "referred";
};

const money = (n: number) =>
  `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="relative touch-manipulation overflow-hidden rounded-2xl border border-border/70 bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">{title}</h2>
        {action}
      </header>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  accent = "neutral",
  onClick,
  alert = false,
  hint,
  badge,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: OpsAccent;
  onClick?: () => void;
  alert?: boolean;
  hint?: string;
  badge?: string;
}) {
  const key: OpsAccent = alert && accent === "neutral" ? "red" : accent;
  const a = OPS_ACCENTS[key];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { onClick, type: "button" as const, title: hint ?? label } : { title: hint })}
      className={`group relative w-full touch-manipulation overflow-hidden rounded-2xl border bg-gradient-to-b from-card/80 to-card/40 p-3 text-left backdrop-blur transition-all duration-200 sm:p-4 ${a.edge} ${
        alert ? "shadow-[0_0_18px_-6px_currentColor]" : ""
      } ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-lg transition-colors ${a.chip} ${
            alert ? "animate-pulse" : ""
          }`}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="truncate">{label}</span>
        {badge && (
          <span
            className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${a.badge}`}
          >
            {badge}
          </span>
        )}
      </div>
      <p className={`num mt-1.5 text-lg font-semibold sm:text-xl ${a.text}`}>{value}</p>
      {onClick && (
        <span className="mt-1 block text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Open →
        </span>
      )}
    </Tag>
  );
}



export function MetricsBar({
  a,
  onOpen,
}: {
  a: Analytics;
  onOpen?: (tab: string, filter?: DeskFilter) => void;
}) {
  const m = a.metrics;
  const go = (tab: string, filter?: DeskFilter) => (onOpen ? () => onOpen(tab, filter) : undefined);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Total users"
          accent="blue"
          value={String(m.totalUsers)}
          icon={Users}
          hint="All registered accounts"
          onClick={go("users")}
        />
        <Stat
          label="New today"
          accent="blue"
          value={String(m.newUsersToday)}
          icon={UserPlus}
          hint="Registrations in the last 24 hours"
          onClick={go("users", { users: "today" })}
        />
        <Stat
          label="Weekly sign-ups"
          accent="blue"
          value={String(m.signupsWeek)}
          icon={UserPlus}
          hint="Registrations in the last 7 days"
          onClick={go("users", { users: "week" })}
        />
        <Stat
          label="Monthly sign-ups"
          accent="blue"
          value={String(m.signupsMonth)}
          icon={UserPlus}
          hint="Registrations in the last 30 days"
          onClick={go("users", { users: "month" })}
        />
        <Stat
          label="Referred users"
          accent="violet"
          value={String(a.referrals)}
          icon={BadgeCheck}
          hint="Accounts that joined via a referral code"
          onClick={go("users", { users: "referred" })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Total deposits"
          value={money(m.totalDeposits)}
          icon={ArrowDownToLine}
          accent="emerald"
          badge="Approved"
          hint="Approved deposit volume"
          onClick={go("deposits", { status: "approved" })}
        />
        <Stat
          label="Pending deposits"
          value={String(m.pendingDeposits)}
          icon={ArrowDownToLine}
          accent="amber"
          badge="Pending"
          hint="Deposit approvals awaiting review"
          alert={Number(m.pendingDeposits) > 0}
          onClick={go("deposits", { status: "pending" })}
        />
        <Stat
          label="Pending withdrawals"
          value={String(m.pendingWithdrawals)}
          icon={ArrowUpFromLine}
          accent="amber"
          badge="Pending"
          hint="Withdrawal requests awaiting review"
          alert={Number(m.pendingWithdrawals) > 0}
          onClick={go("withdrawals", { status: "pending" })}
        />
        <Stat
          label="Revenue"
          value={money(m.revenue)}
          icon={CircleDollarSign}
          accent={m.revenue >= 0 ? "emerald" : "red"}
          badge={m.revenue >= 0 ? "Profit" : "Loss"}
          hint="Net platform revenue"
          onClick={go("transactions")}
        />
        <Stat
          label="Active trades"
          accent="blue"
          value={String(m.activeTrades)}
          icon={TrendingUp}
          hint="Contracts currently open"
          onClick={go("trades")}
        />
        <Stat
          label="Pending KYC"
          value={String(m.pendingKyc)}
          icon={ShieldAlert}
          accent="amber"
          badge="Review"
          hint="Identity documents awaiting approval"
          alert={Number(m.pendingKyc) > 0}
          onClick={go("users", { status: "pending" })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Open tickets"
          accent="red"
          badge="Open"
          value={String(m.openTickets)}
          icon={LifeBuoy}
          hint="Support tickets with status open"
          alert={Number(m.openTickets) > 0}
          onClick={go("tickets")}
        />
        <Stat
          label="Total withdrawals"
          accent="emerald"
          value={money(m.totalWithdrawals)}
          icon={ArrowUpFromLine}
          badge="Approved"
          hint="Approved withdrawal volume"
          onClick={go("withdrawals", { status: "approved" })}
        />
        <Stat
          label="Referral rewards"
          accent="violet"
          value={money(a.referralRewards)}
          icon={BadgeCheck}
          hint="Rewards paid to referrers"
          onClick={go("users", { users: "referred" })}
        />
        <Stat
          label="Active devices"
          accent="blue"
          value={String(a.sessions.length)}
          icon={Eye}
          hint="Devices seen in recent sessions"
          onClick={go("active")}
        />
      </div>

    </div>
  );
}

const CHART_TABS = [
  { id: "visitors", label: "Visitors" },
  { id: "growth", label: "User growth" },
  { id: "flows", label: "Deposits vs withdrawals" },
  { id: "revenue", label: "Revenue" },
] as const;

function Bars({
  data,
  keys,
  colors,
}: {
  data: Analytics["series"];
  keys: string[];
  colors: string[];
}) {
  const max = Math.max(
    1,
    ...data.flatMap((d) => keys.map((k) => Math.abs(Number((d as any)[k]) || 0))),
  );
  return (
    <div className="flex h-48 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-40 w-full items-end justify-center gap-0.5">
            {keys.map((k, i) => (
              <div
                key={k}
                title={`${k}: ${(d as any)[k]}`}
                className={`w-full rounded-t ${colors[i]}`}
                style={{
                  height: `${(Math.abs(Number((d as any)[k]) || 0) / max) * 100}%`,
                  minHeight: 2,
                }}
              />
            ))}
          </div>
          <span className="text-[9px] text-muted-foreground">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsCharts({ a }: { a: Analytics }) {
  const [tab, setTab] = useState<(typeof CHART_TABS)[number]["id"]>("visitors");
  const config = useMemo(() => {
    switch (tab) {
      case "growth":
        return { keys: ["signups"], colors: ["bg-primary"] };
      case "flows":
        return { keys: ["deposits", "withdrawals"], colors: ["bg-bull", "bg-bear"] };
      case "revenue":
        return { keys: ["revenue"], colors: ["bg-primary"] };
      default:
        return { keys: ["visitors"], colors: ["bg-accent-foreground/70"] };
    }
  }, [tab]);

  return (
    <Panel title="Live analytics (14 days)">
      <div className="mb-3 flex gap-1 overflow-x-auto">
        {CHART_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 touch-manipulation rounded-lg px-3 py-1.5 text-xs transition-colors ${
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Bars data={a.series} keys={config.keys} colors={config.colors} />
    </Panel>
  );
}

export function SystemActivity({ a }: { a: Analytics }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Login & device activity">
        <ul className="max-h-72 space-y-2 overflow-y-auto text-xs">
          {a.sessions.length === 0 && <p className="text-muted-foreground">No recent sessions.</p>}
          {a.sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 border-b border-border pb-2">
              <span className="min-w-0 truncate">
                {s.browser} · {s.os} · {s.country ?? "Unknown"} · {s.ip_address ?? "—"}
              </span>
              <span className="num shrink-0 text-muted-foreground">
                {new Date(s.last_active_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Timeline">
        <ul className="max-h-72 space-y-2 overflow-y-auto text-xs">
          {a.ledger.slice(0, 30).map((l) => (
            <li key={`${l.kind}-${l.id}`} className="flex items-center justify-between gap-3 border-b border-border pb-2">
              <span className="flex min-w-0 items-center gap-2">
                <Activity className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate capitalize">
                  {l.kind} · {l.coin} · {l.amount}
                </span>
              </span>
              <span className="num shrink-0 text-muted-foreground">
                {new Date(l.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export function TradeStatsPanel({ a }: { a: Analytics }) {
  const s = a.tradeStats;
  const winRate = s.settled ? (s.wins / s.settled) * 100 : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Settled trades" value={String(s.settled)} icon={TrendingUp} accent="blue" />
        <Stat label="Wins" value={String(s.wins)} icon={TrendingUp} accent="emerald" />
        <Stat label="Losses" value={String(s.losses)} icon={TrendingUp} accent="red" />
        <Stat label="Win rate" value={`${winRate.toFixed(1)}%`} icon={Activity} accent="violet" />
      </div>
      <Panel title="Recent trades">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Symbol</th>
                <th>Direction</th>
                <th>Stake</th>
                <th>Status</th>
                <th>Result</th>
                <th>Payout</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {a.contracts.slice(0, 40).map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="py-2">{c.display_symbol}</td>
                  <td className="capitalize">{c.direction}</td>
                  <td className="num">
                    {c.stake} {c.currency}
                  </td>
                  <td className="capitalize">{c.status}</td>
                  <td
                    className={
                      c.result === "win" ? "text-bull" : c.result === "loss" ? "text-bear" : ""
                    }
                  >
                    {c.result ?? "—"}
                  </td>
                  <td className="num">{c.payout ?? "—"}</td>
                  <td className="num text-muted-foreground">
                    {new Date(c.opened_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function TransactionsPanel({ a }: { a: Analytics }) {
  return (
    <div className="space-y-3">
      <Panel title="Corporate wallet balances">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(a.walletTotals).map(([cur, bal]) => (
            <div key={cur} className="rounded-lg border border-border p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{cur}</p>
              <p className="num text-sm font-semibold">
                {bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Ledger">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Type</th>
                <th>Asset</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {a.ledger.map((l) => (
                <tr key={`${l.kind}-${l.id}`} className="border-t border-border">
                  <td className="py-2 capitalize">{l.kind}</td>
                  <td>{l.coin}</td>
                  <td className="num">{l.amount}</td>
                  <td className="capitalize">{l.status}</td>
                  <td className="num text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function SupportHub({ a }: { a: Analytics }) {
  return (
    <Panel title="Support inbox">
      <ul className="space-y-2 text-xs">
        {a.chats.length === 0 && <p className="text-muted-foreground">No conversations yet.</p>}
        {a.chats.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <span className="min-w-0 truncate">{c.subject ?? "Support conversation"}</span>
            <span className="flex shrink-0 items-center gap-3">
              <span className={c.status === "open" ? "text-warning" : "text-muted-foreground"}>
                {c.status}
              </span>
              <span className="num text-muted-foreground">
                {new Date(c.last_message_at).toLocaleString()}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function KycExpiry({ a }: { a: Analytics }) {
  if (a.kycExpiring.length === 0) return null;
  return (
    <Panel title="KYC expiry alerts">
      <ul className="space-y-2 text-xs">
        {a.kycExpiring.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-3">
            <span className="truncate">{k.full_name}</span>
            <span className="num text-warning">
              expires {new Date(k.document_expires_at).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
