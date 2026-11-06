import { useEffect, useState } from "react";
import { giftRotationAt } from "@/lib/vip-gift-rotation";
import apparel from "@/assets/vip-gift-merchandise.jpg";
import desk from "@/assets/vip-gifts-desk.jpg";
import security from "@/assets/vip-gifts-security.jpg";
import special from "@/assets/vip-gifts-special.jpg";

const images = { apparel, desk, security, special };

export function VipGiftPreview() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  if (now === null) return <div className="aspect-video bg-secondary" role="status">Loading daily preview...</div>;
  const { pack } = giftRotationAt(now);
  return <>
    <figure>
      <img src={images[pack.id]} alt={`Illustrative ${pack.category} merchandise concept`} loading="lazy" width={1536} height={864} className="aspect-video h-auto w-full rounded-lg border border-border object-cover" />
      <figcaption className="mt-3 text-xs text-muted-foreground">Actual items may differ from what's shown above.</figcaption>
    </figure>
    <section aria-label="Today's gift preview" className="space-y-2">
      <p className="text-xs text-muted-foreground">{pack.category}</p>
      <h3 className="text-lg font-medium">{pack.title}</h3>
      <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">{pack.items.map(item => <li key={item} className="border-l border-border pl-3">{item}</li>)}</ul>
    </section>
    {pack.id === "security" && <p className="text-xs leading-relaxed text-muted-foreground">Generic hardware illustrations only. Ledger and Trezor engraving concepts are not supplied products or endorsed partnerships.</p>}
    {pack.id === "special" && <p className="text-xs leading-relaxed text-muted-foreground">Special-drop concepts only, not a birthday entitlement or scheduled year-end offer.</p>}
    <p className="text-xs leading-relaxed text-muted-foreground">Rotates daily at 00:00 UTC. Illustrative preview only; gifts are not stocked or available to claim. Membership approval does not grant a claimable gift.</p>
  </>;
}