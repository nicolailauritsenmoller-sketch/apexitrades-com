import { Eye } from "lucide-react";

/** Shown on financial desks when the signed-in staff member cannot mutate them. */
export function ReadOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" title="Only Super Admin and Treasury Manager accounts can make changes here.">
      <Eye className="size-3" /> Read-only / View only
    </span>
  );
}
