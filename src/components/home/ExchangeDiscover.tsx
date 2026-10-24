import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, ChevronDown, ChevronUp, Newspaper, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getExpertCommentary } from "@/lib/news.functions";
import { ExchangeMarkets } from "@/components/home/ExchangeMarkets";

const TABS = ["Discover", "Following", "Stocks", "Campaign", "Smart Money"] as const;
type DiscoveryTab = typeof TABS[number];

export function ExchangeDiscover() {
  const [tab, setTab] = useState<DiscoveryTab>("Discover");
  const [expanded, setExpanded] = useState(false);
  const content = useRef<HTMLElement>(null);
  const fetchCommentary = useServerFn(getExpertCommentary);
  const commentary = useQuery({ queryKey: ["expert-commentary"], queryFn: () => fetchCommentary(), refetchInterval: 120_000, enabled: expanded && tab === "Discover" });
  function select(next: DiscoveryTab) {
    setTab(next);
    setExpanded(true);
    window.setTimeout(() => content.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }), 50);
  }
  return <section ref={content} className="scroll-mt-20" aria-label="Exchange discovery">
    <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/95 py-2 backdrop-blur-xl md:static md:border-b md:bg-transparent md:py-0">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 md:px-3">
        <div role="tablist" aria-label="Discovery feeds" className="no-scrollbar -mx-1 flex min-w-0 flex-1 snap-x snap-proximity items-center gap-1 overflow-x-auto overscroll-x-contain px-1 scroll-px-1 touch-manipulation">
          {TABS.map(item => (
            <Button
              key={item}
              role="tab"
              aria-selected={tab === item}
              variant="ghost"
              className={`relative h-10 shrink-0 snap-start whitespace-nowrap rounded-none px-3 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors md:h-11 md:px-4 md:text-[12px] ${
                tab === item
                  ? "font-semibold text-foreground after:absolute after:inset-x-2.5 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary md:after:inset-x-3 md:after:bottom-0"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => select(item)}
            >
              {item}
              {item === "Stocks" && <span className="ml-1 rounded-full bg-bull/15 px-1.5 py-0.5 text-[8px] font-semibold leading-none tracking-wide text-bull">NEW</span>}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={expanded ? "Collapse discovery" : "Expand discovery"} onClick={() => expanded ? setExpanded(false) : select(tab)}>{expanded ? <ChevronDown /> : <ChevronUp />}</Button>
      </div>
    </div>
    <div aria-hidden className="h-8 md:hidden" />
    {expanded && <div role="tabpanel" aria-label={`${tab} feed`} className="py-4">
      {tab === "Discover" && <>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Newspaper className="size-4" />Trading commentary &amp; outlooks</h2>
        {commentary.isPending ? <p className="py-5 text-sm text-muted-foreground">Loading commentary...</p> : commentary.data?.length ? commentary.data.slice(0, 12).map(item => <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-4"><div className="min-w-0"><p className="text-[11px] text-muted-foreground">{item.source}</p><p className="mt-1 text-sm font-semibold">{item.title}</p></div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></a>) : <p className="py-5 text-sm text-muted-foreground">No commentary available right now.</p>}
      </>}
      {tab === "Following" && <ExchangeMarkets initialTab="Favorites" />}
      {tab === "Stocks" && <ExchangeMarkets initialTab="Hot" initialCategory="Stocks" />}
      {tab === "Campaign" && <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-4"><div className="min-w-0"><h2 className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4" />Referral program</h2><p className="mt-1 text-xs text-muted-foreground">Your referrals and referral activity</p></div><Button asChild variant="secondary"><Link to="/profile/referrals">View <ArrowUpRight /></Link></Button></div>}
      {tab === "Smart Money" && <p className="py-5 text-sm text-muted-foreground">No verified institutional flow updates available.</p>}
    </div>}
  </section>;
}