import { createFileRoute } from "@tanstack/react-router";
import { CareersPage, careersHead } from "@/components/careers/CareersPage";
export const Route = createFileRoute("/careers_/internships")({ head: () => careersHead("Internships", "Explore early-career preparation and future internship opportunities in Velocity Trade's financial technology disciplines."), component: Internships });
function Internships() { return <CareersPage view="internships" />; }