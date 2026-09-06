import { KYC_LABEL, KYC_TONE } from "@/components/profile/ui";
import { Lock } from "lucide-react";

const STATUS_KEY: Record<string, string> = {
  unsubmitted: "unverified",
  unverified: "unverified",
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
};

/** Tier card showing one verification level, its status badge and unlocked limits. */
export function KycTierCard({
  level,
  title,
  status,
  requirements,
  unlocks,
  locked,
  children,
}: {
  level: 1 | 2;
  title: string;
  status: string;
  requirements: string[];
  unlocks: string[];
  locked?: boolean;
  children?: React.ReactNode;
}) {
  const key = STATUS_KEY[status] ?? "unverified";

  return (
    <section className="touch-manipulation rounded-xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-secondary font-display text-sm font-bold text-primary">
            {level}
          </span>
          <div>
            <h3 className="font-display text-sm font-bold tracking-tight">{title}</h3>
            <p className="text-[11px] text-muted-foreground">Level {level} verification</p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${KYC_TONE[key]}`}
        >
          {locked ? "Locked" : (KYC_LABEL[key] ?? status)}
        </span>
      </header>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Requirements</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {requirements.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Unlocks</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {unlocks.map((u) => (
              <li key={u}>• {u}</li>
            ))}
          </ul>
        </div>
      </div>

      {locked ? (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          <Lock className="size-3.5" /> Available once Level 1 is verified.
        </p>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </section>
  );
}
