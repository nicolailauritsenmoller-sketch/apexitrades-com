import { createServerFn } from "@tanstack/react-start";

export const getNewListings = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchNewListings } = await import("./new-listings.server");
  return fetchNewListings();
});