import { expect, it } from "vitest";
import { moderateRows } from "./discovery-policy";
it("hides moderated tokens without blocking another content kind", () => {
  const rules = [{ content_kind: "alpha", content_id: "a", status: "hidden", priority: 0 }];
  expect(moderateRows([{ id: "a" }, { id: "b" }], "alpha", rules, r => r.id)).toEqual([{ id: "b" }]);
  expect(moderateRows([{ id: "a" }], "listing", rules, r => r.id)).toEqual([{ id: "a" }]);
});
it("promotes featured rows while preserving unmoderated feed order", () => {
  expect(moderateRows([{ id: "a" }, { id: "b" }, { id: "c" }], "news", [{ content_kind: "news", content_id: "c", status: "featured", priority: 10 }], r => r.id)).toEqual([{ id: "c" }, { id: "a" }, { id: "b" }]);
});