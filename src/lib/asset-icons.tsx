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

const FUTURE_ICON: Record<string, string> = {
  "ES=F": indexIcon,
  "NQ=F": indexIcon,
  "YM=F": indexIcon,
  "RTY=F": indexIcon,
  "CL=F": oilIcon,
  "BZ=F": brentIcon,
  "NG=F": gasIcon,
  "ZB=F": bondIcon,
};

const METAL_ICON: Record<string, string> = {
  "GC=F": goldIcon,
  "SI=F": silverIcon,
  "PL=F": platinumIcon,
  "PA=F": palladiumIcon,
  "HG=F": copperIcon,
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
};

type IconInfo = {
  src: string;
  /** Optional second mark, used for FX pairs (base + quote flags). */
  quoteSrc?: string;
  label: string;
};

/** Icon source for a wallet currency (USD, EUR, USDT, BTC…). */
export function currencyIcon(currency: string): { src: string; label: string; tint: string } {
  const upper = currency.toUpperCase();
  const src = CRYPTO_ICON[upper] ?? FLAG_ICON[upper] ?? METAL_ICON[upper] ?? companyIcon;
  return { src, label: upper.slice(0, 3), tint: "" };
}

function instrumentIcon(inst: Instrument): IconInfo {
  switch (inst.assetClass) {
    case "crypto": {
      const base = inst.symbol.replace(/USDT$/, "");
      return { src: CRYPTO_ICON[base] ?? usdtIcon, label: base.slice(0, 4) };
    }
    case "forex": {
      const pair = inst.symbol.replace("=X", "");
      const base = pair.slice(0, 3);
      const quote = pair.slice(3, 6);
      return {
        src: FLAG_ICON[base] ?? usFlag,
        quoteSrc: FLAG_ICON[quote] ?? usFlag,
        label: base,
      };
    }
    case "metal":
      return { src: METAL_ICON[inst.symbol] ?? goldIcon, label: inst.symbol.slice(0, 2) };
    case "future":
      return { src: FUTURE_ICON[inst.symbol] ?? indexIcon, label: inst.symbol.slice(0, 2) };
    case "stock":
    default: {
      const domain = STOCK_DOMAIN[inst.symbol];
      return {
        src: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : companyIcon,
        label: inst.symbol.slice(0, 3),
      };
    }
  }
}

function Mark({ src, size, fallback }: { src: string; size: number; fallback: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? fallback : src}
      alt=""
      loading="lazy"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="size-full object-contain"
    />
  );
}

/**
 * Official token / company / currency mark for an instrument symbol. FX pairs
 * render dual country flags (base overlapping quote).
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
  const info: IconInfo = inst
    ? instrumentIcon(inst)
    : (() => {
        const c = currencyIcon(currency ?? symbol ?? "USD");
        return { src: c.src, label: c.label };
      })();

  const box = `shrink-0 overflow-hidden rounded-full bg-surface-raised grid place-items-center ${className}`;

  if (info.quoteSrc) {
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
          <Mark src={info.src} size={mark} fallback={companyIcon} />
        </span>
        <span
          className="absolute bottom-0 right-0 overflow-hidden rounded-full ring-1 ring-border bg-surface-raised"
          style={{ width: mark, height: mark }}
        >
          <Mark src={info.quoteSrc} size={mark} fallback={companyIcon} />
        </span>
      </span>
    );
  }

  return (
    <span style={{ width: size, height: size }} className={box} aria-hidden="true">
      <Mark src={info.src} size={size} fallback={companyIcon} />
    </span>
  );
}
