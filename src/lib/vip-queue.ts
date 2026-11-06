export const VIP_DEPARTMENTS = [
  { key: "billing_settlements", label: "Billing and Settlements" },
  { key: "crypto_derivatives", label: "Crypto Derivatives Strategy" },
  { key: "financial_advisor", label: "Financial Advisory" },
  { key: "fraud_risk", label: "Fraud Risk" },
  { key: "kyc_aml", label: "KYC/AML Verification" },
  { key: "security_architecture", label: "Security Architecture" },
  { key: "tax_compliance", label: "Tax and Compliance" },
  { key: "treasury_ops", label: "Treasury Operations" },
] as const;

export function vipConnection(grant: any, agent: any, now = Date.now()) {
  const connected = !!(grant?.unlocked && grant.assigned_to && grant.accepted_at && grant.agent_joined_at && grant.thread_status !== "resolved");
  const active = connected && Number.isFinite(Date.parse(grant.agent_last_seen_at)) && now - Date.parse(grant.agent_last_seen_at) < 60000;
  return {
    connected,
    active,
    agent: connected ? { fullName: agent?.full_name ?? "Support specialist", avatarUrl: agent?.avatar_url ?? null, staffId: agent?.staff_id ?? null } : null,
  };
}