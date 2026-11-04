export type Moderation = { content_kind: string; content_id: string; status: string; priority: number };
export function moderateRows<T>(rows: T[], kind: string, decisions: Moderation[], identity: (row: T) => string): T[] {
  const rules = new Map(decisions.filter(d => d.content_kind === kind).map(d => [d.content_id, d]));
  return rows.filter(row => rules.get(identity(row))?.status !== "hidden").sort((a, b) => {
    const score = (row: T) => { const rule = rules.get(identity(row)); return rule?.status === "featured" ? 101 + rule.priority : 0; };
    return score(b) - score(a);
  });
}