import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { Check, Copy, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDepositAddresses } from "@/lib/wallet.functions";
import { AssetIcon } from "@/lib/asset-icons";

const ASSETS = [
  { key: "USDT", label: "USDT", icon: "USDTUSD" },
  { key: "BTC", label: "BTC", icon: "BTCUSDT" },
  { key: "ETH", label: "ETH", icon: "ETHUSDT" },
  { key: "WIRE", label: "USD Wire", icon: null },
] as const;

export function QuickDepositDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const fetchAddresses = useServerFn(getDepositAddresses);
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["deposit-addresses"],
    queryFn: () => fetchAddresses(),
    enabled: open,
  });
  const [asset, setAsset] = useState<(typeof ASSETS)[number]["key"]>("USDT");
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  const options = useMemo(() => addresses.filter((a) => a.coin.toUpperCase() === asset), [addresses, asset]);
  const addr = options.find((a) => a.id === networkId) ?? options[0];

  useEffect(() => setNetworkId(null), [asset]);
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
          {ASSETS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAsset(a.key)}
              className={`flex min-h-16 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-colors ${
                asset === a.key ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-raised"
              }`}
            >
              {a.icon ? <AssetIcon symbol={a.icon} size={22} /> : <Landmark className="size-5" />}
              {a.label}
            </button>
          ))}
        </div>

        {asset === "WIRE" ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <p className="font-semibold">USD bank wire</p>
            <p className="mt-1 text-muted-foreground">
              Wire instructions are issued individually by our funding desk after verification. Contact support to
              receive your beneficiary details.
            </p>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                window.dispatchEvent(new CustomEvent("velocity:open-chat"));
              }}
              className="mt-3 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Request Wire Instructions
            </button>
          </div>
        ) : isLoading ? (
          <div className="h-56 animate-pulse rounded-xl bg-surface" />
        ) : !addr ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            {asset} deposits are not currently available.
          </p>
        ) : (
          <div className="space-y-3">
            {options.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setNetworkId(o.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      o.id === addr.id ? "border-primary text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {o.network}
                  </button>
                ))}
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
                <button
                  type="button"
                  onClick={copy}
                  aria-label="Copy address"
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-border"
                >
                  {copied ? <Check className="size-4 text-bull" /> : <Copy className="size-4" />}
                </button>
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
