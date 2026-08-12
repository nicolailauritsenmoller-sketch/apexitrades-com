import { useState } from "react";
import { INSTRUMENT_MAP, type Instrument } from "@/lib/instruments";

// ---- Crypto marks (authentic brand SVG/PNG, bundled locally) ----
import btcIcon from "@/assets/crypto/btc.svg";
import ethIcon from "@/assets/crypto/eth.svg";
import solIcon from "@/assets/crypto/sol.svg";
import xrpIcon from "@/assets/crypto/xrp.svg";
import bnbIcon from "@/assets/crypto/bnb.svg";
import dogeIcon from "@/assets/crypto/doge.svg";
import adaIcon from "@/assets/crypto/ada.svg";
import avaxIcon from "@/assets/crypto/avax.svg";
import linkIcon from "@/assets/crypto/link.svg";
import atomIcon from "@/assets/crypto/atom.svg";
import polIcon from "@/assets/crypto/matic.svg";
import usdtIcon from "@/assets/crypto/usdt.svg";
import tonIcon from "@/assets/crypto/ton.png";
import suiIcon from "@/assets/crypto/sui.png";
import nearIcon from "@/assets/crypto/near.png";
import aptIcon from "@/assets/crypto/apt.png";
import shibIcon from "@/assets/crypto/shib.png";
import pepeIcon from "@/assets/crypto/pepe.png";

// ---- Country / currency flags ----
import usFlag from "@/assets/flags/us.svg";
import euFlag from "@/assets/flags/eu.svg";
import gbFlag from "@/assets/flags/gb.svg";
import jpFlag from "@/assets/flags/jp.svg";
import auFlag from "@/assets/flags/au.svg";
import chFlag from "@/assets/flags/ch.svg";
import caFlag from "@/assets/flags/ca.svg";
import nzFlag from "@/assets/flags/nz.svg";

// ---- Commodity / futures badges ----
import goldIcon from "@/assets/commodities/gold.svg";
import silverIcon from "@/assets/commodities/silver.svg";
import platinumIcon from "@/assets/commodities/platinum.svg";
import palladiumIcon from "@/assets/commodities/palladium.svg";
import copperIcon from "@/assets/commodities/copper.svg";
import oilIcon from "@/assets/commodities/oil.svg";
import brentIcon from "@/assets/commodities/brent.svg";
import gasIcon from "@/assets/commodities/gas.svg";
import indexIcon from "@/assets/commodities/index.svg";
import bondIcon from "@/assets/commodities/bond.svg";
import companyIcon from "@/assets/commodities/company.svg";

const CRYPTO_ICON: Record<string, string> = {
  BTC: btcIcon,
  ETH: ethIcon,
  SOL: solIcon,
  XRP: xrpIcon,
  BNB: bnbIcon,
  DOGE: dogeIcon,
  ADA: adaIcon,
  AVAX: avaxIcon,
  LINK: linkIcon,
  ATOM: atomIcon,
  POL: polIcon,
  MATIC: polIcon,
  USDT: usdtIcon,
  TON: tonIcon,
  SUI: suiIcon,
  NEAR: nearIcon,
  APT: aptIcon,
  SHIB: shibIcon,
  PEPE: pepeIcon,
};

/** Remote fallback chain for tokens without a bundled mark. */
const cryptoCdns = (base: string): string[] => {
  const b = base.toLowerCase();
  return [
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@1.0.0/128/color/${b}.png`,
    `https://assets.coincap.io/assets/icons/${b}@2x.png`,
    `https://cryptoicon-api.pages.dev/api/icon/${b}`,
  ];
};

const FLAG_ICON: Record<string, string> = {
  USD: usFlag,
  EUR: euFlag,
  GBP: gbFlag,
  JPY: jpFlag,
  AUD: auFlag,
  CHF: chFlag,
  CAD: caFlag,
  NZD: nzFlag,
};

/** ISO country for currencies without a bundled flag. */
const CURRENCY_COUNTRY: Record<string, string> = {
  SEK: "se",
  NOK: "no",
  MXN: "mx",
  ZAR: "za",
  SGD: "sg",
  HKD: "hk",
  TRY: "tr",
  CNY: "cn",
  DKK: "dk",
  PLN: "pl",
  INR: "in",
  BRL: "br",
};

function flagFor(code: string): string {
  const upper = code.toUpperCase();
  if (FLAG_ICON[upper]) return FLAG_ICON[upper];
  const cc = CURRENCY_COUNTRY[upper];
  return cc ? `https://flagcdn.com/w80/${cc}.png` : usFlag;
}

