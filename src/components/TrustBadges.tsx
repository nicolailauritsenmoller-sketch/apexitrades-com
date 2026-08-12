import { useState } from "react";
import { BadgeCheck, Lock, ShieldCheck, Vault, Landmark } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Certificate = {
  key: string;
  title: string;
  icon: LucideIcon;
  tone: string;
  detail: string;
};

const CERTIFICATES: Certificate[] = [
  {
    key: "iso",
    title: "ISO 27001 Certified",
    icon: BadgeCheck,
    tone: "text-primary",
    detail:
      "Our information security management system is audited against the ISO/IEC 27001 international standard.",
  },
  {
    key: "soc2",
    title: "SOC 2 Type II Compliant",
    icon: ShieldCheck,
    tone: "text-bull",
    detail:
      "Independent auditors verify our security, availability and confidentiality controls over an extended observation period.",
  },
  {
    key: "gdpr",
    title: "GDPR Data Protection",
    icon: Landmark,
    tone: "text-primary",
    detail:
      "Personal data is processed lawfully under the EU General Data Protection Regulation, with full access and erasure rights.",
  },
  {
    key: "ssl",
    title: "256-Bit SSL Encryption",
    icon: Lock,
    tone: "text-bull",
    detail:
      "All traffic between your device and our platform is encrypted end-to-end with 256-bit TLS.",
  },
  {
    key: "custody",
    title: "Multi-Sig Cold Storage",
    icon: Vault,
    tone: "text-amber-500",
    detail:
      "Client funds are custodied in multi-signature cold wallets that require several independent approvals to move.",
  },
];

function CertificateCard({ cert }: { cert: Certificate }) {
  const [open, setOpen] = useState(false);
  const Icon = cert.icon;

  return (
    <div
      className="group relative flex touch-manipulation flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-6 text-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center gap-3"
      >
        <span
          className={`grid size-12 place-items-center rounded-full border border-border bg-background ${cert.tone}`}
        >
          <Icon className="size-6" strokeWidth={2.2} />
        </span>
        <span className="text-sm font-semibold leading-snug">{cert.title}</span>
      </button>
      {open ? (
        <p
          role="tooltip"
          className="absolute inset-x-2 top-full z-20 mt-2 rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground shadow-lg"
        >
          {cert.detail}
        </p>
      ) : null}
    </div>
  );
}

/** Full "Security & Regulatory Compliance" card section, rendered above the footer. */
export function TrustCertificates() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="rounded-2xl border border-border bg-card/60 p-5 sm:p-7">
        <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">
          Security &amp; Regulatory Compliance
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Independent standards and controls that protect your account, your data and your funds.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CERTIFICATES.map((c) => (
            <CertificateCard key={c.key} cert={c} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Compact trust strip for placement under primary CTAs (sign up, deposit, withdraw). */
export function TrustStrip({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium text-muted-foreground ${className}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <Lock className="size-3.5 text-bull" />
        256-Bit SSL Encrypted
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="size-3.5 text-primary" />
        Verified KYC/AML
      </span>
    </div>
  );
}
