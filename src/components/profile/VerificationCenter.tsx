import { Link } from "@tanstack/react-router";
import { BadgeCheck, Fingerprint, ScanFace, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { getMyKyc } from "@/lib/kyc.functions";

type KycData = Awaited<ReturnType<typeof getMyKyc>>;

const STATUS_KEY: Record<string, "unverified" | "pending" | "approved" | "rejected"> = {
  unsubmitted: "unverified",
  unverified: "unverified",
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
};

const STATUS_LABEL: Record<string, string> = {
  unverified: "Unverified",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_TONE: Record<string, string> = {
  unverified: "border-border bg-secondary text-muted-foreground",
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-400",
  approved: "border-bull/40 bg-bull/10 text-bull",
  rejected: "border-bear/40 bg-bear/10 text-bear",
};

const DOC_LABEL: Record<string, string> = {
  passport: "Passport",
  id_card: "Government ID card",
  drivers_license: "Driver's licence",
};

const PROOF_LABEL: Record<string, string> = {
  utility_bill: "Utility bill",
  bank_statement: "Bank statement",
  tax_document: "Tax document",
};

function StatusPill({ status }: { status: string }) {
  const key = STATUS_KEY[status] ?? "unverified";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${STATUS_TONE[key]}`}>
      {STATUS_LABEL[key]}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold">{value ?? "-"}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

/** Verification Center: Level 1 and Level 2 status cards with independent state. */
export function VerificationCenter({ kyc }: { kyc: KycData }) {
  const level1 = STATUS_KEY[kyc?.kycLevel1Status ?? kyc?.level1Status ?? "unverified"] ?? "unverified";
  const level2 = STATUS_KEY[kyc?.kycLevel2Status ?? kyc?.level2Status ?? "unverified"] ?? "unverified";
  const needsL1Action = level1 === "unverified" || level1 === "rejected";
  const needsL2Action = level2 === "unverified" || level2 === "rejected";

  const dailyLimit =
    kyc?.dailyLimitUsdt != null
      ? `${kyc.dailyLimitUsdt.toLocaleString("en-US")} USDT per day`
      : level1 === "approved"
        ? "Standard desk limit - no custom cap set"
        : "Withdrawals locked until Level 1 is approved";

  return (
    <section className="touch-manipulation overflow-hidden rounded-lg border border-border bg-card">
      <header className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-base font-bold">Identity Verification Status</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Each verification tier is reviewed and approved independently by the compliance desk.
        </p>
      </header>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
        {/* Level 1 */}
        <article className="flex touch-manipulation flex-col rounded-lg border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-lg border border-border bg-secondary text-primary">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold">KYC Level 1</h3>
                <p className="text-[11px] text-muted-foreground">Basic identity verification</p>
              </div>
            </div>
            <StatusPill status={level1} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <Field label="Full name" value={kyc?.fullName ?? "Not provided"} />
            <Field label="Date of birth" value={formatDate(kyc?.dateOfBirth)} />
            <Field label="Address" value={kyc?.address ?? "Not provided"} />
            <Field
              label="Government ID type"
              value={kyc?.documentType ? DOC_LABEL[kyc.documentType] ?? kyc.documentType : "Not provided"}
            />
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-secondary/50 p-3">
            <Wallet className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Daily withdrawal limit</p>
              <p className="mt-0.5 text-xs font-semibold">{dailyLimit}</p>
            </div>
          </div>

          {kyc?.adminNote && level1 === "rejected" ? (
            <p className="mt-3 rounded-md border border-bear/30 bg-bear/5 p-3 text-xs text-bear">{kyc.adminNote}</p>
          ) : null}

          <div className="mt-4 flex-1" />
          {needsL1Action ? (
            <Button asChild size="sm" className="mt-2 w-full">
              <Link to="/profile/verification">{level1 === "rejected" ? "Re-submit" : "Verify Now"}</Link>
            </Button>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <BadgeCheck className="size-3.5" />
              {level1 === "pending" ? "Under compliance review" : "Level 1 verification complete"}
            </p>
          )}
        </article>

        {/* Level 2 */}
        <article className="flex touch-manipulation flex-col rounded-lg border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-lg border border-border bg-secondary text-primary">
                <Fingerprint className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold">KYC Level 2</h3>
                <p className="text-[11px] text-muted-foreground">Advanced verification</p>
              </div>
            </div>
            <StatusPill status={level2} />
          </div>

          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ScanFace className="size-3.5" /> Biometric liveness check
              </span>
              <span className="text-xs font-semibold">
                {level2 === "approved" ? "Passed" : kyc?.biometricSubmitted ? "Submitted" : "Not submitted"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Source of funds</span>
              <span className="text-xs font-semibold">
                {level2 === "approved"
                  ? "Verified"
                  : kyc?.sourceOfFundsSubmitted
                    ? `Submitted${kyc?.level2ProofType ? ` - ${PROOF_LABEL[kyc.level2ProofType] ?? kyc.level2ProofType}` : ""}`
                    : "Not submitted"}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border bg-secondary/50 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Unlocked at Level 2</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              <li>• VIP fee tier eligibility and higher leverage access</li>
              <li>• Raised daily withdrawal thresholds</li>
              <li>• Priority compliance and desk support</li>
            </ul>
          </div>

          {kyc?.level2AdminNote && level2 === "rejected" ? (
            <p className="mt-3 rounded-md border border-bear/30 bg-bear/5 p-3 text-xs text-bear">{kyc.level2AdminNote}</p>
          ) : null}

          <div className="mt-4 flex-1" />
          {needsL2Action ? (
            <Button asChild size="sm" variant={level1 === "approved" ? "default" : "outline"} className="mt-2 w-full">
              <Link to="/profile/verification">{level2 === "rejected" ? "Re-submit" : "Verify Now"}</Link>
            </Button>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <BadgeCheck className="size-3.5" />
              {level2 === "pending" ? "Under compliance review" : "Level 2 verification complete"}
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
