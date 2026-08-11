import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { IdCard, Loader2 } from "lucide-react";
import { AGENT_ROLES } from "@/lib/agent-roles";
import { getMyAgentProfile, saveMyAgentProfile } from "@/lib/desk.functions";

/** Lets a staff member choose the persona shown to users in live chat. */
export function AgentProfilePanel() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyAgentProfile);
  const save = useServerFn(saveMyAgentProfile);

  const profile = useQuery({ queryKey: ["my-agent-profile"], queryFn: () => fetchProfile() });

  const [fullName, setFullName] = useState("");
  const [agentRole, setAgentRole] = useState<string>(AGENT_ROLES[2]);
  const [staffId, setStaffId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    const p = profile.data as any;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setAgentRole(p.agent_role ?? AGENT_ROLES[2]);
    setStaffId(p.staff_id ?? "");
    setAvatarUrl(p.avatar_url ?? "");
  }, [profile.data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          fullName: fullName.trim(),
          agentRole,
          staffId: staffId.trim(),
          avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Agent persona updated.");
      qc.invalidateQueries({ queryKey: ["my-agent-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const badge = `${fullName || "Agent name"} — ${agentRole} (ID: ${staffId || "#000"})`;

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <IdCard className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-tight">Agent persona</h2>
      </header>
      <div className="space-y-3 p-4">
        <p className="text-xs text-muted-foreground">
          Shown in the user&apos;s chat header for every conversation you reply to.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Agent name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Sarah Jenkins"
              className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Staff ID</span>
            <input
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="#RM-408"
              className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Role</span>
            <select
              value={agentRole}
              onChange={(e) => setAgentRole(e.target.value)}
              className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
            >
              {AGENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Avatar URL (optional)</span>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">Preview: {badge}</span>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || fullName.trim().length < 2 || staffId.trim().length < 2}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="size-3 animate-spin" />}
            Save persona
          </button>
        </div>
      </div>
    </section>
  );
}
