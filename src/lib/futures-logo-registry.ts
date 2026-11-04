// Official exchange / index marks for catalog futures contracts (Wikimedia Commons brand files).
import nasdaq from "@/assets/futures/nasdaq.png.asset.json";
import dowjones from "@/assets/futures/dowjones.png.asset.json";
import sp500 from "@/assets/futures/sp500.png.asset.json";
import cme from "@/assets/futures/cme.png.asset.json";
import ice from "@/assets/futures/ice.png.asset.json";
import cboe from "@/assets/futures/cboe.png.asset.json";
import ftse from "@/assets/futures/ftse.png.asset.json";

/**
 * Futures contract -> official brand mark of the underlying index or the
 * exchange the contract trades on (CME Group for CME/CBOT/NYMEX/COMEX,
 * ICE for Brent, Cboe for VIX, FTSE Russell for Russell indexes).
 */
export const FUTURE_LOGOS: Record<string, string> = {
  "ES=F": sp500.url,
  "MES=F": sp500.url,
  "NQ=F": nasdaq.url,
  "MNQ=F": nasdaq.url,
  "YM=F": dowjones.url,
  "RTY=F": ftse.url,
  "VX=F": cboe.url,
  "LE=F": cme.url,
  "HE=F": cme.url,
  "CL=F": cme.url,
  "MCL=F": cme.url,
  "NG=F": cme.url,
  "HO=F": cme.url,
  "RB=F": cme.url,
  "BZ=F": ice.url,
  "SR3=F": cme.url,
  "ZQ=F": cme.url,
  "ZT=F": cme.url,
  "ZF=F": cme.url,
  "ZN=F": cme.url,
  "ZB=F": cme.url,
  // CBOT grains (CME Group)
  "ZC=F": cme.url,
  "ZS=F": cme.url,
  "ZW=F": cme.url,
  "ZL=F": cme.url,
  // ICE Futures US softs
  "KC=F": ice.url,
  "SB=F": ice.url,
  "CC=F": ice.url,
  "CT=F": ice.url,
};
