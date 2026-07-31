import { useState } from "react";
import { INSTRUMENT_MAP, type Instrument } from "@/lib/instruments";

/** Fiat / metal currency -> circle flag or icon slug. */
const FLAG: Record<string, string> = {
  USD: "us",
  EUR: "european_union",
  GBP: "gb",
  JPY: "jp",
  AUD: "au",
  CHF: "ch",
  CAD: "ca",
  NZD: "nz",
};

const CRYPTO_ALIAS: Record<string, string> = {
  TON: "ton",
  XRP: "xrp",
  BNB: "bnb",
  DOGE: "doge",
  AVAX: "avax",
  LINK: "link",
  ADA: "ada",
  SOL: "sol",
  BTC: "btc",
  ETH: "eth",
  USDT: "usdt",
};

const STOCK_DOMAIN: Record<string, string> = {
  AAPL: "apple.com",
  NVDA: "nvidia.com",
  TSLA: "tesla.com",
  MSFT: "microsoft.com",
  AMZN: "amazon.com",
  META: "meta.com",
  AMD: "amd.com",
  COIN: "coinbase.com",
};

const TINT: Record<string, string> = {
  crypto: "bg-primary/15 text-primary",
  stock: "bg-sky-500/15 text-sky-400",
  future: "bg-violet-500/15 text-violet-400",
  forex: "bg-emerald-500/15 text-emerald-400",
  metal: "bg-amber-500/15 text-amber-400",
};

function flagUrl(code: string) {
  return `https://cdn.jsdelivr.net/gh/HatScripts/circle-flags/flags/${code}.svg`;
}

function cryptoUrl(sym: string) {
  return `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${sym.toLowerCase()}.svg`;
}

/** Icon source + monogram fallback for a wallet currency (USD, EUR, USDT, BTC…). */
export function currencyIcon(currency: string): { src?: string; label: string; tint: string } {
  const upper = currency.toUpperCase();
  if (CRYPTO_ALIAS[upper]) {
    return { src: cryptoUrl(CRYPTO_ALIAS[upper]), label: upper.slice(0, 3), tint: TINT.crypto };
  }
  if (FLAG[upper]) {
    return { src: flagUrl(FLAG[upper]), label: upper.slice(0, 3), tint: TINT.forex };
  }
  return { label: upper.slice(0, 3), tint: TINT.stock };
}

function instrumentIcon(inst: Instrument): { src?: string; label: string; tint: string } {
  const tint = TINT[inst.assetClass] ?? TINT.stock;
  switch (inst.assetClass) {
    case "crypto": {
      const base = inst.symbol.replace(/USDT$/, "");
      return { src: cryptoUrl(CRYPTO_ALIAS[base] ?? base), label: base.slice(0, 3), tint };
    }
    case "stock": {
      const domain = STOCK_DOMAIN[inst.symbol];
      return {
        src: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : undefined,
        label: inst.symbol.slice(0, 3),
        tint,
      };
    }
    case "forex": {
      const base = inst.symbol.replace("=X", "").slice(0, 3);
      return { src: FLAG[base] ? flagUrl(FLAG[base]) : undefined, label: base, tint };
    }
    case "metal":
    case "future":
    default:
      return { label: inst.symbol.replace("=F", "").slice(0, 3), tint };
  }
}

/**
 * Official token / company / currency mark for an instrument symbol, with a
 * tinted monogram fallback when the remote logo is unavailable.
 */
export function AssetIcon({
  symbol,
  currency,
  size = 28,
  className = "",
}: {
  symbol?: string;
  currency?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const inst = symbol ? INSTRUMENT_MAP[symbol] : undefined;
  const info = inst
    ? instrumentIcon(inst)
    : currencyIcon(currency ?? symbol ?? "?");

  const box = `shrink-0 overflow-hidden rounded-full grid place-items-center ${className}`;
  const style = { width: size, height: size } as const;

  if (!info.src || failed) {
    return (
      <span
        style={style}
        className={`${box} ${info.tint} font-semibold`}
        aria-hidden="true"
      >
        <span style={{ fontSize: Math.max(9, size * 0.34) }}>{info.label}</span>
      </span>
    );
  }

  return (
    <span style={style} className={`${box} bg-surface-raised`}>
      <img
        src={info.src}
        alt=""
        loading="lazy"
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="size-full object-contain"
      />
    </span>
  );
}