const FUTURE_ICON: Record<string, string> = {
  "ES=F": indexIcon,
  "NQ=F": indexIcon,
  "YM=F": indexIcon,
  "RTY=F": indexIcon,
  "MES=F": indexIcon,
  "MNQ=F": indexIcon,
  "VX=F": indexIcon,
  "BTC=F": btcIcon,
  "CL=F": oilIcon,
  "BZ=F": brentIcon,
  "NG=F": gasIcon,
  "HO=F": oilIcon,
  "RB=F": oilIcon,
  "ZB=F": bondIcon,
  "ZN=F": bondIcon,
  "ZF=F": bondIcon,
};

const METAL_ICON: Record<string, string> = {
  "GC=F": goldIcon,
  "MGC=F": goldIcon,
  "XAUUSD=X": goldIcon,
  "SI=F": silverIcon,
  "SIL=F": silverIcon,
  "XAGUSD=X": silverIcon,
  "PL=F": platinumIcon,
  "PA=F": palladiumIcon,
  "HG=F": copperIcon,
  "ALI=F": copperIcon,
  XAU: goldIcon,
  XAG: silverIcon,
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
  GOOGL: "abc.xyz",
  NFLX: "netflix.com",
  INTC: "intel.com",
  MU: "micron.com",
  QCOM: "qualcomm.com",
  AVGO: "broadcom.com",
  ORCL: "oracle.com",
  CRM: "salesforce.com",
  ADBE: "adobe.com",
  PLTR: "palantir.com",
  UBER: "uber.com",
  ABNB: "airbnb.com",
  SHOP: "shopify.com",
  SQ: "block.xyz",
  PYPL: "paypal.com",
  MSTR: "strategy.com",
  MARA: "mara.com",
  RIOT: "riotplatforms.com",
  HOOD: "robinhood.com",
  BABA: "alibabagroup.com",
  JPM: "jpmorganchase.com",
  GS: "goldmansachs.com",
  BAC: "bankofamerica.com",
  MS: "morganstanley.com",
  V: "visa.com",
  MA: "mastercard.com",
  "BRK-B": "berkshirehathaway.com",
  WMT: "walmart.com",
  COST: "costco.com",
  KO: "coca-colacompany.com",
  PEP: "pepsico.com",
  MCD: "mcdonalds.com",
  NKE: "nike.com",
  SBUX: "starbucks.com",
  DIS: "thewaltdisneycompany.com",
  BA: "boeing.com",
  CAT: "caterpillar.com",
  GE: "ge.com",
  F: "ford.com",
  GM: "gm.com",
  XOM: "exxonmobil.com",
  CVX: "chevron.com",
  PFE: "pfizer.com",
  JNJ: "jnj.com",
  MRK: "merck.com",
  LLY: "lilly.com",
  UNH: "unitedhealthgroup.com",
  T: "att.com",
  VZ: "verizon.com",
  CSCO: "cisco.com",
  IBM: "ibm.com",
  TSM: "tsmc.com",
  ASML: "asml.com",
  SNOW: "snowflake.com",
  CRWD: "crowdstrike.com",
  NET: "cloudflare.com",
  SPOT: "spotify.com",
  RIVN: "rivian.com",
  LCID: "lucidmotors.com",
  SOFI: "sofi.com",
};


type IconInfo = {
  /** Ordered fallback chain; first source that loads wins. */
  sources: string[];
  /** Optional second chain, used for FX pairs (base + quote flags). */
  quoteSources?: string[];
  label: string;
};

/** Icon source for a wallet currency (USD, EUR, USDT, BTC…). */
export function currencyIcon(currency: string): { src: string; label: string; tint: string } {
  const upper = currency.toUpperCase();
  const src =
    CRYPTO_ICON[upper] ??
    METAL_ICON[upper] ??
    (FLAG_ICON[upper] || CURRENCY_COUNTRY[upper] ? flagFor(upper) : cryptoCdns(upper)[0]);
  return { src, label: upper.slice(0, 3), tint: "" };
}

function currencySources(code: string): string[] {
  const upper = code.toUpperCase();
  if (CRYPTO_ICON[upper]) return [CRYPTO_ICON[upper]];
  if (METAL_ICON[upper]) return [METAL_ICON[upper]];
  if (FLAG_ICON[upper] || CURRENCY_COUNTRY[upper]) return [flagFor(upper)];
  return cryptoCdns(upper);
}

