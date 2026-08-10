import { useState } from "react";
import { toast } from "sonner";
import { Copy, LifeBuoy, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AssetIcon } from "@/lib/asset-icons";
import { TicketDialog } from "@/components/support/TicketDialog";
import {
  STATUS_STYLE,
  assetName,
  estimateEta,
  shortenAddress,
  statusMessage,
  type TransactionRecord,
} from "@/lib/transactions";

function copy(value: string, label: string) {
  navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

function DetailRow({
  label,
  value,
  copyValue,
  mono,
}: {
  label: string;
  value: string;
  copyValue?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right text-sm">
        <span className={`truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
        {copyValue && (
          <button
            type="button"
            onClick={() => copy(copyValue, label)}
            aria-label={`Copy ${label}`}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}

/** Bank-grade status screen for a deposit or withdrawal request. */
export function TransactionStatusDialog({
  tx,
  open,
  onOpenChange,
}: {
  tx: TransactionRecord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [ticketOpen, setTicketOpen] = useState(false);
  if (!tx) return null;

  const style = STATUS_STYLE[tx.status];
  const StatusIcon =
    tx.status === "successful" ? CheckCircle2 : tx.status === "failed" ? XCircle : Loader2;
  const eta = estimateEta(tx.type, tx.asset, tx.network);
  const isTransfer = tx.type !== "swap";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <div className={`grid size-14 place-items-center rounded-full border ${style.badge}`}>
              <StatusIcon
                className={`size-7 ${tx.status === "pending" ? "animate-spin" : ""}`}
              />
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${style.badge}`}
            >
              {style.label}
            </span>
            <h2 className="font-display text-lg font-bold tracking-tight">
              {tx.type === "withdrawal"
                ? "Withdrawal request"
                : tx.type === "deposit"
                  ? "Deposit request"
                  : "Asset swap"}
            </h2>
            <div className="flex items-center gap-2">
              <AssetIcon currency={tx.asset} size={24} />
              <span className="num text-2xl font-bold">
                {tx.amount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8,
                })}{" "}
                {tx.asset}
              </span>
            </div>
            <p className="px-2 text-xs text-muted-foreground">
              {statusMessage(tx.type, tx.status)}
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-border bg-secondary/30 px-3">
            <DetailRow label="Transaction ID" value={shortenAddress(tx.id, 8, 6)} copyValue={tx.id} mono />
            {tx.txHash && (
              <DetailRow
                label="Transaction hash"
                value={shortenAddress(tx.txHash, 8, 6)}
                copyValue={tx.txHash}
                mono
              />
            )}
            <DetailRow label="Asset" value={`${assetName(tx.asset)} (${tx.asset})`} />
            {tx.network && <DetailRow label="Network" value={tx.network} />}
            {tx.address && (
              <DetailRow
                label={tx.type === "withdrawal" ? "Sending to" : "Deposit address"}
                value={shortenAddress(tx.address, 8, 6)}
                copyValue={tx.address}
                mono
              />
            )}
            {isTransfer && (
              <DetailRow label="Estimated arrival" value={eta} />
            )}
            <DetailRow label="Submitted" value={new Date(tx.createdAt).toLocaleString()} />
            {tx.note && <DetailRow label="Note from desk" value={tx.note} />}
          </div>

          {isTransfer && tx.status !== "failed" && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Funds typically arrive within <strong className="text-foreground">{eta}</strong>.
                Network congestion can extend this window.
              </span>
            </div>
          )}

          <button
            onClick={() => setTicketOpen(true)}
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 p-3 text-left transition-colors hover:bg-primary/15"
          >
            <span className="flex items-center gap-2 text-sm">
              <LifeBuoy className="size-4 shrink-0 text-primary" />
              Haven&apos;t received your funds?
            </span>
            <span className="shrink-0 text-xs font-semibold text-primary">
              Contact Customer Support
            </span>
          </button>

          <button
            onClick={() => onOpenChange(false)}
            className="mt-2 w-full rounded-md bg-secondary py-2.5 text-sm font-semibold hover:bg-secondary/70"
          >
            Done
          </button>
        </DialogContent>
      </Dialog>

      <TicketDialog open={ticketOpen} onOpenChange={setTicketOpen} />
    </>
  );
}
