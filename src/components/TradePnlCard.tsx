import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ClipboardCopy, Download, X } from "lucide-react";
import { toBlob, toPng } from "html-to-image";
import type { TradeSummary } from "@/lib/trade-summary";
import { formatMoney, formatPrice } from "@/lib/instruments";
import logoUrl from "@/assets/velocity-trade-logo.png";

/** Reads a labelled value out of the generated summary sections. */
function row(summary: TradeSummary, section: string, key: string) {
  const found = summary.sections.find((s) => s.title === section)?.rows.find(([k]) => k === key);
  return found?.[1];
}

function fileName(summary: TradeSummary) {
  const pair = summary.pair.replace(/[^A-Za-z0-9]/g, "");
  return `VelocityTrade_${pair}_Settlement.png`;
}

/**
 * Shareable settlement card. Styling is intentionally self-contained (literal
 * colours, no theme tokens) so the exported PNG renders identically regardless
 * of the active light/dark theme.
 */
export function TradePnlCard({ summary, onClose }: { summary: TradeSummary; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"png" | "clip" | null>(null);

  const positive = summary.netPnl >= 0;
  const accent = positive ? "#16C784" : "#EA3943";
  const roi = row(summary, "Profit & loss", "ROI %") ?? `${summary.profitPct.toFixed(2)}%`;
  const leverage = row(summary, "Instrument", "Leverage used") ?? "1x";
  const durationLabel = row(summary, "Exit", "Trade duration") ?? "—";

  const render = useCallback(async () => {
    const node = cardRef.current;
    if (!node) throw new Error("Card not ready");
    return { node, options: { pixelRatio: 3, cacheBust: true, backgroundColor: "#0A0D12" } };
  }, []);

  const handleDownload = async () => {
    setBusy("png");
    try {
      const { node, options } = await render();
      const dataUrl = await toPng(node, options);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName(summary);
      a.click();
      toast.success("Settlement card downloaded");
    } catch {
      toast.error("Could not generate the image");
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    setBusy("clip");
    try {
      const { node, options } = await render();
      const blob = await toBlob(node, options);
      if (!blob) throw new Error("empty");
      const Item = window.ClipboardItem;
      if (!Item || !navigator.clipboard?.write) throw new Error("unsupported");
      await navigator.clipboard.write([new Item({ "image/png": blob })]);
      toast.success("Image copied to clipboard");
    } catch {
      toast.error("Clipboard image copy unavailable — use download instead");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share trade settlement card"
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-foreground/50 p-4 backdrop-blur-sm"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white drop-shadow">Trade settled</h2>
          <button
            onClick={onClose}
            aria-label="Close share card"
            className="rounded-full bg-black/40 p-1.5 text-white transition-colors hover:bg-black/60"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Captured element */}
        <div
          ref={cardRef}
          style={{
            background: "linear-gradient(160deg,#0A0D12 0%,#111826 55%,#0A0D12 100%)",
            color: "#F5F7FA",
            border: "1px solid #1E2A3A",
            borderRadius: 20,
            padding: 24,
            fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={logoUrl} alt="" width={30} height={30} style={{ borderRadius: 8 }} />
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em" }}>
                VELOCITY TRADE
              </span>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: accent,
                border: `1px solid ${accent}55`,
                borderRadius: 999,
                padding: "4px 10px",
              }}
            >
              {positive ? "Profit" : "Loss"}
            </span>
          </div>

          <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{summary.pair}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                borderRadius: 6,
                padding: "3px 8px",
                color: accent,
                background: `${accent}22`,
              }}
            >
              {summary.side}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                padding: "3px 8px",
                color: "#9AA7B8",
                background: "#151E2C",
              }}
            >
              {leverage}
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: accent, lineHeight: 1.1 }}>
              {roi.startsWith("+") || roi.startsWith("-") ? roi : `${positive ? "+" : ""}${roi}`}
            </div>
            <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: accent }}>
              {positive ? "+" : "-"}
              {formatMoney(Math.abs(summary.netPnl), summary.currency)}
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              borderTop: "1px solid #1E2A3A",
              paddingTop: 16,
            }}
          >
            <Field label="Entry price" value={formatPrice(summary.entryPrice, summary.symbol)} />
            <Field label="Exit price" value={formatPrice(summary.exitPrice, summary.symbol)} />
            <Field label="Duration" value={durationLabel} />
            <Field label="Settled" value={new Date(summary.closedAt).toLocaleString("en-US", { hour12: false })} />
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 10,
              letterSpacing: "0.08em",
              color: "#6C7A8C",
              textTransform: "uppercase",
            }}
          >
            <span>ID {summary.tradeId.slice(0, 10)}</span>
            <span>velocitytrade.com</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleDownload}
            disabled={busy !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Download className="size-4" />
            {busy === "png" ? "Rendering…" : "Take screenshot"}
          </button>
          <button
            onClick={handleCopy}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black/50 disabled:opacity-60"
          >
            <ClipboardCopy className="size-4" />
            {busy === "clip" ? "Copying…" : "Copy image"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6C7A8C" }}>
        {label}
      </div>
      <div style={{ marginTop: 3, fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

/** Small camera trigger used in settlement history rows. */
export function ShareCardButton({ summary }: { summary: TradeSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label="Share settlement card"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Camera className="size-4" />
      </span>
      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <TradePnlCard summary={summary} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
