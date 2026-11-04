import { useState } from "react";
import { ImageOff } from "lucide-react";
import hype from "@/assets/crypto/hype.png.asset.json";
import predict from "@/assets/crypto/predict.png.asset.json";
import niulai from "@/assets/crypto/niulai.png.asset.json";
import marscoin from "@/assets/crypto/marscoin.png.asset.json";

const published: Record<string, string> = { HYPE: hype.url, PREDICT: predict.url, "牛来": niulai.url, MARSCOIN: marscoin.url };

export function ListingLogo({ ticker, name, logoUrl }: { ticker: string; name: string; logoUrl?: string | null }) {
  const sources = [...new Set([published[ticker], logoUrl].filter((source): source is string => Boolean(source)))];
  const [failed, setFailed] = useState<string[]>([]);
  const source = sources.find(url => !failed.includes(url));
  return <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-raised">
    {source ? <img src={source} alt={`${name} logo`} className="size-7 object-contain" onError={() => setFailed(current => [...current, source])} /> : <ImageOff className="size-4 text-muted-foreground" aria-label={`${name} logo unavailable`} />}
  </span>;
}