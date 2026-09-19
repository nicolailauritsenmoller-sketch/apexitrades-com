import { Link } from "@tanstack/react-router } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { AccountMarginHealthCard, KycKybVerificationBadges } from "./KycPanel";

export const KYC_TONE: Record<string, string> = {
  unverified: "border-border text-muted-foreground",
  pending: "border-amber-400/40 text-amber-400",
  approved: "border-bull/40 text-bull",
  rejected: "border-bear/40 text-bear",
};

export const KYC_LABEL: Record<string, string> = {
  unverified: "Unverified",
  pending: "Under security review",
  approved: "Verified",
  rejected: "Compliance check failed",
};

export function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    import { AccountMarginHealthCard, KycKybVerificationBadges } from "./KycPanel";
  );
}

export function Card({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="touch-manipulation rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className={`mt-2 font-display text-xl font-bold ${tone ?? ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="touch-manipulation rounded-lg border border-border bg-card p-5">
      <header className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-sm font-bold tracking-tight">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
import { AccountMarginHealthCard, KycKybVerificationBadges } from "./KycPanel";
export function AccountHealthSection() {
  return (
    <div className="space-y-4 my-4">
      <AccountMarginHealthCard 
        healthPercentage={98}
        marginUsed="18.4%"
        marginFree="81.6%"
        syncRate="99.8%"
        leverageLimit="20x"
      />
      <KycKybVerificationBadges 
        kycStatus="verified"
        kybStatus="unverified"
      />
    </div>
  );
}
  return (
    <div className="space-y-4 my-4">
      <AccountMarginHealthCard 
        healthPercentage={98}
        marginUsed="18.4%"
        marginFree="81.6%"
        syncRate="99.8%"
        leverageLimit="20x"
      />
      <KycKybVerificationBadges 
        kycStatus="verified"
        kybStatus="unverified"
      />
    </div>
  );
}
/** Navigation tile used on the profile / settings hub screens. */
export function NavTile({
  to,
  icon: Icon,
  title,
  description,
  badge,
  badgeTone,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  badgeTone?: string;
}) {
  return (
    <Link
      to={to as never}
      className="flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {badge && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${badgeTone ?? "border-border text-muted-foreground"}`}
            >
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/** Back link shown at the top of every profile sub-page. */
export function SubPageHeader({
  title,
  description,
  backTo = "/profile",
  backLabel = "Profile",
}: {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <Link
        to={backTo as never}
        className="inline-flex touch-manipulation items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-3 rotate-180" /> {backLabel}
      </Link>
      <h1 className="font-display text-xl font-bold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 touch-manipulation rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-secondary"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-background transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    
  

