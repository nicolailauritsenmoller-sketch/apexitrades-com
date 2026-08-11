import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, ArrowDownToLine, ArrowUpFromLine, Repeat } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { AssetIcon } from "@/lib/asset-icons";
import { AssetPicker } from "@/components/AssetPicker";
import { AssetsOverview } from "@/components/AssetsOverview";
import { TransactionStatusDialog } from "@/components/TransactionStatusDialog";
import {
  STATUS_STYLE,
  shortenAddress,
  toTxStatus,
  type TransactionRecord,
} from "@/lib/transactions";
import {
  ASSET_CLASS_LABEL,
  CURRENCIES,
  INSTRUMENTS,
  INSTRUMENT_MAP,
  displaySymbol,
  formatMoney,
} from "@/lib/instruments";
import {
  getDepositAddresses,
  getPortfolioValue,
  getSwapRate,
  getWithdrawalEligibility,
  getWalletActivity,
  requestDeposit,
  requestWithdrawal,
  swapAssets,
} from "@/lib/wallet.functions";

const TAB_IDS = ["deposit", "withdraw", "swap"] as const;
type TabId = (typeof TAB_IDS)[number];

export const Route = createFileRoute("/_authenticated/wallet")({
  validateSearch: (search: Record<string, unknown>): { tab: TabId } => {
    const t = String(search["tab"] ?? "deposit") as TabId;
    return { tab: TAB_IDS.includes(t) ? t : "deposit" };
  },
  head: () => ({
    meta: [
      { title: "Wallet — deposits, withdrawals & swaps | Velocity Trade" },
      {
        name: "description",
        content:
          "Fund your account with USDT, BTC or ETH, request withdrawals to your own address, and swap between assets at live market rates.",
      },
      { property: "og:title", content: "Wallet — deposits, withdrawals & swaps" },
      {
        property: "og:description",
        content: "Deposit crypto, request withdrawals and swap assets instantly at live rates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WalletPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-bear">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

const TABS = [
  {
    id: "deposit",
    label: "Deposit",
    icon: ArrowDownToLine,
    active: "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20",
    idle: "text-emerald-600 dark:text-emerald-500",
  },
  {
    id: "withdraw",
    label: "Withdraw",
    icon: ArrowUpFromLine,
    active: "bg-rose-600 text-white shadow-lg shadow-rose-600/20",
    idle: "text-rose-600 dark:text-rose-500",
  },
  {
    id: "swap",
    label: "Swap",
    icon: Repeat,
    active: "bg-blue-600 text-white shadow-lg shadow-blue-600/20",
    idle: "text-blue-600 dark:text-blue-500",
  },
] as const;

function qrUrl(text: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(text)}`;
}

function WalletPage() {
  const qc = useQueryClient();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const setTab = (id: TabId) => navigate({ to: "/wallet", search: { tab: id } });
  const [activeTx, setActiveTx] = useState<TransactionRecord | null>(null);

  const fetchAddresses = useServerFn(getDepositAddresses);
  const fetchValue = useServerFn(getPortfolioValue);
  const fetchActivity = useServerFn(getWalletActivity);

  const addresses = useQuery({ queryKey: ["deposit-addresses"], queryFn: () => fetchAddresses() });
  const value = useQuery({
    queryKey: ["portfolio-value"],
    queryFn: () => fetchValue(),
    refetchInterval: 30_000,
  });
  const activity = useQuery({ queryKey: ["wallet-activity"], queryFn: () => fetchActivity() });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["wallet-activity"] });
    qc.invalidateQueries({ queryKey: ["portfolio-value"] });
    qc.invalidateQueries({ queryKey: ["portfolio"] });
  }

  const wallets = value.data?.wallets ?? [];

  const transactions = useMemo<TransactionRecord[]>(() => {
    const a = activity.data;
    if (!a) return [];
    const deposits: TransactionRecord[] = a.deposits.map((d) => ({
      id: d.id,
      type: "deposit" as const,
      status: toTxStatus(d.status),
      rawStatus: d.status,
      asset: d.coin,
      amount: d.amount,
      network: d.network,
      address: null,
      txHash: d.txHash ?? null,
      note: d.adminNote ?? null,
      createdAt: d.createdAt,
      title: `Deposit ${d.amount} ${d.coin}`,
      subtitle: d.network,
    }));
    const withdrawals: TransactionRecord[] = a.withdrawals.map((w) => ({
      id: w.id,
      type: "withdrawal" as const,
      status: toTxStatus(w.status),
      rawStatus: w.status,
      asset: w.coin,
      amount: w.amount,
      network: w.network,
      address: w.destinationAddress,
      txHash: null,
      note: w.adminNote ?? null,
      createdAt: w.createdAt,
      title: `Withdrawal ${w.amount} ${w.coin}`,
      subtitle: `${w.network} · ${shortenAddress(w.destinationAddress)}`,
    }));
    const swaps: TransactionRecord[] = a.swaps.map((s) => ({
      id: s.id,
      type: "swap" as const,
      status: "successful" as const,
      rawStatus: "approved",
      asset: s.toCurrency,
      amount: s.toAmount,
      network: null,
      address: null,
      txHash: null,
      note: null,
      createdAt: s.createdAt,
      title: `Swap ${s.fromAmount.toFixed(4)} ${s.fromCurrency} → ${s.toAmount.toFixed(4)} ${s.toCurrency}`,
      subtitle: `Rate ${s.rate.toFixed(6)}`,
    }));
    return [...deposits, ...withdrawals, ...swaps].sort((x, y) =>
      x.createdAt < y.createdAt ? 1 : -1,
    );
  }, [activity.data]);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Wallet</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Fund your account, request withdrawals and swap between assets at live rates.
      </p>

      <div className="mb-6">
        <AssetsOverview
          holdings={wallets}
          totalUsdt={value.data?.totalUsdt ?? 0}
          isLoading={value.isLoading}
        />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-secondary/60 p-1.5">
        {TABS.map(({ id, label, icon: Icon, active, idle }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-all active:scale-[0.98] ${
              tab === id ? active : `${idle} hover:bg-background/60`
            }`}
          >
            <Icon className="size-5" strokeWidth={2.6} />
            {label}
          </button>
        ))}
      </div>

      {tab === "deposit" && (
        <DepositTab
          addresses={addresses.data ?? []}
          onDone={refresh}
          onSubmitted={setActiveTx}
        />
      )}
      {tab === "withdraw" && (
        <WithdrawTab
          balances={wallets.map((w) => ({ currency: w.currency, balance: w.balance }))}
          onDone={refresh}
          onSubmitted={setActiveTx}
        />
      )}
      {tab === "swap" && (
        <SwapTab
          balances={wallets.map((w) => ({ currency: w.currency, balance: w.balance }))}
          onDone={refresh}
        />
      )}

      <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Transaction history
      </h2>
      <div className="panel divide-y divide-border">
        {transactions.map((t) => {
          const style = STATUS_STYLE[t.status];
          return (
            <button
              key={`${t.type}-${t.id}`}
              onClick={() => setActiveTx(t)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
            >
              <AssetIcon currency={t.asset} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{t.title}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {t.subtitle} · {new Date(t.createdAt).toLocaleString()}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${style.badge}`}
              >
                {style.label}
              </span>
            </button>
          );
        })}
        {!activity.isLoading && transactions.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
        )}
      </div>

      <TransactionStatusDialog
        tx={activeTx}
        open={activeTx !== null}
        onOpenChange={(v) => !v && setActiveTx(null)}
      />

      <div className="h-10" />
    </AppShell>
  );
}

type Address = { id: string; coin: string; network: string; address: string; memo: string | null };

function DepositTab({
  addresses,
  onDone,
  onSubmitted,
}: {
  addresses: Address[];
  onDone: () => void;
  onSubmitted: (tx: TransactionRecord) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const submit = useServerFn(requestDeposit);

  const mutation = useMutation({
    mutationFn: async (vars: { coin: string; network: string; amount: number; txHash?: string }) => {
      let receiptPath: string | undefined;
      if (proof) {
        setUploading(true);
        try {
          const { data: auth } = await supabase.auth.getUser();
          const uid = auth.user?.id;
          if (!uid) throw new Error("Session expired. Please sign in again.");
          const ext = proof.name.split(".").pop()?.toLowerCase() ?? "png";
          const path = `${uid}/${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from("deposit-proofs").upload(path, proof);
          if (error) throw new Error(error.message);
          receiptPath = path;
        } finally {
          setUploading(false);
        }
      }
      return submit({ data: { ...vars, ...(receiptPath ? { receiptPath } : {}) } });
    },
    onSuccess: (res, vars) => {
      onSubmitted({
        id: res.id,
        type: "deposit",
        status: "pending",
        rawStatus: "pending",
        asset: vars.coin,
        amount: vars.amount,
        network: vars.network,
        address: addresses.find((a) => a.coin === vars.coin && a.network === vars.network)?.address ?? null,
        txHash: vars.txHash ?? null,
        note: null,
        createdAt: res.createdAt,
        title: `Deposit ${vars.amount} ${vars.coin}`,
        subtitle: vars.network,
      });
      setAmount("");
      setTxHash("");
      setProof(null);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const addr = addresses[selected];

  if (addresses.length === 0) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">
        No deposit addresses have been configured yet. Please contact support.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel p-5">
        <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
          Select network
        </div>
        <div className="grid gap-2">
          {addresses.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setSelected(i)}
              className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                i === selected ? "border-primary bg-secondary/60" : "border-border hover:bg-secondary/40"
              }`}
            >
              <AssetIcon currency={a.coin} size={28} />
              <div>
                <div className="text-sm font-medium">{a.coin}</div>
                <div className="text-[11px] text-muted-foreground">{a.network}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel p-5">
        {addr && (
          <>
            <div className="flex flex-col items-center gap-3">
              <img
                src={qrUrl(addr.address)}
                alt={`${addr.coin} ${addr.network} deposit address QR code`}
                width={180}
                height={180}
                loading="lazy"
                className="rounded-lg bg-white p-2"
              />
              <div className="w-full break-all rounded-md bg-secondary p-3 text-center text-xs">
                {addr.address}
              </div>
              {addr.memo && (
                <p className="text-[11px] text-muted-foreground">Memo/Tag: {addr.memo}</p>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(addr.address);
                  toast.success("Address copied");
                }}
                className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/70"
              >
                <Copy className="size-3.5" /> Copy address
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                  <AssetIcon currency={addr.coin} symbol={addr.coin} size={22} />
                  <span className="text-xs font-semibold text-muted-foreground">{addr.coin}</span>
                </span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder={`Amount in ${addr.coin}`}
                  className="w-full rounded-md bg-secondary py-2.5 pl-24 pr-3 text-sm outline-none"
                />
              </div>
              <input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                maxLength={200}
                placeholder="Transaction hash (optional)"
                className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
              />
              <div className="flex items-center gap-2 rounded-md bg-secondary/50 p-3 text-sm">
                <AssetIcon currency={addr.coin} symbol={addr.coin} size={24} />
                <span>
                  Depositing <span className="num font-semibold">{amount || "0.00"}</span>{" "}
                  {addr.coin} via {addr.network}
                </span>
              </div>
              <button
                disabled={mutation.isPending}
                onClick={() => {
                  const value = Number(amount);
                  if (!Number.isFinite(value) || value <= 0) {
                    toast.error("Enter a valid amount.");
                    return;
                  }
                  mutation.mutate({
                    coin: addr.coin,
                    network: addr.network,
                    amount: value,
                    txHash: txHash.trim() || undefined,
                  });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-transform active:scale-[0.99] disabled:opacity-60"
              >
                <ArrowDownToLine className="size-4" strokeWidth={2.8} />
                Submit deposit for approval
              </button>
              <p className="text-[11px] text-muted-foreground">
                Balances are credited only after an administrator confirms your transfer on-chain.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MaxButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-primary hover:bg-primary/25"
    >
      Max
    </button>
  );
}

/** Formats a balance without rounding up beyond what the user actually holds. */
function trimAmount(value: number, decimals = 8) {
  if (!Number.isFinite(value) || value <= 0) return "";
  const factor = 10 ** decimals;
  const floored = Math.floor(value * factor) / factor;
  return String(floored);
}

function WithdrawTab({
  balances,
  onDone,
  onSubmitted,
}: {
  balances: { currency: string; balance: number }[];
  onDone: () => void;
  onSubmitted: (tx: TransactionRecord) => void;
}) {
  const [coin, setCoin] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const submit = useServerFn(requestWithdrawal);
  const fetchEligibility = useServerFn(getWithdrawalEligibility);

  const eligibility = useQuery({
    queryKey: ["withdrawal-eligibility"],
    queryFn: () => fetchEligibility(),
  });

  const mutation = useMutation({
    mutationFn: (vars: {
      coin: string;
      network: string;
      amount: number;
      destinationAddress: string;
    }) => submit({ data: vars }),
    onSuccess: (res, vars) => {
      onSubmitted({
        id: res.id,
        type: "withdrawal",
        status: "pending",
        rawStatus: "pending",
        asset: vars.coin,
        amount: vars.amount,
        network: vars.network,
        address: vars.destinationAddress,
        txHash: null,
        note: null,
        createdAt: res.createdAt,
        title: `Withdrawal ${vars.amount} ${vars.coin}`,
        subtitle: `${vars.network} · ${shortenAddress(vars.destinationAddress)}`,
      });
      setAmount("");
      setAddress("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const available = balances.find((b) => b.currency === coin)?.balance ?? 0;
  const requested = Number(amount);
  const overBalance = Number.isFinite(requested) && requested > available;
  const blocked = eligibility.data ? !eligibility.data.canWithdraw : false;

  return (
    <div className="panel max-w-xl space-y-3 p-5">
      {eligibility.data && (
        <div
          className={`rounded-md border p-3 text-xs ${
            blocked ? "border-bear/40 bg-bear/10 text-bear" : "border-border text-muted-foreground"
          }`}
        >
          <div className="font-semibold">
            Credit score {eligibility.data.creditScore} · KYC {eligibility.data.kycStatus}
          </div>
          {blocked && (
            <ul className="mt-1 list-inside list-disc">
              {eligibility.data.reasons.map((r: string) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <AssetPicker
          value={coin}
          onChange={setCoin}
          label="Asset"
          options={balances.map((b) => ({ code: b.currency, group: "Your wallets" }))}
        />
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Network
          </span>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="mt-1 w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
          >
            {["TRC20", "ERC20", "Bitcoin", "BEP20", "Bank transfer"].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Available: <span className="num">{formatMoney(available, coin)}</span>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          <AssetIcon currency={coin} symbol={coin} size={22} />
          <span className="text-xs font-semibold text-muted-foreground">{coin}</span>
        </span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Amount"
          className="w-full rounded-md bg-secondary py-2.5 pl-24 pr-16 text-sm outline-none"
        />
        <MaxButton onClick={() => setAmount(trimAmount(available))} />
      </div>
      {overBalance && (
        <p className="text-[11px] text-bear">
          Amount exceeds your available {coin} balance.
        </p>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          <AssetIcon currency={coin} symbol={coin} size={22} />
        </span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={200}
          placeholder={`Destination ${coin} address (${network})`}
          className="w-full rounded-md bg-secondary py-2.5 pl-11 pr-3 text-sm outline-none"
        />
      </div>
      <div className="flex items-center gap-2 rounded-md bg-secondary/50 p-3 text-sm">
        <AssetIcon currency={coin} symbol={coin} size={24} />
        <span className="min-w-0 truncate">
          Sending <span className="num font-semibold">{amount || "0.00"}</span> {coin} to{" "}
          {address.trim() ? shortenAddress(address.trim()) : "—"}
        </span>
      </div>
      <button
        disabled={mutation.isPending || blocked || overBalance}
        onClick={() => {
          const value = Number(amount);
          if (!Number.isFinite(value) || value <= 0) return toast.error("Enter a valid amount.");
          if (value > available) return toast.error("Amount exceeds your available balance.");
          if (address.trim().length < 8) return toast.error("Enter a valid destination address.");
          mutation.mutate({
            coin,
            network,
            amount: value,
            destinationAddress: address.trim(),
          });
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        <ArrowUpFromLine className="size-4" strokeWidth={2.8} />
        Request withdrawal
      </button>
    </div>
  );
}

const SWAP_GROUPS: { label: string; codes: string[] }[] = [
  { label: "Cash & wallets", codes: [...CURRENCIES] },
  ...(["crypto", "stock", "future", "forex", "metal"] as const).map((cls) => ({
    label: ASSET_CLASS_LABEL[cls],
    codes: INSTRUMENTS.filter((i) => i.assetClass === cls).map((i) => i.symbol),
  })),
];

const SWAP_OPTIONS = SWAP_GROUPS.flatMap((g) => g.codes.map((code) => ({ code, group: g.label })));

function SwapTab({
  balances,
  onDone,
}: {
  balances: { currency: string; balance: number }[];
  onDone: () => void;
}) {
  const [from, setFrom] = useState("USDT");
  const [to, setTo] = useState("BTCUSDT");
  const [amount, setAmount] = useState("");
  const submit = useServerFn(swapAssets);
  const fetchRate = useServerFn(getSwapRate);

  const quote = useQuery({
    queryKey: ["swap-rate", from, to],
    queryFn: () => fetchRate({ data: { from, to } }),
    refetchInterval: 15_000,
    enabled: from !== to,
  });

  const mutation = useMutation({
    mutationFn: (vars: { from: string; to: string; amount: number }) => submit({ data: vars }),
    onSuccess: (res) => {
      toast.success(`Swapped — received ${res.toAmount.toFixed(6)} ${to}`);
      setAmount("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rate = quote.data?.rate ?? 0;
  const estimate = Number(amount) > 0 ? Number(amount) * rate : 0;
  const available = balances.find((b) => b.currency === from)?.balance ?? 0;
  const overBalance = Number(amount) > available;

  return (
    <div className="panel max-w-xl space-y-3 p-5">
      <div className="grid grid-cols-2 gap-3">
        <AssetPicker value={from} onChange={setFrom} label="From" options={SWAP_OPTIONS} />
        <AssetPicker value={to} onChange={setTo} label="To" options={SWAP_OPTIONS} />
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          Available: <span className="num">{formatMoney(available, from)}</span>
        </span>
        <span className="num">
          1 {from} = {rate ? rate.toFixed(8) : quote.isLoading ? "…" : "—"} {to}
        </span>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          <AssetIcon symbol={from} currency={from} size={22} />
          <span className="text-xs font-semibold text-muted-foreground">{from}</span>
        </span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="w-full rounded-md bg-secondary py-2.5 pl-24 pr-16 text-sm outline-none"
        />
        <MaxButton onClick={() => setAmount(trimAmount(available))} />
      </div>
      {overBalance && (
        <p className="text-[11px] text-bear">Amount exceeds your available {from} balance.</p>
      )}

      <div className="flex items-center gap-2 rounded-md bg-secondary/50 p-3 text-sm">
        <AssetIcon symbol={to} currency={to} size={22} />
        <span>
          You receive ≈ <span className="num font-semibold">{estimate.toFixed(8)}</span> {to}
        </span>
      </div>

      <button
        disabled={mutation.isPending || overBalance || from === to}
        onClick={() => {
          const value = Number(amount);
          if (!Number.isFinite(value) || value <= 0) return toast.error("Enter a valid amount.");
          if (value > available) return toast.error("Amount exceeds your available balance.");
          mutation.mutate({ from, to, amount: value });
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        <Repeat className="size-4" strokeWidth={2.8} />
        Swap instantly
      </button>
    </div>
  );
}

