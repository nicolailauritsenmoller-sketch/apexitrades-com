/** Automated Velocity Support knowledge base used by the live chat bot. */

export type BotTopicId = "funds" | "scalp" | "margin" | "health" | "verify" | "security";

export type BotQA = { id: string; q: string; a: string; keywords: string[] };

export const BOT_TOPICS: { id: BotTopicId; label: string; items: BotQA[] }[] = [
  {
    id: "funds",
    label: "Deposits & Withdrawals",
    items: [
      {
        id: "deposit-how",
        q: "How do I deposit funds?",
        a: "Go to Assets > Add Funds. Select your currency (USDT) and network. Approved initial deposits automatically credit your account balance and unlock the +5% First Deposit milestone for your Trader Trust Score.",
        keywords: ["deposit", "add funds", "fund", "top up", "usdt"],
      },
      {
        id: "deposit-pending",
        q: "Why is my deposit pending?",
        a: "Crypto deposits require blockchain network confirmations before being credited. Once confirmed on-chain, your balance updates immediately.",
        keywords: ["pending", "confirmation", "not credited", "not arrived", "missing"],
      },
    ],
  },
  {
    id: "scalp",
    label: "Scalp Trading",
    items: [
      {
        id: "scalp-how",
        q: "How do scalp trades work?",
        a: "Scalp contracts run on short fixed countdown timers visible in 'Open Positions'.",
        keywords: ["scalp", "contract", "countdown"],
      },
      {
        id: "scalp-timer",
        q: "What happens when the timer reaches 00:00?",
        a: "Upon reaching 00:00, the trade enters a brief 1.5-second 'Settling...' state while the clearing engine finalizes market prices before crediting P/L and moving the record to 'History'.",
        keywords: ["timer", "settling", "00:00", "settle", "expire", "history"],
      },
      {
        id: "scalp-effect",
        q: "Does scalping affect my account?",
        a: "Yes. Active scalp positions contribute directly to your live margin utilization, P/L, Account Health, and count toward settled trade milestones for your Trader Trust Score.",
        keywords: ["affect", "impact", "p/l", "pnl"],
      },
    ],
  },
  {
    id: "margin",
    label: "Margin & Leverage Limits",
    items: [
      {
        id: "leverage",
        q: "What leverage can I use?",
        a: "Standard perpetual and scalp contracts support up to 20x leverage depending on your Trading Tier.",
        keywords: ["leverage", "20x", "multiplier", "perpetual"],
      },
      {
        id: "margin-restricted",
        q: "Why is my margin restricted?",
        a: "If your account is flagged by admin risk management or placed on 'Restrict Margin', max leverage is capped at 1x until verification or risk criteria are cleared.",
        keywords: ["restricted", "restrict", "frozen", "freeze", "blocked", "1x", "margin"],
      },
    ],
  },
  {
    id: "health",
    label: "Account Health & Trust Score",
    items: [
      {
        id: "health-what",
        q: "What is Account Health?",
        a: "Account Health measures your margin risk and liquidation safety. It sits at 100% when you have no open leveraged exposure.",
        keywords: ["account health", "health", "liquidation"],
      },
      {
        id: "trust-increase",
        q: "How do I increase my Trader Trust Score?",
        a: "Complete identity verification (+5%), enable 2FA (+5%), make your first deposit (+5%), and build a profitable trading history. Note: Accounts with balances under $5,000 USDT are capped at 50% max Trust Score.",
        keywords: ["trust score", "trust", "score", "milestone"],
      },
    ],
  },
  {
    id: "verify",
    label: "Verification (KYC/KYB)",
    items: [
      {
        id: "kyc-how",
        q: "How do I verify my account?",
        a: "Go to Profile > Security / Personal Info to submit Level 1 & Level 2 ID documentation.",
        keywords: ["verify", "verification", "kyc", "identity", "id document", "passport"],
      },
      {
        id: "kyb",
        q: "What is institutional KYB?",
        a: "Business entities can submit corporate registration documents via institutional verification for elevated volume limits.",
        keywords: ["kyb", "business", "corporate", "institutional", "company"],
      },
    ],
  },
  {
    id: "security",
    label: "Security & 2FA Reset",
    items: [
      {
        id: "secure",
        q: "How do I secure my account?",
        a: "Go to Profile > Security to enable 2-Factor Authentication (Google Authenticator / Email 2FA).",
        keywords: ["secure", "security", "authenticator", "protect", "password"],
      },
      {
        id: "2fa-reset",
        q: "I lost my 2FA device, how do I reset it?",
        a: "Request a security reset via support. For account protection, withdrawals are temporarily locked for 24 hours following a 2FA reset.",
        keywords: ["2fa", "lost", "reset", "device", "two factor", "two-factor"],
      },
    ],
  },
];

const ALL = BOT_TOPICS.flatMap((t) => t.items);

export function findTopic(id: string) {
  return BOT_TOPICS.find((t) => t.id === id);
}

export function findQA(id: string) {
  return ALL.find((i) => i.id === id);
}

export function wantsAgent(text: string) {
  return /\b(agent|human|person|representative|operator|live support)\b/i.test(text);
}

/** Keyword scoring — longer phrase matches weigh more. */
export function matchQuestion(text: string): BotQA | null {
  const t = text.toLowerCase();
  let best: BotQA | null = null;
  let bestScore = 0;
  for (const item of ALL) {
    let score = 0;
    for (const k of item.keywords) if (t.includes(k)) score += k.length;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}
