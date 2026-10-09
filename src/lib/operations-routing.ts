import { MessagesSquare, BadgeCheck, Inbox, LifeBuoy, LayoutDashboard, BarChart3, Gauge, Wrench, Radio, ShieldAlert, Users, Crown, KeySquare, CreditCard, Wallet2, Landmark, Receipt, ShieldCheck, Megaphone, Globe2, Gift, Star, IdCard, ScrollText, Fingerprint, Settings2 } from "lucide-react";
export const PLATFORM_ORIGIN = "https://veloxitrade-com.lovable.app";
export const NAV: { section: string; items: { id: string; label: string; icon: any }[] }[] = [
  {
    section: "Live support",
    items: [
      { id: "support", label: "Live Chat", icon: MessagesSquare },
      { id: "vip", label: "Priority Support", icon: BadgeCheck },
      { id: "requests", label: "Submitted Requests", icon: Inbox },
      { id: "tickets", label: "Support Tickets", icon: LifeBuoy },
    ],
  },
  {
    section: "Overview",
    items: [
      { id: "overview", label: "Dashboard", icon: LayoutDashboard },
      { id: "analytics", label: "Analytics & volume", icon: BarChart3 },
      { id: "trades", label: "Trades & outcomes", icon: Gauge },
      { id: "corrections", label: "Trade corrections", icon: Wrench },
      { id: "active", label: "Active users now", icon: Radio },
      { id: "risk", label: "Risk & liquidation", icon: ShieldAlert },
    ],
  },
  {
    section: "People",
    items: [
      { id: "users", label: "Users & KYC", icon: Users },
      { id: "vipmembers", label: "VIP Memberships", icon: Crown },
      { id: "roles", label: "Roles & permissions", icon: KeySquare },
      { id: "restrictions", label: "Security & restrictions", icon: ShieldAlert },
      { id: "credit", label: "Trader Trust & Risk", icon: CreditCard },
    ],
  },
  {
    section: "Money",
    items: [
      { id: "deposits", label: "Deposit clearing", icon: Wallet2 },
      { id: "withdrawals", label: "Withdrawals", icon: Landmark },
      { id: "treasury", label: "Treasury wallet", icon: Wallet2 },
      { id: "transactions", label: "Transactions", icon: Receipt },
      { id: "addresses", label: "Receiving addresses", icon: ShieldCheck },
      { id: "gateways", label: "Payment gateways", icon: CreditCard },
      { id: "accounting", label: "Accounting & revenue", icon: Receipt },
    ],
  },
  {
    section: "Engagement",
    items: [
      { id: "broadcast", label: "Broadcast", icon: Megaphone },
      { id: "community", label: "Community Desk", icon: Globe2 },
      { id: "referrals", label: "Referrals & rewards", icon: Gift },
      { id: "ratings", label: "Ratings & reviews", icon: Star },
      { id: "agent", label: "Agent persona", icon: IdCard },
    ],
  },
  {
    section: "System",
    items: [
      { id: "audit", label: "Audit logs", icon: ScrollText },
      { id: "security", label: "Security reports", icon: ShieldAlert },
      { id: "telemetry", label: "Security & activity", icon: Radio },
      { id: "authproviders", label: "Auth & identity", icon: Fingerprint },
      { id: "engine", label: "Engine & spreads", icon: Gauge },
      { id: "settings", label: "Settings", icon: Settings2 },
    ],
  },
];

export function validateOperationsSearch(search: Record<string, unknown>): { tab?: string } {
 return { tab: typeof search.tab === "string" && NAV.some(g => g.items.some(i => i.id === search.tab)) ? search.tab : "overview" };
}
export function operationsHead(tab = "overview") {
 const label = NAV.flatMap(g => g.items).find(i => i.id === tab)?.label;
 const title = tab === "overview" || !label ? "Operations Console | Velocity Trade" : `Operations Console - ${label} | Velocity Trade`;
 const description = "Velocity Trade staff console for trading operations, compliance, treasury and customer support.";
 return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { name: "robots", content: "noindex, nofollow" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: PLATFORM_ORIGIN + "/admin" }] };
}
