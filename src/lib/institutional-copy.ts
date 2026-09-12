const REPLACEMENTS: Array<[RegExp, string]> = [
  [/pending admin approval/gi, "under security review"],
  [/manual admin approval/gi, "manual compliance review"],
  [/approved by (?:an )?admin(?:istrator)?/gi, "verification complete"],
  [/rejected by (?:an )?admin(?:istrator)?/gi, "system compliance check failed"],
  [/contact (?:the )?admin(?:istrator)?/gi, "contact Institutional Support"],
  [/admin team/gi, "Security Operations"],
  [/admin agent/gi, "support specialist"],
  [/admin panel/gi, "Control Center"],
  [/\ban administrator\b/gi, "Account Operations"],
  [/\badministrator\b/gi, "Account Operations"],
  [/\badmin\b/gi, "Control Center"],
];

/** Sanitizes legacy stored communications without altering internal role or schema values. */
export function institutionalizeCopy(value: string | null | undefined): string {
  if (!value) return "";
  return REPLACEMENTS.reduce((copy, [pattern, replacement]) => copy.replace(pattern, replacement), value);
}