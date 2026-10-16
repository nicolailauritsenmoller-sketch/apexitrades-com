import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Plus, Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePreference, functionalAllowed } from "@/lib/preferences";
import { useQuotes } from "@/hooks/useMarket";
import { getProfileOverview } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const ALERT_CATEGORIES = [
  { key: "trade", label: "Trade Executions", hint: "Scalp settlements and closed positions" },
  { key: "risk", label: "Margin & Risk Warnings", hint: "Margin calls and liquidation risk" },
  { key: "price", label: "Price Alerts", hint: "Your custom threshold triggers" },
  { key: "system", label: "System Announcements", hint: "Account, funding and platform notices" },
] as const;
export const ALERT_CHANNELS = [
  { key: "inApp", label: "In-app" },
  { key: "push", label: "Push" },
  { key: "sound", label: "Sound" },
] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number]["key"];
type Channel = (typeof ALERT_CHANNELS)[number]["key"];

export function categoryOf(kind?: string | null): AlertCategory {
  if (kind === "trade_execution" || kind === "trade") return "trade";
  if (kind === "margin_risk") return "risk";
  if (kind === "price_alert") return "price";
  return "system";
}

const DEFAULTS: Record<Channel, boolean> = { inApp: true, push: false, sound: true };

export function useAlertPrefs() {
  const [matrix, setMatrix] = usePreference("commsMatrix", {});
  const enabled = (cat: AlertCategory, ch: Channel) => matrix[`${cat}.${ch}`] ?? DEFAULTS[ch];
  const toggle = (cat: AlertCategory, ch: Channel, value: boolean) =>
    setMatrix({ ...matrix, [`${cat}.${ch}`]: value });
  return { enabled, toggle };
}

/** Delivers sound and browser push for a newly inserted notification per the trader's matrix. */
export function deliverAlert(
  prefs: ReturnType<typeof useAlertPrefs>,
  row: { kind?: string | null; title?: string; body?: string },
) {
  const cat = categoryOf(row.kind);
  if (prefs.enabled(cat, "sound")) {
    try {
      const a = new Audio("/sounds/trade.mp3");
      a.volume = cat === "risk" ? 0.9 : 0.5;
      void a.play().catch(() => undefined);
    } catch {
      /* playback blocked */
    }
  }
  if (
    prefs.enabled(cat, "push") &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    document.visibilityState !== "visible"
  ) {
    try {
      new Notification(row.title ?? "Velocity Trade", { body: row.body, icon: "/icon-192.png" });
    } catch {
      /* unsupported */
    }
  }
}

