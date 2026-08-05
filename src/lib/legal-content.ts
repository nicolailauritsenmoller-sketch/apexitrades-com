export type LegalDoc = {
  title: string;
  body: string[];
};

export const LEGAL_DOCS: Record<
  "terms" | "privacy" | "risk" | "aml" | "faq" | "help",
  LegalDoc
> = {
  terms: {
    title: "Terms of Service",
    body: [
      "By opening an account you agree to use Velocity solely for lawful trading activity and to provide accurate identity information on request.",
      "Accounts are personal and non-transferable. You are responsible for keeping your credentials and devices secure, and for all activity carried out under your account.",
      "Deposits are credited only after review. Withdrawals are processed after identity verification and may be delayed where additional checks are required.",
      "We may suspend or close accounts that breach these terms, attempt to manipulate pricing, or are linked to fraudulent activity.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    body: [
      "We collect the data required to operate your account: contact details, identity documents, balances, trade history, and device/session metadata such as browser, operating system, IP address and approximate country.",
      "Identity documents are stored in private encrypted storage and are accessible only to you and to authorised compliance reviewers.",
      "We never sell personal data. Data is shared only with service providers required to run the platform, or where legally compelled.",
      "You may request a copy or deletion of your personal data at any time via support, subject to record-keeping obligations.",
    ],
  },
  risk: {
    title: "Risk Disclosure",
    body: [
      "Trading leveraged and fixed-time products carries a high level of risk and can result in the loss of your entire balance.",
      "Prices for crypto, equities, futures, forex and metals can move sharply and without warning. Past performance never indicates future results.",
      "Fixed-time contracts settle on the price at expiry. If the market moves against your direction, the full stake is lost.",
      "Only trade with capital you can afford to lose, and seek independent advice if you are unsure whether these products suit you.",
    ],
  },
  aml: {
    title: "AML Policy",
    body: [
      "Velocity operates a risk-based anti-money-laundering programme. All users must complete identity verification before withdrawing funds.",
      "We monitor deposits, withdrawals and trading patterns for behaviour consistent with money laundering, terrorist financing or sanctions evasion.",
      "Suspicious activity may result in frozen balances, requests for source-of-funds evidence, and reporting to the relevant authorities.",
      "We do not accept third-party deposits: funding must originate from an account or wallet you control.",
    ],
  },
  faq: {
    title: "Frequently Asked Questions",
    body: [
      "How do I fund my account? Open Wallet, choose a coin and network, send to the displayed address and submit the deposit request with your transaction hash. Balances update once approved.",
      "Why is my balance zero? All accounts start at zero. Funds appear after a deposit request is reviewed and approved.",
      "How long does verification take? Most identity submissions are reviewed within a few hours. You will be notified in the app when the outcome is ready.",
      "How do fixed-time contracts work? Choose a duration tier, meet its minimum stake and pick up or down. At expiry the contract settles automatically against the market price.",
      "Can I withdraw at any time? Withdrawals require verified identity and available spot balance; requests are reviewed before payout.",
    ],
  },
  help: {
    title: "Help Center",
    body: [
      "Getting started: complete identity verification, fund your spot wallet, then open the Trade terminal to place spot or fixed-time contracts.",
      "Wallet tools: use Swap to convert between supported currencies internally, and Assets for a consolidated view of balances and exposure.",
      "Notifications: the bell in the header carries deposit, withdrawal, verification and contract settlement updates.",
      "Still stuck? Start a live chat from the floating widget, or email support@velocity.trade and include your 7-character UID.",
    ],
  },
};
