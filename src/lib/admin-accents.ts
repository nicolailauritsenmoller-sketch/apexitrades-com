/**
 * Institutional enterprise palette for the Admin Operations Dashboard.
 * Cards share one uniform slate border; only small icon chips and status
 * badges carry semantic colour - amber = pending, crimson = risk/alert,
 * emerald = verified/success. Metric values are always clean white.
 */
export type OpsAccent = "amber" | "red" | "emerald" | "blue" | "violet" | "neutral";

/** Uniform dark slate card edge for every ops card (#1E293B class of border). */
const UNIFORM_EDGE = "border border-border";

type AccentClasses = {
  /** Card border emphasis - uniform slate for every accent. */
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
    edge: UNIFORM_EDGE,
    chip: "bg-ops-amber-bg text-ops-amber",
    text: "text-foreground",
    badge: "border border-ops-amber/25 bg-ops-amber-bg text-ops-amber",
    tab: "bg-ops-amber/15 text-ops-amber",
  },
  red: {
    edge: UNIFORM_EDGE,
    chip: "bg-ops-red-bg text-ops-red",
    text: "text-foreground",
    badge: "border border-ops-red/25 bg-ops-red-bg text-ops-red",
    tab: "bg-ops-red/15 text-ops-red",
  },
  emerald: {
    edge: UNIFORM_EDGE,
    chip: "bg-ops-emerald-bg text-ops-emerald",
    text: "text-foreground",
    badge: "border border-ops-emerald/25 bg-ops-emerald-bg text-ops-emerald",
    tab: "bg-ops-emerald/15 text-ops-emerald",
  },
  blue: {
    edge: UNIFORM_EDGE,
    chip: "bg-ops-blue/15 text-ops-blue",
    text: "text-foreground",
    badge: "border border-ops-blue/25 bg-ops-blue/10 text-ops-blue",
    tab: "bg-ops-blue/15 text-ops-blue",
  },
  violet: {
    edge: UNIFORM_EDGE,
    chip: "bg-ops-violet/15 text-ops-violet",
    text: "text-foreground",
    badge: "border border-ops-violet/25 bg-ops-violet/10 text-ops-violet",
    tab: "bg-ops-violet/15 text-ops-violet",
  },
  neutral: {
    edge: UNIFORM_EDGE,
    chip: "bg-secondary text-muted-foreground",
    text: "text-foreground",
    badge: "border border-border bg-secondary/60 text-muted-foreground",
    tab: "bg-secondary text-foreground",
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
  referrals: "emerald",
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
  community: "emerald",
};

export function tabAccent(id: string): OpsAccent {
  return TAB_ACCENT[id] ?? "neutral";
}

/** Bold destructive action button (Force liquidate, Reject, Freeze). */
export const DANGER_BTN =
  "inline-flex min-h-9 touch-manipulation items-center justify-center gap-2 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50";

/** Approval action button (Approve deposit, Verify KYC). */
export const APPROVE_BTN =
  "inline-flex min-h-9 touch-manipulation items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50";

/**
 * Sidebar section-heading hierarchy. The operator-critical desks (live queue,
 * live monitoring, ledger movement) carry an amber or emerald label plus a
 * leading tick and, where a queue is always live, a glowing dot. Secondary
 * desks keep the sleek slate-cyan --ops-section token.
 */
type SectionClasses = {
  /** Uppercase heading label colour. */
  label: string;
  /** Leading tick bar before the label. */
  tick: string;
  /** Glowing active-desk dot after the label; empty when the section has none. */
  dot: string;
};

const SECTION_PRIMARY: Record<string, SectionClasses> = {
  // Amber = live operator queue.
  "Live support": {
    label: "text-ops-section-amber",
    tick: "bg-ops-section-amber/75",
    dot: "bg-ops-section-amber text-ops-section-amber",
  },
  // Emerald = live monitoring and ledger movement.
  Overview: {
    label: "text-ops-section-emerald",
    tick: "bg-ops-section-emerald/75",
    dot: "",
  },
  Money: {
    label: "text-ops-section-emerald",
    tick: "bg-ops-section-emerald/75",
    dot: "bg-ops-section-emerald text-ops-section-emerald",
  },
};

/** Secondary desks: sleek slate cyan/silver from the --ops-section token. */
const SECTION_SECONDARY: SectionClasses = {
  label: "text-ops-section",
  tick: "bg-ops-section/55",
  dot: "",
};

export function sectionAccent(section: string): SectionClasses {
  return SECTION_PRIMARY[section] ?? SECTION_SECONDARY;
}
