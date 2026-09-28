import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  BellRing,
  Check,
  Clock3,
  FlaskConical,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Moon,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { SubPageHeader } from "@/components/profile/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { usePreference } from "@/lib/preferences";
import { logActivity } from "@/lib/telemetry";

export const Route = createFileRoute("/_authenticated/profile/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Matrix & Alerts | Velocity Trade" },
      {
        name: "description",
        content: "Configure security, wallet, trading, market and platform notification channels for your Velocity Trade account.",
      },
      { property: "og:title", content: "Notification Matrix - Velocity Trade" },
      {
        property: "og:description",
        content: "Institutional notification controls for account, trading and market events.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationSettings,
});

type Channel = "inApp" | "email" | "push" | "sms";
type Trigger = {
  id: string;
  label: string;
  detail: string;
  priority: "Critical" | "Immediate" | "Standard" | "Optional";
  forced?: Channel[];
  defaults: Record<Channel, boolean>;
};

const CHANNELS: { id: Channel; label: string; icon: typeof Bell }[] = [
  { id: "inApp", label: "In-App", icon: Bell },
  { id: "email", label: "Email", icon: Mail },
  { id: "push", label: "Push", icon: Smartphone },
  { id: "sms", label: "SMS", icon: MessageSquareText },
];

const GROUPS: { title: string; tone: string; rows: Trigger[] }[] = [
  {
    title: "Security & Auth",
    tone: "text-bear",
    rows: [
      trigger("unrecognized-login", "Unrecognized logins", "New device or unusual sign-in activity.", "Critical", ["email", "sms"], [1, 1, 1, 1]),
      trigger("two-factor-change", "2FA modifications", "Authenticator or recovery phrase changes.", "Critical", ["email", "sms"], [1, 1, 1, 1]),
      trigger("password-change", "Password changes", "Login or withdrawal credential updates.", "Critical", ["email", "sms"], [1, 1, 1, 1]),
    ],
  },
  {
    title: "Wallet Transactions",
    tone: "text-bull",
    rows: [
      trigger("deposit-confirmed", "Incoming deposit confirmations", "Credit confirmation and available balance notice.", "Standard", [], [1, 1, 1, 0]),
      trigger("withdrawal-status", "Pending withdrawal status", "Compliance review and approval progress.", "Immediate", [], [1, 1, 1, 1]),
      trigger("network-confirmations", "Network confirmations", "On-chain confirmation progress and completion.", "Standard", [], [1, 0, 1, 0]),
    ],
  },
  {
    title: "Trading & Execution",
    tone: "text-primary",
    rows: [
      trigger("order-fill", "Order fill execution receipts", "Filled price, size, fees and execution reference.", "Standard", [], [1, 1, 1, 0]),
      trigger("margin-call", "Margin call warnings", "Margin utilization has entered a warning range.", "Immediate", [], [1, 1, 1, 1]),
      trigger("liquidation-risk", "Liquidation risks", "Position is approaching its liquidation threshold.", "Critical", [], [1, 1, 1, 1]),
      trigger("contract-settlement", "Contract settlements", "Final outcome and realized settlement receipt.", "Standard", [], [1, 1, 1, 0]),
    ],
  },
  {
    title: "Market & Price Alerts",
    tone: "text-bull",
    rows: [
      trigger("price-triggers", "Custom asset price triggers", "Alerts when a configured market level is reached.", "Optional", [], [1, 0, 1, 0]),
      trigger("portfolio-digest", "24-hour portfolio digest", "Daily account performance and allocation summary.", "Optional", [], [1, 1, 0, 0]),
    ],
  },
  {
    title: "Product & Platform Updates",
    tone: "text-muted-foreground",
    rows: [
      trigger("product-announcements", "Product announcements", "New trading tools and account capabilities.", "Optional", [], [1, 1, 0, 0]),
      trigger("maintenance", "Maintenance schedules", "Planned service windows and availability changes.", "Standard", [], [1, 1, 1, 0]),
      trigger("promotions", "Promotional offers", "Eligible campaigns and account incentives.", "Optional", [], [0, 1, 0, 0]),
    ],
  },
];