export function AlertSettingsDialog() {
  const prefs = useAlertPrefs();
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);
  async function onToggle(cat: AlertCategory, ch: Channel, value: boolean) {
    if (ch === "push" && value && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const result = await Notification.requestPermission();
      setPerm(result);
      if (result !== "granted") return;
    }
    prefs.toggle(cat, ch, value);
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notification settings" className="size-8 text-muted-foreground">
          <Settings />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Notification preferences</DialogTitle>
          <DialogDescription>Choose how each alert category reaches you.</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border rounded-md border border-border">
          <div className="grid grid-cols-[1fr_repeat(3,3.5rem)] px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Category</span>
            {ALERT_CHANNELS.map((c) => (
              <span key={c.key} className="text-center">{c.label}</span>
            ))}
          </div>
          {ALERT_CATEGORIES.map((cat) => (
            <div key={cat.key} className="grid grid-cols-[1fr_repeat(3,3.5rem)] items-center px-3 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{cat.label}</span>
                <span className="block text-[11px] text-muted-foreground">{cat.hint}</span>
              </span>
              {ALERT_CHANNELS.map((ch) => (
                <span key={ch.key} className="flex justify-center">
                  <Switch
                    aria-label={`${cat.label} ${ch.label}`}
                    checked={prefs.enabled(cat.key, ch.key)}
                    onCheckedChange={(v) => void onToggle(cat.key, ch.key, v)}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
        {perm === "denied" && (
          <p className="text-xs text-alert">Push is blocked in this browser's site settings.</p>
        )}
        {!functionalAllowed() && (
          <p className="text-xs text-muted-foreground">
            Allow functional cookies to save these choices on this device and your account.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">Push alerts show while this tab is in the background.</p>
      </DialogContent>
    </Dialog>
  );
}

/** Watches live margin utilization and records margin call / liquidation risk notices. */
export function useRiskWatcher(active: boolean) {
  const fetchOverview = useServerFn(getProfileOverview);
  const overview = useQuery({
    queryKey: ["profile-overview"],
    queryFn: () => fetchOverview(),
    enabled: active,
    refetchInterval: 15_000,
  });
  const last = useRef<string | null>(null);
  const pct = (overview.data as any)?.risk?.margin?.utilizationPct as number | null | undefined;
  useEffect(() => {
    if (pct == null) return;
    const level = pct >= 85 ? "critical" : pct >= 51 ? "high" : null;
    if (level === last.current) return;
    last.current = level;
    if (!level) return;
    void supabase.rpc("record_self_alert", {
      p_kind: "margin_risk",
      p_title: level === "critical" ? "Liquidation risk notice" : "Margin call warning",
      p_body:
        level === "critical"
          ? `Margin utilization is ${pct.toFixed(1)}% of equity. Reduce exposure or add funds to avoid forced closure.`
          : `Margin utilization reached ${pct.toFixed(1)}% of equity. Review open positions and scalp trades.`,
    });
  }, [pct]);
}

const ALERT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"];

/** Custom threshold alerts, evaluated against live quotes and recorded into the feed. */
export function usePriceAlerts(active: boolean) {
  const [alerts, setAlerts] = usePreference("priceAlerts", []);
  const market = useQuotes(active && alerts.length ? ALERT_SYMBOLS : [], 5000);
  useEffect(() => {
    if (!alerts.length) return;
    const hit = alerts.filter((a) => {
      const q = market.quotes[a.symbol];
      if (!q || q.stale || !(q.price > 0)) return false;
      return a.direction === "above" ? q.price >= a.price : q.price <= a.price;
    });
    if (!hit.length) return;
    for (const a of hit) {
      const q = market.quotes[a.symbol]!;
      void supabase.rpc("record_self_alert", {
        p_kind: "price_alert",
        p_title: `${a.symbol.replace("USDT", "")} ${a.direction === "above" ? "rose above" : "fell below"} ${a.price.toLocaleString()} USDT`,
        p_body: `Your price alert triggered. Last price ${q.price.toLocaleString()} USDT.`,
      });
    }
    setAlerts(alerts.filter((a) => !hit.includes(a)));
  }, [market.quotes, alerts, setAlerts]);
  return { alerts, setAlerts, quotes: market.quotes };
}

export function PriceAlertManager({ manager }: { manager: ReturnType<typeof usePriceAlerts> }) {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const value = Number(price);
  const live = manager.quotes[symbol]?.price;
  function add() {
    if (!(value > 0)) return;
    manager.setAlerts([
      ...manager.alerts,
      { id: crypto.randomUUID(), symbol, direction, price: value },
    ].slice(-20));
    setPrice("");
  }
  return (
    <section className="px-5 py-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <BellRing className="size-3" /> Price alerts
      </h3>
      <div className="mb-2 flex flex-wrap gap-1">
        {ALERT_SYMBOLS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={symbol === s ? "secondary" : "ghost"}
            className="h-7 px-2 text-[11px]"
            onClick={() => setSymbol(s)}
          >
            {s.replace("USDT", "")}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-9 w-20 text-[11px]"
          onClick={() => setDirection(direction === "above" ? "below" : "above")}
        >
          {direction === "above" ? "Above" : "Below"}
        </Button>
        <Input
          inputMode="decimal"
          placeholder={live ? `Now ${live.toLocaleString()}` : "Price (USDT)"}
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
          className="h-9 font-mono text-xs"
        />
        <Button size="sm" variant="outline" className="h-9" disabled={!(value > 0)} onClick={add} aria-label="Add price alert">
          <Plus />
        </Button>
      </div>
      {manager.alerts.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {manager.alerts.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-3 py-2 text-xs">
              <span>
                <span className="font-semibold">{a.symbol.replace("USDT", "")}</span>{" "}
                {a.direction} <span className="font-mono">{a.price.toLocaleString()}</span> USDT
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label="Remove price alert"
                onClick={() => manager.setAlerts(manager.alerts.filter((x) => x.id !== a.id))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Alerts check live prices while the platform is open and fire once.
      </p>
    </section>
  );
}
