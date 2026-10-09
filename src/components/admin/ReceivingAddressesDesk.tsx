import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, QrCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { upsertDepositAddress, deleteDepositAddress } from "@/lib/admin.functions";
import { ADDRESS_ASSETS, ADDRESS_STATUS, ALLOCATION_MODES, memoRequired, validateAddress } from "@/lib/address-validation";
import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";

const inp = "min-h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const STATUS_TONE: Record<string, string> = { active: "text-ops-emerald", paused: "text-warning", deprecated: "text-muted-foreground" };

function copy(text: string, label: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied.`), () => toast.error("Copy failed."));
}

function QrPreview({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { void QRCode.toDataURL(value, { width: 320, margin: 1 }).then(setSrc); }, [value]);
  return src ? <img src={src} alt="Deposit address QR code" className="mx-auto rounded bg-white p-2" width={280} height={280} /> : null;
}

function Validation({ network, address, memo }: { network: string; address: string; memo: string }) {
  if (!address.trim()) return null;
  const err = validateAddress(network, address, memo);
  return <p className={`text-[11px] ${err ? "text-destructive" : "text-ops-emerald"}`}>{err ?? `Valid ${network} address format.`}</p>;
}

function AssetNetwork({ coin, network, onChange }: { coin: string; network: string; onChange: (c: string, n: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <select aria-label="Asset" value={coin} onChange={(e) => onChange(e.target.value, ADDRESS_ASSETS[e.target.value]![0]!)} className={inp}>
        {Object.keys(ADDRESS_ASSETS).map((c) => <option key={c}>{c}</option>)}
      </select>
      <select aria-label="Network" value={network} onChange={(e) => onChange(coin, e.target.value)} className={inp}>
        {(ADDRESS_ASSETS[coin] ?? [network]).map((n) => <option key={n}>{n}</option>)}
      </select>
    </div>
  );
}

export function ReceivingAddressesDesk({ rows, onDone }: { rows: any[]; onDone: () => void }) {
  const save = useServerFn(upsertDepositAddress);
  const empty = { coin: "USDT", network: "TRC20", address: "", memo: "", allocationMode: "master" };
  const [draft, setDraft] = useState(empty);
  const m = useMutation({
    mutationFn: () => save({ data: { ...draft, address: draft.address.trim(), memo: draft.memo.trim() || undefined, status: "active", active: true, allocationMode: draft.allocationMode as any } }),
    onSuccess: () => { toast.success("Receiving address added."); setDraft(empty); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const err = validateAddress(draft.network, draft.address, draft.memo);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="panel p-4">
        <h3 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Receiving addresses ({rows.length})</h3>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No addresses configured.</p> : (
          <ul className="space-y-3">{rows.map((r) => <AddressRow key={r.id} row={r} onDone={onDone} />)}</ul>
        )}
      </section>
      <section className="panel space-y-3 p-4">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Add address</h3>
        <AssetNetwork coin={draft.coin} network={draft.network} onChange={(coin, network) => setDraft({ ...draft, coin, network })} />
        <input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="Wallet address" className={`${inp} font-mono text-xs`} />
        <input value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} placeholder={memoRequired(draft.network) ? "Tag / memo (required)" : "Tag / memo (optional)"} className={inp} />
        <Validation network={draft.network} address={draft.address} memo={draft.memo} />
        <select aria-label="Allocation mode" value={draft.allocationMode} onChange={(e) => setDraft({ ...draft, allocationMode: e.target.value })} className={inp}>
          {ALLOCATION_MODES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <div className="flex justify-end"><Button disabled={m.isPending || !!err} onClick={() => m.mutate()}>Save address</Button></div>
      </section>
    </div>
  );
}

function AddressRow({ row, onDone }: { row: any; onDone: () => void }) {
  const save = useServerFn(upsertDepositAddress);
  const remove = useServerFn(deleteDepositAddress);
  const [f, setF] = useState({ address: row.address as string, memo: (row.memo ?? "") as string, status: (row.status ?? (row.active ? "active" : "paused")) as string, allocationMode: (row.allocation_mode ?? "master") as string });
  const [qr, setQr] = useState(false);
  const [confirm, setConfirm] = useState<null | "save" | "delete">(null);
  const dirty = f.address !== row.address || f.memo !== (row.memo ?? "") || f.status !== (row.status ?? "active") || f.allocationMode !== (row.allocation_mode ?? "master");
  const err = validateAddress(row.network, f.address, f.memo);
  const m = useMutation({
    mutationFn: async (reason: string) => confirm === "delete"
      ? remove({ data: { id: row.id, reason } })
      : save({ data: { id: row.id, coin: row.coin, network: row.network, address: f.address.trim(), memo: f.memo.trim() || undefined, status: f.status as any, allocationMode: f.allocationMode as any, active: f.status === "active", reason } }),
    onSuccess: () => { toast.success(confirm === "delete" ? "Address deleted." : "Address updated."); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <li className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{row.coin} - {row.network}</span>
        <span className={`text-[11px] font-bold uppercase ${STATUS_TONE[f.status] ?? ""}`}>{ADDRESS_STATUS.find((s) => s.id === f.status)?.label}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setQr(true)}><QrCode />QR</Button>
          <Button size="sm" variant="outline" onClick={() => copy(row.address, "Address")}><Copy />Copy Address</Button>
          {row.memo && <Button size="sm" variant="outline" onClick={() => copy(row.memo, "Tag")}><Copy />Copy Tag</Button>}
        </div>
      </div>
      <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={`${inp} font-mono text-xs`} />
      <input value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} placeholder={memoRequired(row.network) ? "Tag / memo (required)" : "Tag / memo (optional)"} className={inp} />
      <Validation network={row.network} address={f.address} memo={f.memo} />
      <div className="grid gap-2 sm:grid-cols-2">
        <select aria-label="Address status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inp}>
          {ADDRESS_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select aria-label="Allocation mode" value={f.allocationMode} onChange={(e) => setF({ ...f, allocationMode: e.target.value })} className={inp}>
          {ALLOCATION_MODES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="destructive" onClick={() => setConfirm("delete")}><Trash2 />Delete</Button>
        <Button size="sm" disabled={!dirty || !!err} onClick={() => setConfirm("save")}>Save Changes</Button>
      </div>
      <Dialog open={qr} onOpenChange={setQr}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{row.coin} - {row.network}</DialogTitle>
          <DialogDescription className="break-all font-mono text-xs">{row.address}{row.memo ? ` - Tag ${row.memo}` : ""}</DialogDescription>
          <QrPreview value={row.address} />
        </DialogContent>
      </Dialog>
      <AdminActionConfirm open={!!confirm} title={confirm === "delete" ? "Delete Address" : "Save Address Changes"} description={confirm === "delete" ? "This receiving address will be removed permanently." : "The edited address details and status will take effect immediately for customers."} destructive={confirm === "delete" || f.status !== "active"} pending={m.isPending} onClose={() => setConfirm(null)} onConfirm={async (reason) => { await m.mutateAsync(reason); }} />
    </li>
  );
}
