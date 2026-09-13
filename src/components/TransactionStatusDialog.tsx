import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  ExternalLink,
  LifeBuoy,
  Clock,
  X,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AssetIcon } from "@/lib/asset-icons";
import { TicketDialog } from "@/components/support/TicketDialog";
import { institutionalizeCopy } from "@/lib/institutional-copy";
import {
  assetName,
  confirmationsFor,
  estimateEta,
  explorerName,
  explorerUrl,
  failureReason,
  networkFeeUsd,
  requiredConfirmations,
  shortenAddress,
  statusMessage,
  type TransactionRecord,
} from "@/lib/transactions";

function copy(value: string, label: string) {
  navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

const usd = (n: number, digits = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const FIAT = new Set([
  "USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "AED", "NGN", "KES",
  "ZAR", "INR", "BRL", "TRY", "CNY", "HKD", "SGD", "SEK", "NOK", "DKK",
]);

/** Fiat → 2 decimals, crypto → up to 6 significant decimals. */
const fmtAsset = (n: number, asset: string) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: FIAT.has(asset.toUpperCase()) ? 2 : 0,
    maximumFractionDigits: FIAT.has(asset.toUpperCase()) ? 2 : 6,
  });

/** Exchange-style "Sep 13, 2026 • 06:13 PM". */
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} • ${time}`;
};

function Row({
  label,
  value,
  copyValue,
  wrap,
  icon,
  href,
}: {
  label: string;
  value: string;
  copyValue?: string;
  wrap?: boolean;
  icon?: React.ReactNode;
  /** External reference link (e.g. block explorer) rendered as an icon button. */
  href?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <span className="shrink-0 text-[15px] font-medium text-foreground">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-1.5 text-right">
        {icon}
        <span
          className={`text-[15px] text-muted-foreground ${wrap ? "break-all" : "truncate"}`}
        >
          {value}
        </span>
        {copyValue && (
          <button
            type="button"
            onClick={() => copy(copyValue, label)}
            aria-label={`Copy ${label}`}
            className="shrink-0 touch-manipulation rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </button>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`View ${label} on explorer`}
            className="shrink-0 touch-manipulation rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </span>
    </div>
  );
}

/** Coinbase-style transaction detail screen for deposits, withdrawals and swaps. */
export function TransactionStatusDialog({
  tx,
  open,
  onOpenChange,
  priceUsd,
}: {
  tx: TransactionRecord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Live USD rate for the asset, used for the fiat amount and price row. */
  priceUsd?: number;
}) {
  const [ticketOpen, setTicketOpen] = useState(false);
  const [showReason, setShowReason] = useState(false);
  const navigate = useNavigate();
  if (!tx) return null;

  const isOut = tx.type === "withdrawal";
  const eta = estimateEta(tx.type, tx.asset, tx.network);
  const isTransfer = tx.type !== "swap";
  const fee = networkFeeUsd(tx.network);
  const required = requiredConfirmations(tx.network);
  const confirmations = confirmationsFor(tx.status, tx.network, tx.createdAt);
  const explorer = explorerUrl(tx.network, tx.txHash);

  const isSwap = tx.type === "swap";
  const swap = tx.swap;
  const title =
    tx.type === "withdrawal"
      ? "Withdrawal details"
      : tx.type === "deposit"
        ? "Deposit details"
        : "Swap successful";

  const statusLabel =
    tx.status === "successful" ? "Completed" : tx.status === "failed" ? "Failed" : "Pending";

  const ring =
    tx.status === "successful"
      ? "border-bull text-bull"
      : tx.status === "failed"
        ? "border-bear text-bear"
        : "border-warning text-warning";

  const statusText =
    tx.status === "successful"
      ? "text-bull"
      : tx.status === "failed"
        ? "text-bear"
        : "text-warning";

  const StatusArrow =
    tx.status === "failed" ? X : tx.status === "pending" ? RefreshCw : isOut ? ArrowUpRight : ArrowDownLeft;

  const sign = isOut ? "-" : "+";
  const amountText = `${sign}${tx.amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })} ${tx.asset}`;
  const fiatText = priceUsd ? `${sign}${usd(tx.amount * priceUsd)}` : assetName(tx.asset);
  // Swap header: received amount prominent, USD equivalent underneath (no + prefix).
  const swapHeroText = swap ? `+${fmtAsset(swap.toAmount, swap.toAsset)} ${swap.toAsset}` : "";
  const swapUsdText = priceUsd ? `≈ ${usd(swap ? swap.toAmount * priceUsd : 0)} USD` : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[92vh] touch-manipulation overflow-y-auto p-0 sm:max-w-md [&>button]:hidden"
        >
          {/* Header */}
          <div className="relative flex items-center justify-center border-b border-border px-4 py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Back"
              className="absolute left-3 touch-manipulation rounded-full p-2 text-foreground hover:bg-secondary"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          </div>

          {/* Amount */}
          <div className="border-b border-border px-4 py-7 text-center">
            {isSwap && swap ? (
              <>
                <p className="num text-[34px] font-bold leading-tight tracking-tight text-bull">
                  {swapHeroText}
                </p>
                {swapUsdText && (
                  <p className="num mt-1 text-[15px] text-muted-foreground">{swapUsdText}</p>
                )}
              </>
            ) : tx.type === "deposit" ? (
              <>
                <p className={`num text-[34px] font-bold leading-tight tracking-tight ${tx.status === "failed" ? "text-bear" : "text-bull"}`}>
                  +{fmtAsset(tx.amount, tx.asset)} {tx.asset}
                </p>
                {priceUsd ? (
                  <p className="num mt-1 text-[15px] text-muted-foreground">
                    ≈ {usd(tx.amount * priceUsd)} USD
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className={`num text-[34px] font-bold leading-tight tracking-tight ${tx.status === "failed" ? "text-bear" : ""}`}>
                  -{fmtAsset(tx.amount, tx.asset)} {tx.asset}
                </p>
                {priceUsd ? (
                  <p className="num mt-1 text-[15px] text-muted-foreground">
                    ≈ {usd(tx.amount * priceUsd)} USD
                  </p>
                ) : (
                  <p className="num mt-1 text-[15px] text-muted-foreground">{assetName(tx.asset)}</p>
                )}
              </>
            )}
          </div>

          {/* Swap receipt */}
          {isSwap && swap && (
            <div className="divide-y divide-border/50 border-b border-border px-4">
              <Row
                label="You sold"
                value={`${fmtAsset(swap.fromAmount, swap.fromAsset)} ${swap.fromAsset}`}
                icon={<AssetIcon currency={swap.fromAsset} size={20} />}
              />
              <Row
                label="You received"
                value={`${fmtAsset(swap.toAmount, swap.toAsset)} ${swap.toAsset}`}
                icon={<AssetIcon currency={swap.toAsset} size={20} />}
              />
              <Row
                label="Exchange rate"
                value={`1 ${swap.fromAsset} = ${swap.rate.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${swap.toAsset}`}
              />
              <Row label="Transaction ID" value={shortenAddress(tx.id, 6, 6)} copyValue={tx.id} />
              <Row label="Date & time" value={fmtDateTime(tx.createdAt)} />
            </div>
          )}


          {/* Details */}
          {!isSwap && (
          <div className="divide-y divide-border/50 border-b border-border px-4">
            <Row
              label="Asset"
              value={`${assetName(tx.asset)} (${tx.asset})`}
              icon={<AssetIcon currency={tx.asset} size={20} />}
            />
            {tx.network && (
              <Row
                label="Network"
                value={tx.network}
                icon={<AssetIcon currency={tx.asset} size={20} />}
              />
            )}
            {tx.address && (
              <Row
                label={isOut ? "To" : "Deposit address"}
                value={shortenAddress(tx.address, 6, 4)}
                copyValue={tx.address}
              />
            )}
            {isOut && priceUsd ? (
              <Row label="Price" value={usd(priceUsd, priceUsd < 1 ? 6 : 2)} />
            ) : null}
            {isOut && <Row label="Network fee" value={usd(fee, fee < 0.01 ? 4 : 2)} />}
            {isTransfer && (
              <Row
                label="Confirmations"
                value={`${tx.status === "successful" ? required : confirmations} / ${required}`}
              />
            )}
            {isTransfer && tx.status === "pending" && (
              <Row label="Estimated arrival" value={eta} />
            )}
            {tx.txHash && (
              <Row
                label="Transaction hash"
                value={shortenAddress(tx.txHash, 6, 6)}
                copyValue={tx.txHash}
                href={explorer ?? undefined}
              />
            )}
            <Row label="Transaction ID" value={shortenAddress(tx.id, 6, 6)} copyValue={tx.id} />
            <Row label="Date & time" value={fmtDateTime(tx.createdAt)} />
            {tx.resolvedAt && tx.status !== "pending" && (
              <Row
                label={
                  tx.status === "failed"
                    ? tx.type === "withdrawal"
                      ? "Refunded"
                      : "Declined"
                    : tx.type === "deposit"
                      ? "Block confirmed"
                      : "Completed at"
                }
                value={fmtDateTime(tx.resolvedAt)}
              />
            )}
            {tx.note && <Row label="Compliance note" value={institutionalizeCopy(tx.note)} wrap />}
          </div>
          )}

          {/* Status */}
          {!isSwap && (
          <div className="flex items-center gap-4 border-b border-border px-4 py-5">
            <div className="relative shrink-0">
              <div
                className={`grid size-12 place-items-center rounded-full border-2 ${ring}`}
              >
                <StatusArrow
                  className={`size-5 ${tx.status === "pending" ? "animate-spin" : ""}`}
                />
              </div>
              <span className="absolute -bottom-1 -right-1">
                <AssetIcon currency={tx.asset} size={20} />
              </span>
            </div>
            <span className="text-[17px] font-semibold">Status</span>
            <span className={`ml-auto text-[17px] font-semibold ${statusText}`}>{statusLabel}</span>
          </div>
          )}

          <div className="space-y-3 px-4 pb-5 pt-4">
            {!isSwap && (
              <p className="text-xs text-muted-foreground">{statusMessage(tx.type, tx.status)}</p>
            )}

            {isTransfer && tx.status === "pending" && (
              <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  Funds typically arrive within{" "}
                  <strong className="text-foreground">{eta}</strong> —{" "}
                  <strong className="text-foreground">
                    {confirmations} of {required}
                  </strong>{" "}
                  confirmations received.
                </span>
              </div>
            )}

            {tx.status === "failed" && (
              <div className="rounded-xl border border-bear/40 bg-bear/10 p-3 text-xs">
                <button
                  type="button"
                  onClick={() => setShowReason((v) => !v)}
                  className="flex w-full touch-manipulation items-center gap-2 text-left font-semibold text-bear"
                >
                  <AlertTriangle className="size-4 shrink-0" />
                  {showReason ? "Hide failure reason" : "View failure reason"}
                </button>
                {showReason && (
                   <p className="mt-2 text-muted-foreground">
                     {institutionalizeCopy(failureReason(tx.type, tx.note))}
                   </p>
                )}
              </div>
            )}

            {explorer && (
              <a
                href={explorer}
                 target="_blank"
                 rel="noreferrer noopener"
                 className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-full border border-border py-3.5 text-[15px] font-bold text-foreground transition-colors hover:bg-secondary/60"
              >
                View on Explorer
                <ExternalLink className="size-4" />
              </a>
            )}
            {!explorer && isTransfer && (
              <p className="text-center text-xs text-muted-foreground">
                A {explorerName(tx.network)} link appears here once the transaction hash is
                published.
              </p>
            )}

            {isSwap ? (
              <>
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-full touch-manipulation rounded-full bg-primary py-3.5 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Back to Assets
                </button>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    void navigate({ to: "/wallet", search: { tab: "swap" } });
                  }}
                  className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-full border border-border py-3.5 text-[15px] font-bold text-foreground transition-colors hover:bg-secondary/60"
                >
                  Make Another Swap
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-full touch-manipulation rounded-full bg-primary py-3.5 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Back to Assets
                </button>
                {tx.status !== "successful" && (
                  <button
                    onClick={() => setTicketOpen(true)}
                    className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <LifeBuoy className="size-4" />
                    Contact Institutional Support
                  </button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TicketDialog open={ticketOpen} onOpenChange={setTicketOpen} />
    </>
  );
}
