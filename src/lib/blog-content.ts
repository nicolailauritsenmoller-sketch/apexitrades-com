export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  category: "Company" | "Institutional" | "Security" | "Product";
  authors?: string;
  excerpt: string;
  coverTitle: string;
  body: { heading: string; text: string }[];
};

// Reference copy supplied for the blog design, not independently verified announcements.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "system-update-take-control",
    title: "System Update: Take Control of Your Money with Velocity Trade",
    date: "Jun 16, 2026", category: "Product", coverTitle: "Take control.",
    excerpt: "Today, we’re launching several new products that further our mission of creating the Everything Exchange...",
    body: [{ heading: "A more connected financial experience", text: "A unified financial experience should put clear information, accessible account controls and informed decisions at its centre. Product availability, eligibility and execution terms should always be reviewed before trading." }],
  },
  {
    slug: "protecting-customer-assets",
    title: "How Velocity Trade protects customer assets",
    date: "Nov 4, 2026", category: "Security", coverTitle: "Protecting customer assets",
    excerpt: "TL;DR: Velocity was not impacted by external hot wallet incidents. We keep over 99% of customer assets in cold storage...",
    body: [{ heading: "Understanding custody safeguards", text: "Cold storage, access controls and independent oversight are different layers of custody protection. Customers should review the applicable custody agreement and verified disclosures rather than rely on a headline alone. The storage percentage and incident statement in this reference excerpt require confirmation." }],
  },
  {
    slug: "no-compromises-institutions",
    title: "No Compromises: The case for Velocity Trade as the best place for institutions",
    date: "Nov 11, 2026", category: "Institutional", authors: "Rick Schonberg, Matt Boyd", coverTitle: "No compromises.",
    excerpt: "Institutions no longer need to make compromises to access global liquidity...",
    body: [{ heading: "An institutional perspective", text: "Institutional market access involves more than a trading interface. Liquidity, custody arrangements, reporting, operational controls and counterparty risk all matter when evaluating a provider. Specific service coverage and author attribution remain subject to editorial confirmation." }],
  },
  {
    slug: "agent-controls",
    title: "Velocity for Agents introduces new Agent Controls",
    date: "Nov 11, 2026", category: "Product", coverTitle: "Agent Controls",
    excerpt: "TL;DR: We're bringing trusted protections to agentic trading. With Agent Controls, you can set trading limits...",
    body: [{ heading: "Boundaries for automated activity", text: "Automated trading systems should operate within explicit permissions, transaction limits and reviewable activity records. This reference article does not activate an agent product or grant permission to trade. A confirmed product announcement will need to specify supported capabilities and availability." }],
  },
  {
    slug: "security-checkup",
    title: "Consumer Protection Tuesday: Announcing Security Checkup - your account's security score",
    date: "Nov 10, 2026", category: "Security", coverTitle: "Security Checkup",
    excerpt: "A closer look at account security, stronger authentication and the controls that help protect your account.",
    body: [{ heading: "Review your account protection", text: "Use a unique password, enable two-factor authentication where available and review account activity regularly. A security score can help organise these checks, but it is not a guarantee against fraud or loss. Never share verification codes or recovery credentials with someone claiming to be support." }],
  },
  {
    slug: "national-trust-company",
    title: "Velocity launches National Trust Company with federally regulated, institutional-grade custody",
    date: "Nov 9, 2026", category: "Company", coverTitle: "Institutional-grade custody",
    excerpt: "An editorial reference on institutional custody and the role of federal regulatory oversight.",
    body: [{ heading: "Regulatory status matters", text: "A national trust charter is a specific legal authorisation, not a general description of a trading platform. This reference headline is not evidence of a Velocity Trade charter or regulatory approval. The legal entity, authorisation and scope of custody services must be verified before a launch announcement is published." }],
  },
  {
    slug: "q3-2026-earnings",
    title: "Q3 2026 Earnings Show All-time-high Subscribers and Prediction Markets Surpassing...",
    date: "Oct 29, 2026", category: "Company", coverTitle: "Q3 2026 highlights",
    excerpt: "A quarterly company update covering subscribers, market activity and business performance.",
    body: [{ heading: "Reporting with context", text: "Quarterly performance statements should be accompanied by verified financial results, defined reporting periods and clear measurement methods. No subscriber totals, prediction-market figures or financial results have been supplied for this preview. The headline must not be treated as a verified earnings release." }],
  },
];

export const getBlogPost = (slug: string) => BLOG_POSTS.find((post) => post.slug === slug);