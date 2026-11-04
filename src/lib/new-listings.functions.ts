import { createServerFn } from "@tanstack/react-start";

export const getNewListings = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchNewListings } = await import("./new-listings.server");
  const { readModeration } = await import("./discovery-editorial.server");
  const { moderateRows } = await import("./discovery-policy");
  const [feed, rules] = await Promise.all([fetchNewListings(), readModeration()]);
  return { ...feed, rows: moderateRows(feed.rows, "listing", rules, row => row.symbol) };
});