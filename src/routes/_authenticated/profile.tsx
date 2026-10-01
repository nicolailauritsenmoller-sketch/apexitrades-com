import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfileLayout,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-bear">
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

function ProfileLayout() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5 [touch-action:manipulation]">
        <Outlet />
      </div>
    </AppShell>
  );
}
