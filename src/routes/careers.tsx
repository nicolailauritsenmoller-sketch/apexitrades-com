import { createFileRoute } from "@tanstack/react-router";
import { CareersPage, careersHead } from "@/components/careers/CareersPage";

import { openingsQuery } from "@/components/careers/CareerOpenings";

export const Route = createFileRoute("/careers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(openingsQuery),
  head: () => careersHead("Working at Velocity Trade", "Explore Velocity Trade's mission, culture and areas of work in institutional multi-asset trading technology."),
  component: CareersOverview,
});

function CareersOverview() { return <CareersPage />; }