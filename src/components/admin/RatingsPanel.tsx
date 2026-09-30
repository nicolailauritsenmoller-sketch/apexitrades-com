import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { getChatRatings } from "@/lib/desk.functions";

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`size-3.5 ${n <= value ? "fill-warning text-warning" : "text-muted-foreground"}`}
        />
      ))}
    </span>
  );
}

/** Ratings & reviews left by users after a live chat session. */
export function RatingsPanel() {
  const fetchRatings = useServerFn(getChatRatings);
  const q = useQuery({
    queryKey: ["chat-ratings"],
    queryFn: () => fetchRatings(),
    refetchInterval: 30_000,
  });
  const data = q.data;

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">Ratings &amp; reviews</h2>
        {data && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Stars value={Math.round(data.average)} />
            <span>
              <span className="num">{data.average.toFixed(2)}</span> average · {data.total} reviews
            </span>
          </div>
        )}
      </header>
      <div className="overflow-x-auto">
        {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading reviews…</p>}
        {data && data.rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No reviews yet.</p>
        )}
        {data && data.rows.length > 0 && (
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2">Rating</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Agent</th>
                <th className="px-4 py-2">Feedback</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-2">
                    <Stars value={r.stars} />
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium">{r.userName}</span>
                    <span className="block text-[11px] text-muted-foreground">UID {r.userUid}</span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.agentName ? (
                      <>
                        {r.agentName}
                        <span className="block text-[11px] text-muted-foreground">
                          {r.agentRole}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="max-w-sm px-4 py-2 text-xs text-muted-foreground">
                    {r.feedback ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-[11px] text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
