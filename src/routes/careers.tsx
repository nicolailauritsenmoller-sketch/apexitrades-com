import { createFileRoute } from "@tanstack/react-router";
import { CareersPage, careersHead } from "@/components/careers/CareersPage";

export const Route = createFileRoute("/careers")({
  head: () => careersHead("Working at Velocity Trade", "Explore Velocity Trade's mission, culture and areas of work in institutional multi-asset trading technology."),
  component: CareersOverview,
});

function CareersOverview() { return <CareersPage />; }