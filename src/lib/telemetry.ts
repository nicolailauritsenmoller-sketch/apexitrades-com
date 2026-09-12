/**
 * Client-side telemetry: precise device/model detection, IP geolocation and
 * an activity stream (with lightweight DOM interaction capture for replay).
 */
import { UAParser } from "ua-parser-js";
import { supabase } from "@/integrations/supabase/client";
import { resolveServerGeo } from "@/lib/geo.functions";


export type DeviceInfo = {
  browser: string;
  browser_version: string | null;
  os_name: string;
  os_version: string | null;
  device_type: string;
  device_vendor: string | null;
  device_model: string | null;
  screen_resolution: string | null;
  user_agent: string;
};

export type GeoInfo = {
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  asn: string | null;
};

const DEVICE_KEY = "velocity.device_id";

function currentDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Apple hardware identifiers (Client Hints / UA) → marketing names. */
const APPLE_HINTS: Record<string, string> = {
  iPhone18: "iPhone 17 Pro",
  iPhone17: "iPhone 16 Pro",
  iPhone16: "iPhone 15 Pro",
  iPhone15: "iPhone 14",
  iPhone14: "iPhone 13",
  iPad: "iPad",
};

/**
 * iOS never exposes a model string, but the logical screen size + pixel ratio
 * uniquely identify almost every iPhone/iPad generation.
 */
const IOS_SCREENS: Record<string, string> = {
  "440x956@3": "iPhone 17 Pro Max",
  "402x874@3": "iPhone 17 Pro",
  "430x932@3": "iPhone 15 Pro Max",
  "393x852@3": "iPhone 15 Pro",
  "428x926@3": "iPhone 13 Pro Max",
  "390x844@3": "iPhone 13",
  "375x812@3": "iPhone 13 mini",
  "414x896@2": "iPhone 11",
  "414x896@3": "iPhone 11 Pro Max",
  "414x736@3": "iPhone 8 Plus",
  "375x667@2": "iPhone SE",
  "1024x1366@2": 'iPad Pro 12.9"',
  "834x1194@2": 'iPad Pro 11"',
  "820x1180@2": "iPad Air",
  "810x1080@2": "iPad",
  "768x1024@2": "iPad mini",
};

function screenKey(): string | null {
  if (typeof window === "undefined") return null;
  const w = Math.min(window.screen.width, window.screen.height);
  const h = Math.max(window.screen.width, window.screen.height);
  return `${w}x${h}@${Math.round(window.devicePixelRatio)}`;
}

/** Best-effort mapping of Apple/desktop hardware into an exact marketing model name. */
function refineModel(info: DeviceInfo): string {
  const key = screenKey();

  if (info.os_name === "iOS" || info.os_name === "iPadOS" || /iPhone|iPad/.test(info.user_agent)) {
    const exact = key ? IOS_SCREENS[key] : undefined;
    if (exact) return exact;
    if (info.device_model && /iPad/i.test(info.device_model)) return "iPad";
    return /iPad/.test(info.user_agent) ? "iPad" : "iPhone";
  }

  if (info.device_model && !/^(iPhone|iPad|Macintosh)$/i.test(info.device_model)) {
    const label = [info.device_vendor, info.device_model].filter(Boolean).join(" ");
    return /Galaxy|SM-/i.test(label) ? label.replace(/^Samsung SM-\S+$/, label) : label;
  }

  if (info.os_name === "macOS" || info.os_name === "Mac OS") {
    const chip = /Apple|arm/i.test(info.user_agent) ? "Apple Silicon" : "Intel";
    const width = typeof window === "undefined" ? 0 : window.screen.width;
    const family =
      width >= 2560 ? "Mac Studio Display" : width >= 1728 ? "MacBook Pro" : "MacBook Air";
    return `${family} (${chip})`;
  }

  if (info.os_name === "Windows") {
    const major = Number((info.os_version ?? "").split(".")[0] ?? 0);
    // Client Hints report Windows 11 as platformVersion 13+.
    const name = major >= 13 ? "Windows 11" : major >= 1 ? "Windows 10" : "Windows";
    return `${name} ${info.device_type === "Mobile" ? "Tablet" : "Desktop"}`;
  }

  if (info.os_name === "Android") {
    return info.device_vendor ? `${info.device_vendor} Android device` : "Android device";
  }
  if (info.os_name === "Linux") return "Linux Desktop";
  return `${info.os_name} ${info.device_type}`;
}

/** Reads UA string + User-Agent Client Hints for the most precise metadata available. */
export async function detectDevice(): Promise<DeviceInfo> {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const parsed = new UAParser(ua).getResult();

  let vendor = parsed.device.vendor ?? null;
  let model = parsed.device.model ?? null;
  let platformVersion = parsed.os.version ?? null;

  const uaData = (navigator as any)?.userAgentData;
  if (uaData?.getHighEntropyValues) {
    try {
      const hints = await uaData.getHighEntropyValues([
        "model",
        "platformVersion",
        "architecture",
        "fullVersionList",
      ]);
      if (hints.model) model = hints.model;
      if (hints.platformVersion) platformVersion = hints.platformVersion;
    } catch {
      /* client hints unavailable */
    }
  }

  if (model && APPLE_HINTS[model]) model = APPLE_HINTS[model];
  if (model && !vendor) {
    if (/^SM-|Galaxy/i.test(model)) vendor = "Samsung";
    else if (/^Pixel/i.test(model)) vendor = "Google";
    else if (/iPhone|iPad/i.test(model)) vendor = "Apple";
  }

  const type =
    parsed.device.type === "mobile"
      ? "Mobile"
      : parsed.device.type === "tablet"
        ? "Tablet"
        : "Desktop";

  const info: DeviceInfo = {
    browser: parsed.browser.name ?? "Unknown browser",
    browser_version: parsed.browser.version ?? null,
    os_name: parsed.os.name ?? "Unknown OS",
    os_version: platformVersion,
    device_type: type,
    device_vendor: vendor,
    device_model: model,
    screen_resolution:
      typeof window === "undefined"
        ? null
        : `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}x`,
    user_agent: ua,
  };
  info.device_model = refineModel(info);
  return info;
}

