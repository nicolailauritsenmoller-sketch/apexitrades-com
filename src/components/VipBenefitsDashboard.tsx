import { Link } from "@tanstack/react-router";
import { BadgeCheck, ChartNoAxesCombined, Gem, Gift, Headset, Info, LibraryBig, Percent } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { collateralProgress } from "@/lib/prime-tiers";

type Props = {
  balance: number;
  requirement: number;
  valuationComplete: boolean;
  status: string;
  onAdd: () => void;
  onManage: (section: "allocation" | "fees") => void;
  onSupport: () => void;
};

const amount = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function VipBenefitsDashboard({ balance, requirement, valuationComplete, status, onAdd, onManage, onSupport }: Props) {
  const [resource, setResource] = useState<"portal" | "gifts" | null>(null);
  const progress = collateralProgress(balance, requirement);
  const cards = [
    { title: "Lower Fee", subtitle: "Reduced Trading Fees", icon: Percent, to: "/fees" as const },
    { title: "My VIP", subtitle: "Manage VIP benefits", icon: BadgeCheck, action: () => onManage("allocation") },
    { title: "VIP Portal", subtitle: "VIP news and resources", icon: LibraryBig, to: "/vip-portal" as const },
    { title: "VIP Insights", subtitle: "The latest market trends", icon: ChartNoAxesCombined, to: "/markets" as const },
    { title: "VIP Gift Packs", subtitle: "Unlocked at VIP 3", icon: Gift, action: () => setResource("gifts") },
    { title: "Priority Support", subtitle: "24/7 Customer Service", icon: Headset, action: onSupport },
  ];

  return <>
    <header className="flex items-center justify-between gap-4 pb-7 pt-2 sm:pb-9">
      <div>
        <p className="mb-3 text-xs font-medium text-muted-foreground">VIP Memberships <span className="ml-2 border-l border-border pl-2">{status}</span></p>
        <h1 className="text-3xl font-medium leading-snug text-ops-amber sm:text-4xl">Experience your<br />Exclusive Benefits</h1>
      </div>
      <Gem aria-hidden="true" className="size-16 shrink-0 stroke-[0.8] text-ops-amber sm:size-24" />
    </header>
    <section aria-label="Exclusive VIP benefits" className="grid grid-cols-2 gap-3 sm:gap-4">
      {cards.map(card => {
        const content = <><span className="mb-4 grid size-11 place-items-center rounded-full bg-secondary text-foreground sm:mb-5 sm:size-12"><card.icon className="size-6 stroke-[1.5]" /></span><span className="text-sm font-medium sm:text-lg">{card.title}</span><span className="mt-1.5 text-xs font-normal leading-relaxed text-muted-foreground sm:text-sm">{card.subtitle}</span></>;
        const classes = "h-auto min-h-40 w-full flex-col items-start justify-start whitespace-normal rounded-lg border border-border bg-card p-4 text-left hover:border-foreground/25 hover:bg-surface-raised sm:min-h-44 sm:p-6";
        return card.to ? <Button key={card.title} asChild variant="ghost" className={classes}><Link to={card.to}>{content}</Link></Button> : <Button key={card.title} variant="ghost" className={classes} onClick={card.action}>{content}</Button>;
      })}
    </section>
    <section aria-labelledby="rising-star-title" className="py-7 sm:py-9">
      <h2 id="rising-star-title" className="mb-5 flex items-center gap-2 text-lg font-medium text-ops-amber">Become a VIP Rising Star <Info className="size-4 text-muted-foreground" aria-label="Based on cleared USDT collateral; allocation requires review" /></h2>
      <div className="border-y border-border py-5">
        <div className="flex items-center justify-between gap-4"><h3 className="text-sm font-medium">USDT Collateral Requirement</h3><Button className="min-h-10 min-w-20 rounded-md" onClick={onAdd}>Add</Button></div>
        <p className="num mt-4 text-lg">{valuationComplete ? `${amount(balance)} / ${amount(requirement)}` : "Valuation unavailable"}<span className="ml-2 text-xs text-muted-foreground">USDT</span></p>
        <div role="progressbar" aria-label="VIP Rising Star collateral" aria-valuemin={0} aria-valuemax={100} aria-valuenow={valuationComplete ? Math.round(progress.percent) : 0} className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-ops-amber transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${valuationComplete ? progress.percent : 0}%` }} /></div>
        <p className="mt-3 text-xs text-muted-foreground">{valuationComplete ? progress.qualified ? "Collateral requirement met. Allocation subject to review." : `Need +${amount(progress.remaining)} USDT` : "Live conversion required to evaluate collateral."}</p>
      </div>
    </section>
    <Dialog open={resource !== null} onOpenChange={open => { if (!open) setResource(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{resource === "gifts" ? "VIP Gift Packs" : "VIP Portal"}</DialogTitle><DialogDescription>{resource === "gifts" ? "Gift packs are not currently provisioned. Membership approval does not grant a claimable gift." : "Membership resources and live market coverage."}</DialogDescription></DialogHeader>
        {resource === "portal" ? <div className="grid gap-3"><Button variant="outline" onClick={() => { setResource(null); onManage("allocation"); }}><BadgeCheck /> Membership & collateral</Button><Button asChild variant="outline"><Link to="/markets"><ChartNoAxesCombined /> Live market insights</Link></Button><Button asChild variant="outline"><Link to="/profile/help"><LibraryBig /> Help center & resources</Link></Button></div> : <Button variant="outline" onClick={() => { setResource(null); onSupport(); }}><Headset /> Contact VIP support</Button>}
      </DialogContent>
    </Dialog>
  </>;
}