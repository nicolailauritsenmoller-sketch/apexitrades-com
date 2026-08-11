/** Client-safe VIP specialist metadata shared by the user and admin surfaces. */

export const VIP_ROLES = [
  { key: "financial_advisor", label: "Financial Advisor" },
  { key: "treasury_ops", label: "Treasury Operations Analyst" },
  { key: "fraud_risk", label: "Fraud Risk Analyst" },
  { key: "billing_settlements", label: "Billing and Settlements Specialist" },
  { key: "tax_compliance", label: "Tax and Compliance Advisor" },
  { key: "crypto_derivatives", label: "Crypto Derivatives Strategist" },
  { key: "security_architecture", label: "Security Architecture Consultant" },
  { key: "kyc_aml", label: "KYC/AML Verification Officer" },
] as const;

export type VipRoleKey = (typeof VIP_ROLES)[number]["key"];

export const VIP_ROLE_KEYS = VIP_ROLES.map((r) => r.key) as unknown as [string, ...string[]];

export type VipSpecialist = {
  roleKey: string;
  roleLabel: string;
  fullName: string;
  title: string;
  staffId: string;
  avatarUrl: string | null;
  unlocked: boolean;
  requested: boolean;
  unread: number;
  lastMessageAt: string | null;
};

export type VipMessage = {
  id: string;
  body: string;
  senderRole: string;
  createdAt: string;
  readAt: string | null;
};

export const SECURITY_CATEGORIES = [
  { id: "account_takeover", label: "Account takeover / suspicious login" },
  { id: "phishing", label: "Phishing or impersonation" },
  { id: "vulnerability", label: "Platform vulnerability" },
  { id: "payment_fraud", label: "Payment or withdrawal fraud" },
  { id: "data_privacy", label: "Data privacy concern" },
  { id: "other", label: "Other" },
] as const;

export const SECURITY_SEVERITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
] as const;

export const SECURITY_STATUSES = ["open", "investigating", "resolved", "dismissed"] as const;
