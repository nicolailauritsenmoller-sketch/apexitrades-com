import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Lock, ShieldCheck, Vault, Landmark, X, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCertificateDocumentUrl } from "@/lib/certificates.functions";

type Certificate = {
  id: string;
  title: string;
  issuer: string;
  badgeKey: string;
  summary: string;
  issueDate: string | null;
  expiryDate: string | null;
  hasDocument: boolean;
};

const BADGE_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  iso: { icon: BadgeCheck, tone: "text-primary" },
  soc2: { icon: ShieldCheck, tone: "text-bull" },
  gdpr: { icon: Landmark, tone: "text-primary" },
  ssl: { icon: Lock, tone: "text-bull" },
  custody: { icon: Vault, tone: "text-amber-500" },
};

const FALLBACK: Certificate[] = [
  {
    id: "iso",
    title: "ISO 27001 Certified",
    issuer: "BSI Group",
    badgeKey: "iso",
    summary:
      "Our information security management system is audited against the ISO/IEC 27001 international standard.",
    issueDate: null,
    expiryDate: null,
    hasDocument: false,
  },
  {
    id: "soc2",
    title: "SOC 2 Type II Compliant",
    issuer: "Prescient Assurance",
    badgeKey: "soc2",
    summary:
      "Independent auditors verify our security, availability and confidentiality controls over an extended observation period.",
    issueDate: null,
    expiryDate: null,
    hasDocument: false,
  },
  {
    id: "gdpr",
    title: "GDPR Data Protection",
    issuer: "EU Data Protection Authority",
    badgeKey: "gdpr",
    summary:
      "Personal data is processed lawfully under the EU General Data Protection Regulation, with full access and erasure rights.",
    issueDate: null,
    expiryDate: null,
    hasDocument: false,
  },
  {
    id: "ssl",
    title: "256-Bit SSL Encryption",
    issuer: "DigiCert",
    badgeKey: "ssl",
    summary:
      "All traffic between your device and our platform is encrypted end-to-end with 256-bit TLS.",
    issueDate: null,
    expiryDate: null,
    hasDocument: false,
  },
  {
    id: "custody",
    title: "Multi-Sig Cold Storage",
    issuer: "Fireblocks Custody",
    badgeKey: "custody",
    summary:
      "Client funds are custodied in multi-signature cold wallets that require several independent approvals to move.",
    issueDate: null,
    expiryDate: null,
    hasDocument: false,
  },
];

function useCertificates() {
  return useQuery({
    queryKey: ["public-certificates"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Certificate[]> => {
      const { data, error } = await supabase
        .from("certificates")
        .select("id,title,issuer,badge_key,summary,issue_date,expiry_date,document_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error || !data?.length) return FALLBACK;
      return data.map((row: any) => ({
        id: row.id,
        title: row.title,
        issuer: row.issuer ?? "",
        badgeKey: row.badge_key ?? "iso",
        summary: row.summary ?? "",
        issueDate: row.issue_date ?? null,
        expiryDate: row.expiry_date ?? null,
        hasDocument: Boolean(row.document_url),
      }));
    },
  });
}

function CertificateCard({ cert, onVerify }: { cert: Certificate; onVerify: () => void }) {
  const [open, setOpen] = useState(false);
  const { icon: Icon, tone } = BADGE_ICON[cert.badgeKey] ?? BADGE_ICON["iso"]!;

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
          className={`grid size-12 place-items-center rounded-full border border-border bg-background ${tone}`}
        >
          <Icon className="size-6" strokeWidth={2.2} />
        </span>
        <span className="text-sm font-semibold leading-snug">{cert.title}</span>
      </button>
      {cert.hasDocument ? (
        <button
          type="button"
          onClick={onVerify}
          className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
        >
          Verify certificate
        </button>
      ) : null}
      {open ? (
        <p
          role="tooltip"
          className="absolute inset-x-2 top-full z-20 mt-2 rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground shadow-lg"
        >
          {cert.summary}
          {cert.issuer ? (
            <span className="mt-1 block font-medium text-foreground">Issued by {cert.issuer}</span>
          ) : null}
          {cert.expiryDate ? (
            <span className="block">Valid until {cert.expiryDate}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Full "Security & Regulatory Compliance" card section, rendered above the footer. */
export function TrustCertificates() {
  const { data } = useCertificates();
  const [active, setActive] = useState<Certificate | null>(null);
  const fetchDoc = useServerFn(getCertificateDocumentUrl);

  const doc = useQuery({
    queryKey: ["certificate-doc", active?.id],
    enabled: Boolean(active?.id),
    queryFn: () => fetchDoc({ data: { id: active!.id } }),
  });

  const list = data ?? FALLBACK;

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
          {list.map((c) => (
            <CertificateCard key={c.id} cert={c} onVerify={() => setActive(c)} />
          ))}
        </div>
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <h3 className="flex-1 font-display text-base font-bold">{active.title}</h3>
              <button type="button" onClick={() => setActive(null)} aria-label="Close">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{active.summary}</p>
            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              {active.issuer ? <div>Issuer: {active.issuer}</div> : null}
              {active.issueDate ? <div>Issued: {active.issueDate}</div> : null}
              {active.expiryDate ? <div>Expires: {active.expiryDate}</div> : null}
            </dl>
            {doc.isLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Preparing secure link…</p>
            ) : doc.data?.url ? (
              <a
                href={doc.data.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                <ExternalLink className="size-4" />
                Open verification document
              </a>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No verification document is published for this certificate.
              </p>
            )}
          </div>
        </div>
      ) : null}
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