const ALL_ROWS = GROUPS.flatMap((group) => group.rows);
const DEFAULT_MATRIX = Object.fromEntries(
  ALL_ROWS.flatMap((row) => CHANNELS.map((channel) => [`${row.id}.${channel.id}`, row.defaults[channel.id]])),
);

function trigger(
  id: string,
  label: string,
  detail: string,
  priority: Trigger["priority"],
  forced: Channel[],
  enabled: [number, number, number, number],
): Trigger {
  return {
    id,
    label,
    detail,
    priority,
    forced,
    defaults: { inApp: Boolean(enabled[0]), email: Boolean(enabled[1]), push: Boolean(enabled[2]), sms: Boolean(enabled[3]) },
  };
}

function NotificationSettings() {
  const [storedMatrix, setStoredMatrix] = usePreference("notificationMatrix", DEFAULT_MATRIX);
  const [quietHours, setQuietHours] = usePreference("quietHoursEnabled", false);
  const [quietStart, setQuietStart] = usePreference("quietHoursStart", "22:00");
  const [quietEnd, setQuietEnd] = usePreference("quietHoursEnd", "06:00");
  const [digest, setDigest] = usePreference("notificationDigest", false);
  const [testingPush, setTestingPush] = useState(false);
  const matrix = useMemo(() => ({ ...DEFAULT_MATRIX, ...storedMatrix }), [storedMatrix]);

  function setChannel(row: Trigger, channel: Channel, checked: boolean) {
    if (row.forced?.includes(channel)) return;
    const next = { ...matrix, [`${row.id}.${channel}`]: checked };
    setStoredMatrix(next);
    void logActivity("settings", `${row.label} ${channel} ${checked ? "enabled" : "disabled"}`, { event: row.id, channel, value: checked });
  }

  function enableAll() {
    setStoredMatrix(Object.fromEntries(Object.keys(DEFAULT_MATRIX).map((key) => [key, true])));
    toast.success("All notification channels enabled");
  }

  function disableNonCritical() {
    const next = Object.fromEntries(
      ALL_ROWS.flatMap((row) => CHANNELS.map((channel) => {
        const forced = row.forced?.includes(channel.id) ?? false;
        const essential = row.priority === "Critical" || row.priority === "Immediate";
        return [`${row.id}.${channel.id}`, forced || essential];
      })),
    );
    setStoredMatrix(next);
    toast.success("Non-critical notifications disabled");
  }

  async function sendTestNotification() {
    setTestingPush(true);
    try {
      if (!("Notification" in window)) {
        toast.error("Browser notifications are not supported on this device");
        return;
      }
      if (window.top !== window.self) {
        toast.info("Open the app in a new tab to test browser push permissions");
        return;
      }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications are blocked. Enable them in your browser site settings.");
        return;
      }
      new Notification("Velocity Trade", { body: "Test notification delivered. Your browser alerts are active." });
      toast.success("Test notification sent");
    } finally {
      setTestingPush(false);
    }
  }

  return (
    <div className="space-y-5">
      <SubPageHeader
        title="Notifications"
        description="Configure delivery channels for account, execution and market events."
        backTo="/profile/settings"
        backLabel="Settings"
      />

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex flex-col gap-4 border-b border-border bg-secondary/30 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">System Preferences</p>
            <h2 className="mt-1 text-lg font-semibold">Notification Matrix</h2>
            <p className="mt-1 text-xs text-muted-foreground">Security safeguards remain active when optional channels are disabled.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={enableAll}><Volume2 className="size-3.5" /> Enable All</Button>
            <Button type="button" variant="outline" size="sm" onClick={disableNonCritical}><VolumeX className="size-3.5" /> Disable Non-Critical</Button>
            <Button type="button" size="sm" onClick={sendTestNotification} disabled={testingPush}><Send className="size-3.5" /> {testingPush ? "Testing…" : "Send Test Notification"}</Button>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-background/40">
                <th className="w-[46%] px-4 py-3 text-left text-[10px] font-bold uppercase text-muted-foreground sm:px-5">Event trigger</th>
                {CHANNELS.map(({ id, label, icon: Icon }) => (
                  <th key={id} className="w-[10%] px-2 py-3 text-center text-[10px] font-bold uppercase text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Icon className="size-3.5" />{label}</span>
                  </th>
                ))}
                <th className="w-[14%] px-4 py-3 text-right text-[10px] font-bold uppercase text-muted-foreground sm:px-5">Priority</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => (
                <MatrixGroup key={group.title} group={group} matrix={matrix} onChange={setChannel} />
              ))}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-2 border-t border-border bg-background/30 px-4 py-3 font-mono text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="inline-flex items-center gap-2"><span className="size-1.5 rounded-full bg-bull" /> Notification preferences synced</span>
          <span>Mandatory security channels are locked</span>
        </footer>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Moon className="size-4" /></span>
            <div>
              <h2 className="text-sm font-semibold">Quiet Hours / Digest</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Pause optional market and promotional alerts during your selected window. Critical alerts continue.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <Clock3 className="size-3.5 text-muted-foreground" />
              <input aria-label="Quiet hours start" type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} className="w-[74px] bg-transparent font-mono text-xs outline-none" />
              <span className="text-muted-foreground">-</span>
              <input aria-label="Quiet hours end" type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} className="w-[74px] bg-transparent font-mono text-xs outline-none" />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium"><Switch checked={quietHours} onCheckedChange={setQuietHours} aria-label="Enable quiet hours" /> Quiet Hours</label>
            <label className="flex items-center gap-2 text-xs font-medium"><Switch checked={digest} onCheckedChange={setDigest} aria-label="Enable notification digest" /> Daily Digest</label>
          </div>
        </div>
      </section>
    </div>
  );
}

