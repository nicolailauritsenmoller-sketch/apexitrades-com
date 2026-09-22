/**
 * Execution telemetry: every order write records submission, acknowledgement
 * and fill timestamps so latency and fill rate can be measured from real
 * account activity instead of estimated.
 */

export type ExecutionRecord = {
  userId: string;
  refType: "contract" | "position_open" | "position_close";
  refId: string | null;
  symbol: string;
  side?: string | null;
  requestedQty: number;
  filledQty: number;
  submittedAt: number;
  acknowledgedAt: number;
  filledAt: number;
  status?: "filled" | "partial" | "rejected";
};

/** Best-effort write: telemetry must never break an order. */
export async function recordExecution(db: any, rec: ExecutionRecord) {
  try {
    await db.from("trade_executions").insert({
      user_id: rec.userId,
      ref_type: rec.refType,
      ref_id: rec.refId,
      symbol: rec.symbol,
      side: rec.side ?? null,
      requested_qty: rec.requestedQty,
      filled_qty: rec.filledQty,
      submitted_at: new Date(rec.submittedAt).toISOString(),
      acknowledged_at: new Date(rec.acknowledgedAt).toISOString(),
      filled_at: new Date(rec.filledAt).toISOString(),
      ack_latency_ms: Math.max(0, Math.round(rec.acknowledgedAt - rec.submittedAt)),
      fill_latency_ms: Math.max(0, Math.round(rec.filledAt - rec.submittedAt)),
      status:
        rec.status ??
        (rec.requestedQty > 0 && rec.filledQty + 1e-9 < rec.requestedQty ? "partial" : "filled"),
    });
  } catch {
    /* telemetry only */
  }
}

export type ExecutionSync = {
  samples: number;
  medianFillMs: number;
  p95FillMs: number;
  fillRatePct: number;
  /** 0-100 quality score: fast, fully filled executions score high. */
  scorePct: number;
};

type ExecRow = {
  fill_latency_ms: number | null;
  requested_qty: number | string;
  filled_qty: number | string;
  status: string;
};

/** Derive execution-sync quality from measured order records. */
export function summarizeExecutions(rows: ExecRow[]): ExecutionSync | null {
  const latencies = rows
    .map((r) => r.fill_latency_ms)
    .filter((v): v is number => typeof v === "number" && v >= 0)
    .sort((a, b) => a - b);
  if (latencies.length === 0) return null;

  const pick = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))]!;
  const medianFillMs = pick(0.5);
  const p95FillMs = pick(0.95);

  const requested = rows.reduce((s, r) => s + Number(r.requested_qty), 0);
  const filled = rows.reduce((s, r) => s + Number(r.filled_qty), 0);
  const fillRatePct =
    requested > 0 ? Math.max(0, Math.min(100, (filled / requested) * 100)) : 100;

  // Latency score: <=250ms is ideal, >=3000ms scores zero.
  const latencyScore = Math.max(0, Math.min(100, ((3000 - medianFillMs) / (3000 - 250)) * 100));
  const scorePct = Math.round((latencyScore * 0.6 + fillRatePct * 0.4) * 10) / 10;

  return { samples: latencies.length, medianFillMs, p95FillMs, fillRatePct, scorePct };
}
