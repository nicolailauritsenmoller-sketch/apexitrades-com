import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, ChevronRight, IdCard, Camera, Home } from "lucide-react";
import { getMyKyc } from "@/lib/kyc.functions";

type Step = { label: string; icon: typeof IdCard; status: string };

function tone(s: string) {
  if (s === "approved") return "text-bull";
  if (s === "pending") return "text-amber-500";
  if (s === "rejected") return "text-bear";
  return "text-muted-foreground";
}

function label(s: string) {
  if (s === "approved") return "Verified";
  if (s === "pending") return "In review";
  if (s === "rejected") return "Resubmit";
  return "Not submitted";
}

export function KycDashboardCard() {
  const fetchKyc = useServerFn(getMyKyc);
  const kyc = useQuery({ queryKey: ["my-kyc"], queryFn: () => fetchKyc() });
  if (kyc.isLoading) return null;
  const l1 = (kyc.data?.level1Status as string) ?? "unverified";
  const l2 = (kyc.data?.level2Status as string) ?? "unsubmitted";
  if (l1 === "approved" && l2 === "approved") return null;

  const steps: Step[] = [
    { label: "Government ID", icon: IdCard, status: l1 },
    { label: "Selfie", icon: Camera, status: l1 },
    { label: "Proof of address", icon: Home, status: l1 === "approved" ? l2 : "unverified" },
  ];
  const actionable = l1 !== "pending" && !(l1 === "approved" && l2 === "pending");

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" style={{ touchAction: "manipulation" }}>
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Verify your identity</h2>
          <p className="text-sm text-muted-foreground">
            Upload your ID, a live selfie and proof of address to unlock withdrawals and higher limits.
          </p>
        </div>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5">
            <s.icon className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{s.label}</span>
            <span className={`text-xs font-medium ${tone(s.status)}`}>{label(s.status)}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/profile/verification"
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground sm:w-auto"
      >
        {actionable ? "Upload documents" : "View verification status"}
        <ChevronRight className="size-4" />
      </Link>
    </section>
  );
}
