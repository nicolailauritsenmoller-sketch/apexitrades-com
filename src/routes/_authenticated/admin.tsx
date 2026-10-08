import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Operations Console | Velocity Trade" },
    { name: "description", content: "Velocity Trade restricted operations and administration console." },
    { property: "og:title", content: "Operations Console | Velocity Trade" },
    { property: "og:description", content: "Velocity Trade restricted operations and administration console." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: Outlet,
});
