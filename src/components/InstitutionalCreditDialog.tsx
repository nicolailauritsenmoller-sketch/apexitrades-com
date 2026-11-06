import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ShieldCheck, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssetIcon } from "@/lib/asset-icons";
import { useQuotes } from "@/hooks/useMarket";
import { articleQuote } from "@/lib/article-quotes";
import { supabase } from "@/integrations/supabase/client";
import { creditMetrics, creditScenarioSchema, CREDIT_MAX_LTV, CREDIT_LIQUIDATION_LTV } from "@/lib/institutional-credit";
import { requestCreditSimulation } from "@/lib/institutional-credit.functions";
import { requestVipAccess } from "@/lib/vip.functions";

const number = (n: number, digits = 2) => n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
export function InstitutionalCreditDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [collateralAsset, setCollateralAsset] = useState<"BTC" | "ETH" | "USDT">("BTC");
  const [borrowingAsset, setBorrowingAsset] = useState<"USDT" | "USDC" | "BTC" | "ETH">("USDT");
  const [amount, setAmount] = useState("");
  const [ltv, setLtv] = useState(50);
  const [rateModel, setRateModel] = useState<"fixed" | "variable">("fixed");
  const [fixedApr, setFixedApr] = useState("6");
  const [primeApr, setPrimeApr] = useState("5");
  const [spread, setSpread] = useState("2");
  const [drawn, setDrawn] = useState(false);
  const qc = useQueryClient();
  const submit = useServerFn(requestCreditSimulation);
  const treasury = useServerFn(requestVipAccess);
  const { quotes } = useQuotes(open ? ["BTCUSDT", "ETHUSDT", "USDCUSDT"] : []);
  const price = (asset: string) => asset === "USDT" ? 1 : articleQuote(quotes[`${asset}USDT`])?.price;
  const wallets = useQuery({ queryKey: ["credit-simulation-wallets"], enabled: open, queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Account unavailable");
    const { data, error } = await supabase.from("wallets").select("currency,balance").eq("user_id", auth.user.id);
    if (error) throw new Error("Balances unavailable");
    return data;
  } });
  const balance = wallets.data?.filter(w => w.currency === collateralAsset).reduce((sum, w) => sum + Number(w.balance), 0);
  const parsed = creditScenarioSchema.safeParse({ collateralAsset, borrowingAsset, collateralAmount: Number(amount), ltv, rateModel, fixedApr: Number(fixedApr), primeApr: Number(primeApr), spread: Number(spread), collateralPrice: price(collateralAsset), borrowingPrice: price(borrowingAsset) });
  const metrics = parsed.success ? creditMetrics(parsed.data) : null;
  const request = useMutation({ mutationFn: async () => {
    if (!parsed.success) throw new Error("Enter valid collateral and rate assumptions; current quotes are required.");
    const result = await submit({ data: parsed.data });
    void qc.invalidateQueries({ queryKey: ["my-tickets"] });
    return result;
  } });
  const contact = useMutation({ mutationFn: () => treasury({ data: { roleKey: "treasury_ops" } }) });
  const update = () => { request.reset(); setDrawn(false); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto p-0">
    <DialogHeader className="border-b border-border px-5 py-5 sm:px-6"><div className="mb-2 flex items-center gap-2 text-xs uppercase text-muted-foreground"><Building2 className="size-4 text-ops-amber" /> Prime brokerage <span className="ml-auto mr-6 text-ops-amber">Simulation</span></div><DialogTitle className="text-xl">Institutional Credit Facility</DialogTitle><DialogDescription>Indicative scenarios only. No collateral is locked and no loan funds are credited.</DialogDescription></DialogHeader>
    <div className="grid gap-6 px-5 py-5 sm:grid-cols-2 sm:px-6">
      <section className="space-y-4"><h3 className="text-sm font-semibold">Collateral management</h3>
        <div className="space-y-2"><label className="text-xs text-muted-foreground" htmlFor="credit-collateral">Collateral asset</label><Select value={collateralAsset} onValueChange={v => { setCollateralAsset(v as typeof collateralAsset); update(); }}><SelectTrigger id="credit-collateral"><SelectValue /></SelectTrigger><SelectContent>{["BTC", "ETH", "USDT"].map(a => <SelectItem key={a} value={a}><span className="flex items-center gap-2"><AssetIcon currency={a} size={18} />{a}</span></SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><label htmlFor="credit-amount" className="text-xs text-muted-foreground">Proposed collateral amount</label><Input id="credit-amount" type="number" min="0" max="1000000000" step="any" value={amount} placeholder="0.00" onChange={e => { setAmount(e.target.value); update(); }} /><p className="text-xs text-muted-foreground">Deposited wallet balance: {balance == null ? "Unavailable" : `${number(balance, 8)} ${collateralAsset}`}</p>{Number(amount) > (balance ?? 0) && <p className="text-xs text-ops-amber">Scenario exceeds deposited balance; additional funding would be required.</p>}</div>
        <div className="space-y-2"><label htmlFor="credit-borrowing" className="text-xs text-muted-foreground">Borrowing asset</label><Select value={borrowingAsset} onValueChange={v => { setBorrowingAsset(v as typeof borrowingAsset); update(); }}><SelectTrigger id="credit-borrowing"><SelectValue /></SelectTrigger><SelectContent>{["USDT", "USDC", "BTC", "ETH"].map(a => <SelectItem key={a} value={a} disabled={a === collateralAsset}>{a}</SelectItem>)}</SelectContent></Select></div>
        <div className="border-t border-border pt-4"><div className="mb-4 flex justify-between text-sm"><label id="credit-ltv">Loan-to-value</label><span className="num font-semibold">{ltv}%</span></div><Slider aria-labelledby="credit-ltv" value={[ltv]} min={10} max={CREDIT_MAX_LTV} step={1} onValueChange={v => { setLtv(v[0] ?? 50); update(); }} /><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>10% conservative</span><span>70% maximum</span></div></div>
        <div className="space-y-2"><label htmlFor="credit-rate" className="text-xs text-muted-foreground">Interest rate model</label><Select value={rateModel} onValueChange={v => { setRateModel(v as typeof rateModel); update(); }}><SelectTrigger id="credit-rate"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed APR</SelectItem><SelectItem value="variable">Variable - prime + spread</SelectItem></SelectContent></Select></div>
        {rateModel === "fixed" ? <div><label htmlFor="credit-fixed" className="text-xs text-muted-foreground">Illustrative fixed APR (%)</label><Input id="credit-fixed" type="number" min="0" max="50" step="0.1" value={fixedApr} onChange={e => { setFixedApr(e.target.value); update(); }} /></div> : <div className="grid grid-cols-2 gap-3"><div><label htmlFor="credit-prime" className="text-xs text-muted-foreground">Assumed prime (%)</label><Input id="credit-prime" type="number" min="0" max="50" step="0.1" value={primeApr} onChange={e => { setPrimeApr(e.target.value); update(); }} /></div><div><label htmlFor="credit-spread" className="text-xs text-muted-foreground">Spread (%)</label><Input id="credit-spread" type="number" min="0" max="20" step="0.1" value={spread} onChange={e => { setSpread(e.target.value); update(); }} /></div></div>}
      </section>
      <section className="space-y-5 sm:border-l sm:border-border sm:pl-6"><h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-bull" /> Facility risk overview</h3><div><p className="text-xs text-muted-foreground">Indicative credit allocation</p><p className="num mt-2 text-2xl font-semibold">{metrics ? number(metrics.principal) : "--"} <span className="text-xs text-muted-foreground">USDT</span></p><p className="num mt-1 text-xs text-muted-foreground">{metrics ? `${number(metrics.borrowingAmount, 8)} ${borrowingAsset}` : "Enter a valid scenario"}</p></div>
        <dl className="space-y-4 text-sm">{[["Collateral valuation", metrics ? `${number(metrics.collateralValue)} USDT` : "--"], ["Illustrative APR", metrics ? `${number(metrics.apr)}%` : "--"], ["Annual interest", metrics ? `${number(metrics.annualInterest)} USDT` : "--"], ["Daily accrual estimate", metrics ? `${number(metrics.dailyInterest)} USDT` : "--"], ["Margin health factor", metrics ? `${number(metrics.healthFactor)}x` : "--"], ["Price downside buffer", metrics ? `${number(metrics.downsideBuffer)}%` : "--"], ["Liquidation reference", metrics ? `${number(metrics.liquidationPrice)} USDT` : "--"]].map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-b border-border pb-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="num text-right text-xs">{value}</dd></div>)}</dl>
        <div className={`border-l-2 pl-3 text-xs ${ltv >= 65 ? "border-bear text-bear" : "border-bull text-muted-foreground"}`}><p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="size-3.5" />{ltv >= 65 ? "Elevated liquidation sensitivity" : "Within simulation risk limits"}</p><p>Illustrative liquidation threshold: {CREDIT_LIQUIDATION_LTV}% LTV. Price moves and accrued interest can reduce the buffer.</p></div><p className="text-xs text-muted-foreground">APR and liquidation terms are editable scenario assumptions, not a lending offer or live prime-index feed. Market references refresh automatically.</p>
      </section>
    </div>
    <footer className="sticky bottom-0 space-y-3 border-t border-border bg-card px-5 py-4 sm:px-6">{request.isSuccess && <p role="status" className="flex items-center gap-2 text-xs text-bull"><CheckCircle2 className="size-4" />Treasury review ticket {request.data.reference ?? request.data.id} submitted. Credit remains unapproved.</p>}{drawn && request.data && <p role="status" className="text-xs text-ops-amber">Drawdown simulated: {number(request.data.borrowingAmount, 8)} {request.data.borrowingAsset}. Wallet and treasury balances are unchanged.</p>}{request.isError && <p role="alert" className="text-xs text-bear">{request.error.message}</p>}{!parsed.success && amount && <p role="alert" className="text-xs text-bear">{collateralAsset === borrowingAsset ? "Choose a different borrowing asset." : "Enter valid positive amounts and rate assumptions. Current market quotes are required."}</p>}<div className="flex flex-wrap gap-2"><Button disabled={!parsed.success || request.isPending || request.isSuccess} onClick={() => request.mutate()}>{request.isPending ? "Submitting..." : "Request Credit Facility"}<ArrowRight /></Button><Button variant="outline" disabled={!request.isSuccess || drawn} onClick={() => setDrawn(true)}>Simulate Drawdown Loan</Button><Button variant="ghost" disabled={contact.isPending || contact.isSuccess} onClick={() => contact.mutate()}>Treasury Operations</Button></div>{contact.isSuccess && <p role="status" className="text-xs text-muted-foreground">Treasury Operations specialist request sent. <Link to="/profile/support" className="underline">Open support</Link></p>}{contact.isError && <p role="alert" className="text-xs text-bear">Could not contact Treasury Operations. Please retry.</p>}</footer>
  </DialogContent></Dialog>;
}