import { createFileRoute } from "@tanstack/react-router";
import { CareersPage, careersHead } from "@/components/careers/CareersPage";
import { openingsQuery } from "@/components/careers/CareerOpenings";
import type { CareerFilters } from "@/lib/careers-shared";

const text = (v: unknown) => typeof v === "string" && v.trim() ? v.slice(0, 120) : undefined;
export const Route = createFileRoute("/careers_/roles")({
  validateSearch: (s: Record<string, unknown>): CareerFilters => Object.fromEntries(Object.entries({ q: text(s.q), country: text(s.country), location: text(s.location), type: text(s.type), group: text(s.group) }).filter(([, v]) => v)) as CareerFilters,
  loader: ({ context }) => context.queryClient.ensureQueryData(openingsQuery),
  head: () => careersHead("Open Roles", "Search current Velocity Trade job openings by title, country, location, job type and business group."),
  component: Roles,
});
function Roles() { return <CareersPage view="roles" filters={Route.useSearch()} />; }
