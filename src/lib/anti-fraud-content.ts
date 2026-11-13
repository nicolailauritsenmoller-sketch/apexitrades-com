// Canonical copy for the Anti-Fraud and Impersonation Notice.
// The page route, the footer link and the homepage compliance card all read from
// here so the official domain and security contact can never drift apart.

export type AntiFraudSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export const ANTI_FRAUD_NOTICE = {
  title: "VT Anti-Fraud and Impersonation Notice",
  eyebrow: "Legal notice",
  summary:
    "How to confirm you are dealing with Velocity Trade, and what to do if someone is impersonating us.",
  officialDomain: "https://velocititrade.com",
  officialDomainLabel: "velocititrade.com",
  contactEmail: "fraud@velocititrade.com",
  lastUpdated: "13 November 2026",
  jurisdictions: [
    "Australia",
    "New Zealand",
    "United Kingdom",
    "European Union",
    "United States",
    "Canada",
    "South Africa",
    "Singapore",
  ],
  sections: [
    {
      id: "warning",
      heading: "Warning regarding fraudulent websites and platforms",
      paragraphs: [
        "Velocity Trade cautions clients and members of the public about the risk of fraudulent websites, platforms, or communications that may impersonate Velocity Trade or any of its licensed entities. Such scams may attempt to obtain money or personal information, including identification documents, by misrepresenting themselves as Velocity Trade or as being affiliated with Velocity Trade.",
        "Fraudulent websites or communications may attempt to mimic the appearance of genuine Velocity Trade materials by using similar branding, logos, design, or content. Velocity Trade does not operate through, nor does it authorize, any third-party websites or online platforms to provide regulated financial services on its behalf, except as clearly identified on Velocity Trade's official website.",
      ],
    },
    {
      id: "domain",
      heading: "Official domain verification",
      paragraphs: [
        "The official web address for the Velocity Trade platform is https://velocititrade.com. Before signing in, funding an account or uploading identification documents, check that the address shown by your browser is this domain exactly.",
        "Any other address, including a look-alike spelling, an extra word, a different top-level domain or a link delivered in a message, is not a Velocity Trade property even if it displays our branding, logos or copy.",
      ],
    },
    {
      id: "regulatory",
      heading: "Global regulatory context",
      paragraphs: [
        "Velocity Trade operates through independently licensed entities in Australia, New Zealand, the United Kingdom, the European Union, the United States, Canada, South Africa, and Singapore.",
        "Each entity is authorised and supervised under the rules of the jurisdiction in which it operates, and you can confirm an entity's registration with the relevant national regulator before committing funds. Fraudulent operators routinely claim approvals they do not hold, so a claim of regulation is not proof of it.",
      ],
    },
    {
      id: "vigilance",
      heading: "Vigilance guidelines against unsolicited communications",
      paragraphs: [
        "Most impersonation attempts begin with an unexpected message. Use the checks below before you reply, click, pay or send documents.",
      ],
      bullets: [
        "Velocity Trade does not open conversations first through WhatsApp, Telegram, SMS, social media direct messages or cold phone calls.",
        "We never ask for your password, two-factor authentication code, private keys, or remote access to your device.",
        "We never request a deposit, tax, clearance or unlock payment to release a withdrawal. Withdrawals are paid from your own balance after review.",
        "We never promise guaranteed returns, inside information or risk-free profits, and we do not manage client funds through personal chat accounts.",
        "Do not click links or open attachments in unexpected messages. Open the platform by typing the official address yourself.",
        "Verify the domain and the browser's security indicator on every page before you sign in or upload identification documents.",
        "If you have already shared credentials or documents, change your password, enable two-factor authentication and contact our security desk immediately.",
      ],
    },
    {
      id: "report",
      heading: "Reporting a suspected scam",
      paragraphs: [
        "If you believe a website, message, advertisement or individual is impersonating Velocity Trade, report it to fraud@velocititrade.com with the address or number used, screenshots, and any payment references. Do not send passwords or private keys.",
        "Reports are reviewed by our security team and may be shared with payment providers and the relevant authorities. Reporting does not guarantee recovery of funds, so also notify your bank or payment provider and your local law enforcement or financial regulator.",
      ],
    },
  ] as AntiFraudSection[],
};
