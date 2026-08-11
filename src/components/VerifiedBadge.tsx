import { BadgeCheck } from "lucide-react";

/** Bright green KYC-verified badge shown beside a user's name. */
export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Identity verified"
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500 ${className}`}
    >
      <BadgeCheck className="size-3" /> Verified ✓
    </span>
  );
}

/** Bold, monospaced account UID used everywhere a user is identified. */
export function UidTag({
  uid,
  className = "",
  prefix = "UID",
}: {
  uid?: string | null;
  className?: string;
  prefix?: string;
}) {
  return (
    <span className={`font-mono text-xs font-bold tracking-wide ${className}`}>
      {prefix}: #{uid ?? "—"}
    </span>
  );
}
