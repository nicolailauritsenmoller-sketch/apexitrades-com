import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

export type ServerGeo = {
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  asn: string | null;
};

const EMPTY: ServerGeo = {
  ip: null,
  country: null,
  region: null,
  city: null,
  latitude: null,
  longitude: null,
  isp: null,
  asn: null,
};

/** Short-lived per-IP cache so a burst of page views does not hammer the lookup API. */
const cache = new Map<string, { at: number; geo: ServerGeo }>();
const TTL = 30 * 60_000;

function headerValue(headers: Record<string, string | undefined>, name: string) {
  return headers[name] ?? headers[name.toLowerCase()] ?? undefined;
}

/**
 * Resolves the caller's IP + location on the server. Browsers frequently block
 * third-party geo endpoints (ad blockers / CORS), which previously left every
 * session row without an IP or coordinates.
 */
export const resolveServerGeo = createServerFn({ method: "GET" }).handler(async () => {
  let headers: Record<string, string | undefined> = {};
  try {
    headers = getRequestHeaders() as unknown as Record<string, string | undefined>;
  } catch {
    return EMPTY;
  }

  const forwarded = headerValue(headers, "x-forwarded-for");
  const ip =
    headerValue(headers, "cf-connecting-ip") ??
    headerValue(headers, "x-real-ip") ??
    (forwarded ? forwarded.split(",")[0]!.trim() : undefined) ??
    null;

  const headerCountry = headerValue(headers, "cf-ipcountry") ?? null;
  const base: ServerGeo = { ...EMPTY, ip, country: headerCountry };

  if (!ip || ip.startsWith("127.") || ip.startsWith("::1") || ip.startsWith("192.168.")) {
    return base;
  }

  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < TTL) return hit.geo;

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as Record<string, any>;
    const geo: ServerGeo = {
      ip,
      country: j["country_name"] ?? headerCountry,
      region: j["region"] ?? null,
      city: j["city"] ?? null,
      latitude: typeof j["latitude"] === "number" ? j["latitude"] : null,
      longitude: typeof j["longitude"] === "number" ? j["longitude"] : null,
      isp: j["org"] ?? null,
      asn: j["asn"] ?? null,
    };
    cache.set(ip, { at: Date.now(), geo });
    return geo;
  } catch {
    cache.set(ip, { at: Date.now(), geo: base });
    return base;
  }
});