function instrumentIcon(inst: Instrument): IconInfo {
  switch (inst.assetClass) {
    case "crypto": {
      const base = inst.symbol.replace(/USDT$/, "");
      const bundled = CRYPTO_ICON[base];
      return {
        sources: bundled ? [bundled, ...cryptoCdns(base)] : cryptoCdns(base),
        label: base.slice(0, 4),
      };
    }
    case "forex": {
      const pair = inst.symbol.replace("=X", "");
      const base = pair.slice(0, 3);
      const quote = pair.slice(3, 6);
      // Metals quoted in fiat (XAUUSD) keep their metallic mark on the base side.
      const baseSources = METAL_ICON[base] ? [METAL_ICON[base]] : [flagFor(base)];
      return {
        sources: baseSources,
        quoteSources: [flagFor(quote)],
        label: base,
      };
    }
    case "metal":
      return {
        sources: [METAL_ICON[inst.symbol] ?? goldIcon],
        label: inst.symbol.replace("=F", "").slice(0, 3),
      };
    case "future":
      return {
        sources: [FUTURE_ICON[inst.symbol] ?? indexIcon],
        label: inst.symbol.replace("=F", "").slice(0, 3),
      };
    case "stock":
    default: {
      const domain = STOCK_DOMAIN[inst.symbol];
      return {
        sources: domain
          ? [
              `https://logo.clearbit.com/${domain}`,
              `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
              `https://icons.duckduckgo.com/ip3/${domain}.ico`,
            ]
          : [companyIcon],
        label: inst.symbol.replace(/[^A-Z0-9]/g, "").slice(0, 4),
      };
    }
  }
}

/** Deterministic tint so each ticker badge keeps a stable brand-ish colour. */
function badgeHue(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) % 360;
  return hash;
}

/** Clean stylized ticker badge shown when every image source fails. */
function TickerBadge({ label, size }: { label: string; size: number }) {
  const text = (label || "?").toUpperCase().slice(0, 4);
  const hue = badgeHue(text);
  return (
    <span
      className="grid size-full place-items-center rounded-full font-semibold leading-none"
      style={{
        background: `linear-gradient(140deg, hsl(${hue} 62% 46%), hsl(${(hue + 38) % 360} 64% 34%))`,
        color: "#fff",
        fontSize: Math.max(7, Math.round(size / (text.length > 3 ? 3.4 : 2.6))),
        letterSpacing: "0.02em",
      }}
    >
      {text}
    </span>
  );
}

function Mark({ sources, size, label }: { sources: string[]; size: number; label: string }) {
  const [index, setIndex] = useState(0);
  const key = sources[0] ?? label;
  const [seed, setSeed] = useState(key);
  if (seed !== key) {
    setSeed(key);
    setIndex(0);
  }

  const src = sources[index];
  if (!src) return <TickerBadge label={label} size={size} />;

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      width={size}
      height={size}
      onError={() => setIndex((i) => i + 1)}
      className="size-full object-contain"
    />
  );
}

/**
 * Official token / company / currency mark for an instrument symbol. FX pairs
 * render dual country flags (base overlapping quote). Every chain ends in a
 * stylized ticker badge so a failed image never renders as a broken icon.
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
  const inst = symbol ? INSTRUMENT_MAP[symbol] : undefined;
  const fallbackCode = (currency ?? symbol ?? "USD").toUpperCase();
  const info: IconInfo = inst
    ? instrumentIcon(inst)
    : { sources: currencySources(fallbackCode), label: fallbackCode.slice(0, 4) };

  const box = `shrink-0 overflow-hidden rounded-full bg-surface-raised grid place-items-center ${className}`;

  if (info.quoteSources) {
    const mark = Math.round(size * 0.68);
    return (
      <span
        className={`relative inline-block shrink-0 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <span
          className="absolute left-0 top-0 overflow-hidden rounded-full ring-1 ring-border bg-surface-raised"
          style={{ width: mark, height: mark }}
        >
          <Mark sources={info.sources} size={mark} label={info.label} />
        </span>
        <span
          className="absolute bottom-0 right-0 overflow-hidden rounded-full ring-1 ring-border bg-surface-raised"
          style={{ width: mark, height: mark }}
        >
          <Mark sources={info.quoteSources} size={mark} label={info.label.slice(-3)} />
        </span>
      </span>
    );
  }

  return (
    <span style={{ width: size, height: size }} className={box} aria-hidden="true">
      <Mark sources={info.sources} size={size} label={info.label} />
    </span>
  );
}
