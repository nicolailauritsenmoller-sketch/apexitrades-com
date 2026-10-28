/**
 * Notification filter taxonomy for the Communications Center feed.
 *
 * Every notification row maps to exactly one filter so the feed never shows an
 * item under a category the trader did not pick. Precedence is deliberate:
 * platform-ops notices first, then security, then trading, then money movement,
 * with everything else landing in System.
 */
export const NOTIFICATION_FILTERS = [
  { key: "all", label: "All" },
  { key: "trades", label: "Trades" },
  { key: "financial", label: "Financial" },
  { key: "security", label: "Security" },
  { key: "system", label: "System" },
] as const;

export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number]["key"];

export type NotificationLike = {
  kind?: string | null;
  title?: string | null;
  body?: string | null;
};

const TRADE_KINDS = new Set([
  "trade",
  "trade_execution",
  "contract",
  "position",
  "order",
  "scalp",
  "margin_risk",
  "price_alert",
]);
const FINANCIAL_KINDS = new Set([
  "deposit",
  "withdrawal",
  "swap",
  "transfer",
  "funding",
  "transaction",
  "fee",
  "correction",
  "settlement",
]);
const SECURITY_KINDS = new Set([
  "security",
  "kyc",
  "identity",
  "login",
  "password",
  "device",
  "session",
  "access",
]);

const SYSTEM_OPS_WORDS =
  /\b(maintenance|downtime|scheduled upgrade|outage|service interruption|platform update)\b/i;
const SECURITY_WORDS =
  /\b(password|passphrase|two[-\s]?factor|2fa|totp|authenticator|sign[-\s]?in|login|log[-\s]?in|device|session|ip address|unauthori[sz]ed|kyc|identity|verification|suspicious|security review|account controls|trading frozen|margin restricted|restricted|frozen|locked)\b/i;
const TRADE_WORDS =
  /\b(trade|trades|traded|trading|order|orders|position|positions|contract|contracts|scalp|futures|margin|liquidat\w*|leverage|long|short|take[-\s]profit|stop[-\s]loss|settle\w*)\b/i;
const FINANCIAL_WORDS =
  /\b(deposit|deposits|withdraw\w*|transfer\w*|swap\w*|credit\w*|debit\w*|balance|fee|fees|funding|ledger|wallet|usdt|usdc|fiat|limit)\b/i;

const KIND_LABELS: Record<string, string> = {
  trade_execution: "Trade Execution",
  trade: "Trade",
  contract: "Contract",
  position: "Position",
  margin_risk: "Margin Risk",
  price_alert: "Price Alert",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  swap: "Swap",
  security: "Security",
  announcement: "Announcement",
  support: "Support",
  success: "Success",
  warning: "Warning",
  info: "Info",
};

function keyOf(kind?: string | null) {
  return (kind ?? "").trim().toLowerCase();
}

/** Assigns a notification row to one feed filter. */
export function notificationFilterOf(row: NotificationLike): NotificationFilter {
  const kind = keyOf(row.kind);
  const text = `${row.title ?? ""} ${row.body ?? ""}`;
  if (SECURITY_KINDS.has(kind)) return "security";
  if (SYSTEM_OPS_WORDS.test(text)) return "system";
  if (SECURITY_WORDS.test(text)) return "security";
  if (TRADE_KINDS.has(kind) || TRADE_WORDS.test(text)) return "trades";
  if (FINANCIAL_KINDS.has(kind) || FINANCIAL_WORDS.test(text)) return "financial";
  return "system";
}

/** Upper-case status tag text, e.g. "TRADE EXECUTION", "SUCCESS", "WARNING". */
export function statusLabelOf(kind?: string | null) {
  const key = keyOf(kind);
  return (KIND_LABELS[key] ?? (key ? key.replace(/_/g, " ") : "Account")).toUpperCase();
}

/** Token-based tag styling that stays readable in both light and dark themes. */
export function statusToneOf(kind?: string | null) {
  const key = keyOf(kind);
  if (SECURITY_KINDS.has(key)) return "border-alert/25 bg-alert/10 text-alert";
  if (key === "success") return "border-bull/25 bg-bull/10 text-bull";
  if (key === "warning") return "border-warning/30 bg-warning/10 text-warning";
  if (TRADE_KINDS.has(key)) return "border-ops-blue/25 bg-ops-blue/10 text-ops-blue";
  if (FINANCIAL_KINDS.has(key)) return "border-bull/25 bg-bull/10 text-bull";
  return "border-border bg-secondary/60 text-muted-foreground";
}

export function filterLabelOf(filter: NotificationFilter) {
  return NOTIFICATION_FILTERS.find((f) => f.key === filter)?.label ?? "All";
}
