import { createFileRoute } from "@tanstack/react-router";
import { CareersPage, careersHead } from "@/components/careers/CareersPage";
export const Route = createFileRoute("/careers_/how-to-interview")({ head: () => careersHead("How to Interview", "Prepare to discuss your projects, decisions and collaboration for future Velocity Trade roles."), component: HowToInterview });
function HowToInterview() { return <CareersPage view="how-to-interview" />; }