import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_FILTERS,
  notificationFilterOf,
  statusLabelOf,
  statusToneOf,
} from "./notification-filters";

describe("communications center feed filters", () => {
  it("offers exactly the five institutional categories in order", () => {
    expect(NOTIFICATION_FILTERS.map((f) => f.label)).toEqual([
      "All",
      "Trades",
      "Financial",
      "Security",
      "System",
    ]);
  });

  it("routes trade and risk notices to Trades", () => {
    expect(notificationFilterOf({ kind: "trade_execution", title: "Scalp settled", body: "BTC 2x" })).toBe("trades");
    expect(notificationFilterOf({ kind: "trade", title: "Trade adjusted", body: "Your BTC contract was updated by the trading desk." })).toBe("trades");
    expect(
      notificationFilterOf({
        kind: "margin_risk",
        title: "Margin call warning",
        body: "Margin utilization reached 55.0% of equity. Review open positions and scalp trades.",
      }),
    ).toBe("trades");
    expect(
      notificationFilterOf({
        kind: "price_alert",
        title: "BTC rose above 120,000 USDT",
        body: "Your price alert triggered. Last price 121,400 USDT.",
      }),
    ).toBe("trades");
  });

  it("routes funding notices to Financial", () => {
    expect(
      notificationFilterOf({
        kind: "success",
        title: "Deposit confirmed",
        body: "500 USDT (TRC20) cleared with 19 network confirmations and is now available in your balance.",
      }),
    ).toBe("financial");
    expect(
      notificationFilterOf({
        kind: "info",
        title: "Withdrawal limit updated",
        body: "Your daily withdrawal limit is now 25,000 USDT.",
      }),
    ).toBe("financial");
    expect(
      notificationFilterOf({
        kind: "warning",
        title: "Balance debited",
        body: "Account Operations debited 1,000 USDT. Reason: manual correction.",
      }),
    ).toBe("financial");
  });

  it("routes identity and access notices to Security", () => {
    expect(
      notificationFilterOf({
        kind: "warning",
        title: "Two-factor verification required",
        body: "For your security, please confirm your authenticator code to continue.",
      }),
    ).toBe("security");
    expect(
      notificationFilterOf({
        kind: "warning",
        title: "Account access restricted",
        body: "Your account was locked for a security review. Contact support for assistance.",
      }),
    ).toBe("security");
    expect(
      notificationFilterOf({
        kind: "warning",
        title: "Account controls updated",
        body: "Trading frozen - Margin restricted",
      }),
    ).toBe("security");
    expect(
      notificationFilterOf({
        kind: "security",
        title: "New sign-in detected",
        body: "A new device signed in to your account.",
      }),
    ).toBe("security");
  });

  it("keeps platform and community notices in System", () => {
    expect(
      notificationFilterOf({
        kind: "announcement",
        title: "Scheduled maintenance window",
        body: "Trading pauses for 30 minutes for platform maintenance.",
      }),
    ).toBe("system");
    expect(
      notificationFilterOf({
        kind: "success",
        title: "VIP Lounge access approved",
        body: "Your private community access request has been approved.",
      }),
    ).toBe("system");
    expect(
      notificationFilterOf({
        kind: "warning",
        title: "VIP priority chat",
        body: "A VIP client opened a priority chat with you. Open Support - Live Chats to take over.",
      }),
    ).toBe("system");
    expect(notificationFilterOf({ kind: null, title: null, body: null })).toBe("system");
  });

  it("renders the requested status tags", () => {
    expect(statusLabelOf("trade_execution")).toBe("TRADE EXECUTION");
    expect(statusLabelOf("success")).toBe("SUCCESS");
    expect(statusLabelOf("warning")).toBe("WARNING");
    expect(statusLabelOf(null)).toBe("ACCOUNT");
    expect(statusLabelOf("margin_risk")).toBe("MARGIN RISK");
  });

  it("keeps status tag tones on theme tokens", () => {
    expect(statusToneOf("success")).toContain("text-bull");
    expect(statusToneOf("warning")).toContain("text-warning");
    expect(statusToneOf("security")).toContain("text-alert");
    expect(statusToneOf("trade_execution")).toContain("text-ops-blue");
    expect(statusToneOf("info")).toContain("text-muted-foreground");
    expect(statusToneOf("info")).not.toContain("text-primary");
  });
});