function MatrixGroup({ group, matrix, onChange }: { group: (typeof GROUPS)[number]; matrix: Record<string, boolean>; onChange: (row: Trigger, channel: Channel, checked: boolean) => void }) {
  return (
    <>
      <tr className="border-b border-border bg-secondary/20">
        <td colSpan={6} className={`px-4 py-2 text-[10px] font-bold uppercase ${group.tone} sm:px-5`}>{group.title}</td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.id} className="border-b border-border/70 transition-colors last:border-b-0 hover:bg-secondary/20">
          <td className="px-4 py-3 sm:px-5"><p className="text-xs font-semibold sm:text-sm">{row.label}</p><p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">{row.detail}</p></td>
          {CHANNELS.map(({ id }) => {
            const forced = row.forced?.includes(id) ?? false;
            const checked = forced || Boolean(matrix[`${row.id}.${id}`]);
            return (
              <td key={id} className="px-2 py-3 text-center">
                <span className="inline-flex items-center gap-1">
                  <Checkbox checked={checked} disabled={forced} onCheckedChange={(value) => onChange(row, id, value === true)} aria-label={`${row.label} ${id}${forced ? ", required" : ""}`} className={checked ? "border-bull data-[state=checked]:bg-bull data-[state=checked]:text-bull-foreground" : "border-border"} />
                  {forced ? <LockKeyhole className="size-3 text-muted-foreground" aria-label="Required" /> : null}
                </span>
              </td>
            );
          })}
          <td className="px-4 py-3 text-right sm:px-5"><PriorityBadge priority={row.priority} /></td>
        </tr>
      ))}
    </>
  );
}

function PriorityBadge({ priority }: { priority: Trigger["priority"] }) {
  const tone = priority === "Critical" ? "text-bear" : priority === "Immediate" ? "text-warning" : priority === "Standard" ? "text-bull" : "text-muted-foreground";
  const Icon = priority === "Critical" ? ShieldCheck : priority === "Immediate" ? BellRing : priority === "Standard" ? Radio : FlaskConical;
  return <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase ${tone}`}><Icon className="size-3" />{priority}</span>;
}