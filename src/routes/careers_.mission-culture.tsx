import { createFileRoute } from "@tanstack/react-router";
import { CareersPage, careersHead } from "@/components/careers/CareersPage";
export const Route = createFileRoute("/careers_/mission-culture")({ head: () => careersHead("Mission & Culture", "Discover the principles behind Velocity Trade's approach to teamwork, trust and financial technology."), component: MissionCulture });
function MissionCulture() { return <CareersPage view="mission-culture" />; }