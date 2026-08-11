import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/sys-portal-x97", replace: true });
  },
  component: () => null,
});
