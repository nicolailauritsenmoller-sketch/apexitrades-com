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

const APPLE_HINTS: Record<string, string> = {
  "iPhone17": "iPhone 16 Pro",
  "iPhone16": "iPhone 15 Pro",
  "iPad": "iPad",
};

/** Best-effort mapping of Apple/desktop hardware into a friendly model name. */
function refineModel(info: DeviceInfo): string {
  if (info.device_model) {
    return [info.device_vendor, info.device_model].filter(Boolean).join(" ");
  }
  if (info.os_name === "iOS") return "iPhone";
  if (info.os_name === "macOS") {
    const chip = /Apple/.test(info.user_agent) ? "Apple Silicon" : "Intel";
    return `Mac (${chip})`;
  }
  if (info.os_name === "Windows") {
    const v = info.os_version ?? "";
    return v.startsWith("11") || v === "10" ? "Windows PC" : "Windows PC";
  }
  if (info.os_name === "Android") return "Android device";
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
  | "order"
  | "deposit"
  | "withdrawal"
  | "kyc"
  | "settings"
  | "auth"
  | "support";

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
