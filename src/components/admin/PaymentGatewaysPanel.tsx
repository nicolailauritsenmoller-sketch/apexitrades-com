import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Banknote, Plus, QrCode, Trash2 } from "lucide-react";
import {
  deleteDepositAddress,
  getPlatformSettings,
  savePlatformSetting,
  upsertDepositAddress,
} from "@/lib/admin.functions";

const NETWORKS = ["TRC20", "ERC20", "BEP20", "Bitcoin", "Solana", "Polygon", "Bank wire"];

const qrFor = (value: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(value)}`;

type AddressRow = {
  id: string;
  coin: string;
  network: string;
  address: string;
  memo: string | null;
  active: boolean;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value ?? ""}
        inputMode={numeric ? "decimal" : "text"}
        placeholder={placeholder ?? "Not set"}
        onChange={(e) =>
          onChange(numeric ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
        }
        className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
      />
    </label>
  );
}

/** Receiving wallets, QR codes, bank wire details and funding limits/fees. */
export function PaymentGatewaysPanel({
  addresses,
  onDone,
}: {
  addresses: AddressRow[];
  onDone: () => void;
}) {
  const upsert = useServerFn(upsertDepositAddress);
  const remove = useServerFn(deleteDepositAddress);
  const read = useServerFn(getPlatformSettings);
  const write = useServerFn(savePlatformSetting);

  const [draft, setDraft] = useState<Partial<AddressRow>>({ network: "TRC20", active: true });
  const [showQr, setShowQr] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Record<string, any>>({});

  const settings = useQuery({
    queryKey: ["gateway-settings"],
    queryFn: () => read({ data: { keys: ["gateways"] } }),
  });
  useEffect(() => {
    if (settings.data) setCfg(((settings.data as any)['gateways'] ?? {}) as Record<string, any>);
  }, [settings.data]);

  const saveAddress = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: draft.id,
          coin: String(draft.coin ?? "").trim(),
          network: String(draft.network ?? "").trim(),
          address: String(draft.address ?? "").trim(),
          memo: draft.memo ?? undefined,
          active: draft.active ?? true,
          reason: draft.id ? window.prompt("Audit note for this address change (required)") ?? "" : undefined,
        } as any,
      }),
    onSuccess: () => {
      toast.success("Receiving address saved.");
      setDraft({ network: "TRC20", active: true });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id, reason: window.prompt("Audit note for deleting this address (required)") ?? "" } }),
    onSuccess: () => {
      toast.success("Address removed.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCfg = useMutation({
    mutationFn: () => write({ data: { key: "gateways", value: cfg } }),
    onSuccess: () => {
      toast.success("Gateway configuration saved.");
      void settings.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: string, v: any) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/70 bg-card/50 p-4">
        <h3 className="font-display text-sm font-semibold">Receiving wallets & networks</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Addresses shown to users on the deposit screen. QR codes are generated from the address.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Coin" value={draft.coin} onChange={(v) => setDraft((d) => ({ ...d, coin: v }))} placeholder="USDT" />
          <label className="block min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Network
            </span>
            <select
              value={draft.network ?? "TRC20"}
              onChange={(e) => setDraft((d) => ({ ...d, network: e.target.value }))}
              className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            >
              {NETWORKS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Address / IBAN"
            value={draft.address}
            onChange={(v) => setDraft((d) => ({ ...d, address: v }))}
          />
          <Field label="Memo / tag" value={draft.memo} onChange={(v) => setDraft((d) => ({ ...d, memo: v }))} />
        </div>
        <button
          onClick={() => saveAddress.mutate()}
          disabled={saveAddress.isPending}
          className="mt-3 inline-flex min-h-10 touch-manipulation items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="size-4" /> {draft.id ? "Update address" : "Add address"}
        </button>

        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {a.coin} · {a.network}{" "}
                  {!a.active && <span className="text-[10px] text-ops-red">INACTIVE</span>}
                </p>
                <p className="num truncate text-[11px] text-muted-foreground">{a.address}</p>
              </div>
              <button
                onClick={() => setShowQr(a.address)}
                className="touch-manipulation rounded-lg border border-border p-2 text-muted-foreground"
                aria-label="Show QR"
              >
                <QrCode className="size-4" />
              </button>
              <button
                onClick={() => setDraft(a)}
                className="touch-manipulation rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold"
              >
                Edit
              </button>
              <button
                onClick={() => del.mutate(a.id)}
                className="touch-manipulation rounded-lg border border-ops-red/25 p-2 text-ops-red"
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {addresses.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">No receiving addresses yet.</p>
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/50 p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Banknote className="size-4 text-primary" /> Limits, fees & bank wire
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Min deposit" numeric value={cfg['minDeposit']} onChange={(v) => set("minDeposit", v)} />
          <Field label="Max deposit" numeric value={cfg['maxDeposit']} onChange={(v) => set("maxDeposit", v)} />
          <Field label="Deposit fee %" numeric value={cfg['depositFeePct']} onChange={(v) => set("depositFeePct", v)} />
          <Field label="Min withdrawal" numeric value={cfg['minWithdrawal']} onChange={(v) => set("minWithdrawal", v)} />
          <Field label="Max withdrawal" numeric value={cfg['maxWithdrawal']} onChange={(v) => set("maxWithdrawal", v)} />
          <Field
            label="Withdrawal fee %"
            numeric
            value={cfg['withdrawalFeePct']}
            onChange={(v) => set("withdrawalFeePct", v)}
          />
          <Field label="Bank name" value={cfg['bankName']} onChange={(v) => set("bankName", v)} />
          <Field label="Account holder" value={cfg['bankHolder']} onChange={(v) => set("bankHolder", v)} />
          <Field label="IBAN / account no." value={cfg['bankIban']} onChange={(v) => set("bankIban", v)} />
          <Field label="SWIFT / BIC" value={cfg['bankSwift']} onChange={(v) => set("bankSwift", v)} />
          <Field label="Bank address" value={cfg['bankAddress']} onChange={(v) => set("bankAddress", v)} />
          <Field label="Wire reference format" value={cfg['wireReference']} onChange={(v) => set("wireReference", v)} />
        </div>
        <button
          onClick={() => saveCfg.mutate()}
          disabled={saveCfg.isPending}
          className="mt-4 min-h-10 touch-manipulation rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saveCfg.isPending ? "Saving…" : "Save gateway settings"}
        </button>
      </section>

      {showQr && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowQr(null)}
        >
          <div className="rounded-2xl border border-border bg-background p-4 text-center">
            <img src={qrFor(showQr)} alt="Deposit address QR code" className="rounded-xl" />
            <p className="num mt-2 max-w-[180px] break-all text-[10px] text-muted-foreground">
              {showQr}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
