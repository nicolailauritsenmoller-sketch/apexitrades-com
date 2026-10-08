import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthenticatedGate } from "@/components/security/AuthenticatedGate";
export const Route = createFileRoute("/_authenticated")({ component: AuthenticatedLayout });
function AuthenticatedLayout() { return <AuthenticatedGate><Outlet /></AuthenticatedGate>; }