let geoCache: GeoInfo | null = null;
let geoInFlight: Promise<GeoInfo> | null = null;

const EMPTY_GEO: GeoInfo = {
  ip: null,
  country: null,
  region: null,
  city: null,
  latitude: null,
  longitude: null,
  isp: null,
  asn: null,
};

async function lookupGeo(): Promise<GeoInfo> {
  // Server-side lookup first: it sees the real client IP and is never blocked by
  // ad blockers or CORS, which is what left every session row without a location.
  try {
    const geo = await resolveServerGeo();
    if (geo && (geo.ip || geo.country)) return { ...EMPTY_GEO, ...geo };
  } catch {
    /* fall through to the browser lookup */
  }
  try {
    const res = await fetch("https://ipapi.co/json/", {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error("geo lookup failed");
    const j = (await res.json()) as Record<string, any>;
    return {
      ip: j["ip"] ?? null,
      country: j["country_name"] ?? null,
      region: j["region"] ?? null,
      city: j["city"] ?? null,
      latitude: typeof j["latitude"] === "number" ? j["latitude"] : null,
      longitude: typeof j["longitude"] === "number" ? j["longitude"] : null,
      isp: j["org"] ?? null,
      asn: j["asn"] ?? null,
    };
  } catch {
    return EMPTY_GEO;
  }
}

/**
 * Resolves the caller's public IP into country / region / city / coordinates / ISP.
 * Never hangs: a slow lookup resolves as empty geo so callers still persist their row.
 */
export async function resolveGeo(): Promise<GeoInfo> {
  if (geoCache) return geoCache;
  if (!geoInFlight) {
    geoInFlight = lookupGeo()
      .then((g) => {
        if (g.ip || g.country) geoCache = g;
        return g;
      })
      .catch(() => EMPTY_GEO)
      .finally(() => {
        geoInFlight = null;
      });
  }
  const pending = geoInFlight;
  return Promise.race([
    pending,
    new Promise<GeoInfo>((resolve) => setTimeout(() => resolve(EMPTY_GEO), 4000)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Activity stream + DOM capture                                       */
/* ------------------------------------------------------------------ */

export type DomEvent = { t: number; kind: string; target?: string; value?: string };

const buffer: DomEvent[] = [];
let started = 0;
let capturing = false;

function describe(el: Element | null): string {
  if (!el) return "unknown";
  const node = el as HTMLElement;
  const text = (node.innerText ?? "").trim().slice(0, 40);
  const tag = node.tagName.toLowerCase();
  const label = node.getAttribute("aria-label") ?? node.getAttribute("title") ?? text;
  return label ? `${tag}: ${label}` : tag;
}

/** Starts capturing coarse UI interactions used to rebuild a session replay. */
export function startDomCapture() {
  if (capturing || typeof window === "undefined") return;
  capturing = true;
  started = Date.now();

  const push = (e: DomEvent) => {
    buffer.push(e);
    if (buffer.length > 400) buffer.shift();
  };

  window.addEventListener(
    "click",
    (e) =>
      push({
        t: Date.now() - started,
        kind: "click",
        target: describe(e.target as Element),
      }),
    { capture: true, passive: true },
  );
  window.addEventListener(
    "input",
    (e) => {
      const el = e.target as HTMLInputElement | null;
      const type = el?.getAttribute("type") ?? "text";
      push({
        t: Date.now() - started,
        kind: "input",
        target: describe(el),
        value: type === "password" ? "•••" : (el?.value ?? "").slice(0, 24),
      });
    },
    { capture: true, passive: true },
  );
  let lastScroll = 0;
  window.addEventListener(
    "scroll",
    () => {
      const now = Date.now();
      if (now - lastScroll < 1500) return;
      lastScroll = now;
      push({ t: now - started, kind: "scroll", value: String(Math.round(window.scrollY)) });
    },
    { passive: true },
  );
}

function drainDomEvents(): DomEvent[] {
  const out = buffer.slice();
  buffer.length = 0;
  return out;
}

export type ActionType =
  | "navigation"
  | "interaction"
  | "order"
  | "deposit"
  | "withdrawal"
  | "kyc"
  | "settings"
  | "auth"
  | "support";

/**
 * Periodically ships buffered UI interactions so the admin replay player always has
 * recorded timelines, even when the user never triggers a business action.
 */
export function startInteractionFlush(intervalMs = 20_000) {
  if (typeof window === "undefined") return () => {};
  const flush = () => {
    if (buffer.length === 0) return;
    const count = buffer.length;
    void logActivity("interaction", `${count} UI interactions`, { count });
  };
  const id = window.setInterval(flush, intervalMs);
  window.addEventListener("pagehide", flush);
  return () => {
    window.clearInterval(id);
    window.removeEventListener("pagehide", flush);
  };
}

/** Records one user action (plus recent UI interactions) to the live audit stream. */
export async function logActivity(
  actionType: ActionType,
  label: string,
  metadata: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    const geo = await resolveGeo();
    await supabase.from("user_activity_logs").insert({
      user_id: userId,
      device_id: currentDeviceId(),
      action_type: actionType,
      route: window.location.pathname,
      label,
      ip_address: geo.ip,
      city: geo.city,
      country: geo.country,
      metadata_json: metadata as never,
      dom_events_json: drainDomEvents() as never,
    });
  } catch {
    /* telemetry must never break the app */
  }
}
