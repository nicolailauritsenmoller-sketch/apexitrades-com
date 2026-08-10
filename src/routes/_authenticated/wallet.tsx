import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, ArrowDownToLine, ArrowUpFromLine, Repeat } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AssetIcon } from "@/lib/asset-icons";
import { formatMoney } from "@/lib/instruments";
import {
  getDepositAddresses,
  getPortfolioValue,
  getWalletActivity,
  requestDeposit,
  requestWithdrawal,
  swapAssets,
} from "@/lib/wallet.functions";

export const Route = createFileRoute("/_authenticated/wallet")({
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
  { id: "deposit", label: "Deposit", icon: ArrowDownToLine },
  { id: "withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { id: "swap", label: "Swap", icon: Repeat },
] as const;

const STATUS_TONE: Record<string, string> = {
  pending: "text-amber-400",
  approved: "text-bull",
  rejected: "text-bear",
};

function qrUrl(text: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(text)}`;
}

function WalletPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("deposit");

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

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Wallet</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Fund your account, request withdrawals and swap between assets at live rates.
      </p>

      <div className="panel mb-6 p-5">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Total portfolio value
        </div>
        <div className="num text-3xl font-bold">
          {value.isLoading ? "—" : formatMoney(value.data?.totalUsdt ?? 0, "USDT")}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {wallets.map((w) => (
            <div key={w.currency} className="flex items-center gap-2 rounded-md bg-secondary/50 p-3">
              <AssetIcon currency={w.currency} size={28} />
              <div className="min-w-0">
                <div className="num truncate text-sm font-semibold">
                  {formatMoney(w.balance, w.currency)}
                </div>
                <div className="num text-[11px] text-muted-foreground">
                  ≈ {w.valueUsdt.toFixed(2)} USDT
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-secondary/60 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              tab === id ? "bg-background text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "deposit" && (
        <DepositTab addresses={addresses.data ?? []} onDone={refresh} />
      )}
      {tab === "withdraw" && (
        <WithdrawTab
          balances={wallets.map((w) => ({ currency: w.currency, balance: w.balance }))}
          onDone={refresh}
        />
      )}
      {tab === "swap" && (
        <SwapTab
          balances={wallets.map((w) => ({ currency: w.currency, balance: w.balance }))}
          rates={value.data?.rates ?? {}}
          onDone={refresh}
        />
      )}

      <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Recent activity
      </h2>
      <div className="panel divide-y divide-border">
        {(activity.data?.deposits ?? []).map((d) => (
          <Row
            key={d.id}
            left={`Deposit ${d.amount} ${d.coin}`}
            sub={`${d.network} · ${new Date(d.createdAt).toLocaleString()}`}
            right={d.status}
            tone={STATUS_TONE[d.status]}
          />
        ))}
        {(activity.data?.withdrawals ?? []).map((w) => (
          <Row
            key={w.id}
            left={`Withdrawal ${w.amount} ${w.coin}`}
            sub={`${w.destinationAddress.slice(0, 18)}… · ${new Date(w.createdAt).toLocaleString()}`}
            right={w.status}
            tone={STATUS_TONE[w.status]}
          />
        ))}
        {(activity.data?.swaps ?? []).map((s) => (
          <Row
            key={s.id}
            left={`Swap ${s.fromAmount.toFixed(4)} ${s.fromCurrency} → ${s.toAmount.toFixed(4)} ${s.toCurrency}`}
            sub={new Date(s.createdAt).toLocaleString()}
            right="done"
            tone="text-muted-foreground"
          />
        ))}
        {!activity.isLoading &&
          (activity.data?.deposits.length ?? 0) +
            (activity.data?.withdrawals.length ?? 0) +
            (activity.data?.swaps.length ?? 0) ===
            0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
          )}
      </div>
      <div className="h-10" />
    </AppShell>
  );
}

function Row({
  left,
  sub,
  right,
  tone,
}: {
  left: string;
  sub: string;
  right: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{left}</div>
        <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <span className={`text-xs uppercase tracking-wide ${tone ?? ""}`}>{right}</span>
    </div>
  );
}

type Address = { id: string; coin: string; network: string; address: string; memo: string | null };

function DepositTab({ addresses, onDone }: { addresses: Address[]; onDone: () => void }) {
  const [selected, setSelected] = useState(0);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const submit = useServerFn(requestDeposit);

  const mutation = useMutation({
    mutationFn: (vars: { coin: string; network: string; amount: number; txHash?: string }) =>
      submit({ data: vars }),
    onSuccess: () => {
      toast.success("Deposit submitted — awaiting admin approval.");
      setAmount("");
      setTxHash("");
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
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder={`Amount in ${addr.coin}`}
                className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
              />
              <input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                maxLength={200}
                placeholder="Transaction hash (optional)"
                className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
              />
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
                className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
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

function WithdrawTab({
  balances,
  onDone,
}: {
  balances: { currency: string; balance: number }[];
  onDone: () => void;
}) {
  const [coin, setCoin] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const submit = useServerFn(requestWithdrawal);

  const mutation = useMutation({
    mutationFn: (vars: {
      coin: string;
      network: string;
      amount: number;
      destinationAddress: string;
    }) => submit({ data: vars }),
    onSuccess: () => {
      toast.success("Withdrawal requested — pending admin approval.");
      setAmount("");
      setAddress("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const available = balances.find((b) => b.currency === coin)?.balance ?? 0;

  return (
    <div className="panel max-w-xl space-y-3 p-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Asset</span>
          <select
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
            className="mt-1 w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
          >
            {balances.map((b) => (
              <option key={b.currency} value={b.currency}>
                {b.currency}
              </option>
            ))}
          </select>
        </label>
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

      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        placeholder="Amount"
        className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
      />
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        maxLength={200}
        placeholder="Destination wallet address"
        className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
      />
      <button
        disabled={mutation.isPending}
        onClick={() => {
          const value = Number(amount);
          if (!Number.isFinite(value) || value <= 0) return toast.error("Enter a valid amount.");
          if (address.trim().length < 8) return toast.error("Enter a valid destination address.");
          mutation.mutate({
            coin,
            network,
            amount: value,
            destinationAddress: address.trim(),
          });
        }}
        className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Request withdrawal
      </button>
    </div>
  );
}

function SwapTab({
  balances,
  rates,
  onDone,
}: {
  balances: { currency: string; balance: number }[];
  rates: Record<string, number>;
  onDone: () => void;
}) {
  const [from, setFrom] = useState("USDT");
  const [to, setTo] = useState("BTC");
  const [amount, setAmount] = useState("");
  const submit = useServerFn(swapAssets);

  const mutation = useMutation({
    mutationFn: (vars: { from: string; to: string; amount: number }) => submit({ data: vars }),
    onSuccess: (res) => {
      toast.success(`Swapped — received ${res.toAmount.toFixed(6)} ${to}`);
      setAmount("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const options = ["USD", "EUR", "GBP", "USDT", "BTC"];
  const rate = (rates[from] ?? 0) / (rates[to] || 1);
  const estimate = Number(amount) > 0 ? Number(amount) * rate : 0;
  const available = balances.find((b) => b.currency === from)?.balance ?? 0;

  return (
    <div className="panel max-w-xl space-y-3 p-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">From</span>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
          >
            {options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">To</span>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
          >
            {options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Available: <span className="num">{formatMoney(available, from)}</span> · Rate{" "}
        <span className="num">
          1 {from} = {rate ? rate.toFixed(6) : "—"} {to}
        </span>
      </div>

      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        placeholder={`Amount in ${from}`}
        className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
      />

      <div className="rounded-md bg-secondary/50 p-3 text-sm">
        You receive ≈ <span className="num font-semibold">{estimate.toFixed(6)}</span> {to}
      </div>

      <button
        disabled={mutation.isPending}
        onClick={() => {
          const value = Number(amount);
          if (!Number.isFinite(value) || value <= 0) return toast.error("Enter a valid amount.");
          mutation.mutate({ from, to, amount: value });
        }}
        className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Swap instantly
      </button>
    </div>
  );
}
