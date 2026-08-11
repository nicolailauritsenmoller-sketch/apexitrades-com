export const AGENT_ROLES = [
  "Compliance/KYC Officer",
  "Risk Manager",
  "Support Agent",
  "IT/DevOps Support",
  "Finance/Billing Agent",
  "Account Manager",
  "Auditor",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export type AgentProfile = {
  user_id: string;
  full_name: string;
  agent_role: string;
  staff_id: string;
  avatar_url: string | null;
};
