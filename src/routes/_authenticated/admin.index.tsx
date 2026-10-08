import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OperationsConsole } from "@/components/admin/OperationsConsole";
import { validateOperationsSearch, operationsHead } from "@/lib/operations-routing";
export const Route = createFileRoute("/_authenticated/admin/")({
 validateSearch: validateOperationsSearch,
 loaderDeps: ({ search }) => ({ tab: search.tab }),
 loader: ({ deps }) => deps,
 head: ({ loaderData }) => operationsHead(loaderData?.tab),
 component: ConsolePage,
});
function ConsolePage() {
 const { tab } = Route.useSearch(); const navigate = useNavigate({ from: Route.fullPath });
 return <OperationsConsole selectedTab={tab} onTab={tab => { void navigate({ search: { tab } }); }} />;
}
