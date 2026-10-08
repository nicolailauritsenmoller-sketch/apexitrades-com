import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Operations Console | Velocity Trade" },
      { name: "description", content: "Open the Velocity Trade operations control center." },
      { property: "og:title", content: "Operations Console | Velocity Trade" },
      { property: "og:description", content: "Open the Velocity Trade operations control center." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://veloxitrade-com.lovable.app/admin" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://veloxitrade-com.lovable.app/admin" }],
  }),
  beforeLoad: () => { throw redirect({ to: "/sys-portal-x97", replace: true }); },
  component: () => null,
});