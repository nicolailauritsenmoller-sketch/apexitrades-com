/**
 * High-contrast colour-coding system for the Admin Operations Dashboard.
 * amber = pending, red = risk/alert, emerald = verified/success,
 * blue = general metrics / user ops, violet = auth & security.
 */
export type OpsAccent = "amber" | "red" | "emerald" | "blue" | "violet" | "neutral";

type AccentClasses = {
  /** Left rail / border emphasis for cards. */
  edge: string;
  /** Icon chip background + colour. */
  chip: string;
  /** Text colour for values and icons. */
  text: string;
  /** Pill badge. */
  badge: string;
  /** Ring/border used for active tabs. */
  tab: string;
};

export const OPS_ACCENTS: Record<OpsAccent, AccentClasses> = {
  amber: {
    edge: "border-l-4 border-l-ops-amber border-ops-amber/40",
    chip: "bg-ops-amber/15 text-ops-amber",
    text: "text-ops-amber",
    badge: "border border-ops-amber/50 bg-ops-amber/15 text-ops-amber",
    tab: "bg-ops-amber/15 text-ops-amber",
  },
  red: {
    edge: "border-l-4 border-l-ops-red border-ops-red/40",
    chip: "bg-ops-red/15 text-ops-red",
    text: "text-ops-red",
    badge: "border border-ops-red/50 bg-ops-red/15 text-ops-red",
    tab: "bg-ops-red/15 text-ops-red",
  },
  emerald: {
    edge: "border-l-4 border-l-ops-emerald border-ops-emerald/40",
    chip: "bg-ops-emerald/15 text-ops-emerald",
    text: "text-ops-emerald",
    badge: "border border-ops-emerald/50 bg-ops-emerald/15 text-ops-emerald",
    tab: "bg-ops-emerald/15 text-ops-emerald",
  },
  blue: {
    edge: "border-l-4 border-l-ops-blue border-ops-blue/40",
    chip: "bg-ops-blue/15 text-ops-blue",
    text: "text-ops-blue",
    badge: "border border-ops-blue/50 bg-ops-blue/15 text-ops-blue",
    tab: "bg-ops-blue/15 text-ops-blue",
  },
  violet: {
    edge: "border-l-4 border-l-ops-violet border-ops-violet/40",
    chip: "bg-ops-violet/15 text-ops-violet",
    text: "text-ops-violet",
    badge: "border border-ops-violet/50 bg-ops-violet/15 text-ops-violet",
    tab: "bg-ops-violet/15 text-ops-violet",
  },
  neutral: {
    edge: "border-border/70",
    chip: "bg-primary/10 text-primary",
    text: "text-foreground",
    badge: "border border-border text-muted-foreground",
    tab: "bg-primary/15 text-primary",
  },
};

/** Accent assigned to each dashboard tab id. */
export const TAB_ACCENT: Record<string, OpsAccent> = {
  // Risk & alerts
  risk: "red",
  security: "red",
  corrections: "red",
  // Finance
  deposits: "emerald",
  withdrawals: "emerald",
  transactions: "emerald",
  addresses: "emerald",
  gateways: "emerald",
  accounting: "emerald",
  // User ops
  users: "blue",
  roles: "blue",
  credit: "blue",
  active: "blue",
  overview: "blue",
  analytics: "blue",
  trades: "blue",
  // Auth & security config
  authproviders: "violet",
  audit: "violet",
  engine: "violet",
  settings: "violet",
  // Support / pending work
  support: "amber",
  vip: "amber",
  tickets: "amber",
  broadcast: "amber",
  ratings: "amber",
  agent: "amber",
};

export function tabAccent(id: string): OpsAccent {
  return TAB_ACCENT[id] ?? "neutral";
}

/** Bold destructive action button (Force liquidate, Reject, Freeze). */
export const DANGER_BTN =
  "touch-manipulation rounded-lg border border-ops-red/60 bg-ops-red/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ops-red transition-colors hover:bg-ops-red hover:text-background disabled:opacity-50";

/** Approval action button (Approve deposit, Verify KYC). */
export const APPROVE_BTN =
  "touch-manipulation rounded-lg border border-ops-emerald/60 bg-ops-emerald/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ops-emerald transition-colors hover:bg-ops-emerald hover:text-background disabled:opacity-50";
