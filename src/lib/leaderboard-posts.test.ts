import { describe, expect, it } from "vitest";
import { publishedFeed, type DeskEntry } from "@/components/leaderboard/LeaderboardDeskCard";

const entry = (id: string): DeskEntry => ({ position_id: id, leader_id: "l", public_name: "RealName", bio: "orig", avatar_url: null, symbol: "BTCUSDT", display_symbol: "BTCUSDT", asset_class: "future", side: "long", leverage: 5, entry_price: 100, exit_price: 110, realized_pnl: 50, pnl_pct: 10, closed_at: "2026-11-01T00:00:00Z", trades_30d: 1, volume_30d: 1, pnl_30d: 50, margin_30d: 500, sharpe: null, sortino: null, max_drawdown_pct: null, kyc_verified: true, vip_level: 0, copy_traders: 0, views: 3, shares: 1 });

describe("leaderboard publishing", () => {
  it("shows only trades with an approved post", () => {
    expect(publishedFeed([entry("a"), entry("b")], [{ position_id: "b", display_name: null, commentary: null }]).map(e => e.position_id)).toEqual(["b"]);
  });
  it("applies curated name and commentary but keeps real trade figures", () => {
    const [e] = publishedFeed([entry("a")], [{ position_id: "a", display_name: "CryptoKing77", commentary: "Held the retest." }]);
    expect(e.public_name).toBe("CryptoKing77");
    expect(e.bio).toBe("Held the retest.");
    expect(e.realized_pnl).toBe(50);
    expect(e.views).toBe(3);
  });
});
