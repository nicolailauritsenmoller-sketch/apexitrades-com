import { createFileRoute } from "@tanstack/react-router";
import { CareersPage, careersHead } from "@/components/careers/CareersPage";
export const Route = createFileRoute("/careers_/extraordinary-ability")({ head: () => careersHead("Extraordinary Ability", "Learn how exceptional engineering, research and product work can connect with Velocity Trade's mission."), component: ExtraordinaryAbility });
function ExtraordinaryAbility() { return <CareersPage view="extraordinary-ability" />; }