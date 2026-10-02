import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Briefcase, Mail, MessageSquare } from "lucide-react";
import { getMyAccountManager } from "@/lib/vip-tiers.functions";

/** Shown only to VIP Tier 3+ members with an assigned account manager. */
export function RelationshipManagerCard() {
  const fetchManager = useServerFn(getMyAccountManager);
  const { data } = useQuery({
    queryKey: ["my-account-manager"],
    queryFn: () => fetchManager(),
    staleTime: 60_000,
  });
  if (!data) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Briefcase className="size-4 text-primary" />
        <h2 className="text-xs font-semibold uppercase text-muted-foreground">Relationship Manager</h2>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">{data.name}</p>
          {data.email ? (
            <a
              href={`mailto:${data.email}`}
              className="mt-0.5 inline-flex touch-manipulation items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Mail className="size-3" /> {data.email}
            </a>
          ) : null}
        </div>
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("velocity:open-chat", { detail: { department: "account_manager" } }),
            )
          }
          className="inline-flex touch-manipulation items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary/80"
        >
          <MessageSquare className="size-4" /> Contact Manager
        </button>
      </div>
    </section>
  );
}
