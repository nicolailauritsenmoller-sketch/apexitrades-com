import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDepositAddresses } from "@/lib/wallet.functions";
import { AssetIcon } from "@/lib/asset-icons";
import { Button } from "@/components/ui/button";
import { depositOptions, QUICK_DEPOSIT_ASSETS, type QuickDepositAsset } from "@/lib/quick-deposit";

export function QuickDepositDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const fetchAddresses = useServerFn(getDepositAddresses);
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["deposit-addresses"],
    queryFn: () => fetchAddresses(),
    enabled: open,
  });
  const [asset, setAsset] = useState<QuickDepositAsset>("USDT");
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  const options = useMemo(() => depositOptions(addresses, asset), [addresses, asset]);
  const addr = options.find((a) => a.id === networkId) ?? options[0];

  useEffect(() => { setNetworkId(null); setCopied(false); }, [asset]);
  useEffect(() => {
    setQr("");
    if (!addr?.address) return;
    let live = true;
    void QRCode.toDataURL(addr.address, { width: 200, margin: 2, color: { dark: "#111827", light: "#FFFFFF" } }).then(
      (u) => live && setQr(u),
    );
    return () => {
      live = false;
    };
  }, [addr?.address]);

  const copy = async () => {
    if (!addr) return;
    await navigator.clipboard.writeText(addr.address);
    setCopied(true);
    toast.success("Deposit address copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Funds</DialogTitle>
          <DialogDescription>Select an asset to view your deposit instructions.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2">
          {QUICK_DEPOSIT_ASSETS.map((a) => (
            <Button
              key={a}
              variant="outline"
              type="button"
              aria-pressed={asset === a}
              onClick={() => setAsset(a)}
              className={`flex h-auto min-h-20 touch-manipulation flex-col items-center justify-center gap-1.5 rounded-lg border px-1 py-2 text-xs font-semibold transition-colors ${
                asset === a ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-raised"
              }`}
            >
              <span className={a === "USDC" ? "grid size-9 place-items-center rounded-full bg-bull/15 ring-1 ring-bull/60" : "grid size-9 place-items-center"}>
                <AssetIcon currency={a} size={24} />
              </span>
              <span className="leading-none">{a}</span>
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="h-56 animate-pulse rounded-xl bg-surface" />
        ) : !addr ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            {asset} deposits are not currently available.
          </p>
        ) : (
          <div className="space-y-3">
            {options.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Deposit network</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Deposit network">
                {options.map((o) => (
                  <Button
                    key={o.id}
                    variant="outline"
                    size="sm"
                    type="button"
                    aria-pressed={o.id === addr.id}
                    onClick={() => setNetworkId(o.id)}
                    className={`min-h-10 px-3 text-xs font-medium ${
                      o.id === addr.id ? "border-primary text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {o.network}
                  </Button>
                ))}
                </div>
              </div>
            )}
            <div className="flex justify-center">
              {qr ? (
                <img src={qr} alt={`${asset} deposit address QR code`} className="size-44 rounded-lg" />
              ) : (
                <div className="size-44 animate-pulse rounded-lg bg-surface" />
              )}
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-[11px] text-muted-foreground">
                {asset} address · {addr.network}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-xs">{addr.address}</code>
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={copy}
                  aria-label="Copy address"
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-border"
                >
                  {copied ? <Check className="size-4 text-bull" /> : <Copy className="size-4" />}
                </Button>
              </div>
              {addr.memo && <p className="mt-2 text-xs">Memo: {addr.memo}</p>}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Send only {asset} on the {addr.network} network. After sending, submit the transaction hash for
              crediting.
            </p>
            <Link
              to="/wallet"
              search={{ tab: "deposit" }}
              onClick={() => onOpenChange(false)}
              className="block w-full rounded-lg border border-border py-2.5 text-center text-sm font-semibold"
            >
              Submit Deposit Confirmation
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
