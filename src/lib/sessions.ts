import { supabase } from "@/integrations/supabase/client";
import { detectDevice, resolveGeo } from "@/lib/telemetry";

const DEVICE_KEY = "velocity.device_id";

export function currentDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function parseUserAgent(ua: string) {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : "Unknown browser";

  const os = /Windows NT 10/.test(ua)
    ? "Windows"
    : /Windows/.test(ua)
      ? "Windows"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Android/.test(ua)
          ? "Android"
          : /Mac OS X/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "Unknown OS";

  return { browser, os };
}

async function lookupNetwork(): Promise<{ ip: string | null; country: string | null }> {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!res.ok) throw new Error("lookup failed");
    const json = (await res.json()) as { ip?: string; country_name?: string };
    return { ip: json.ip ?? null, country: json.country_name ?? null };
  } catch {
    return { ip: null, country: null };
  }
}

export type SessionRow = {
  id: string;
  deviceId: string;
  browser: string;
  os: string;
  ip: string | null;
  country: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
};

/** Records (or refreshes) the current browser as an active device for the signed-in user. */
export async function registerCurrentDevice(userId: string) {
  if (typeof window === "undefined") return;
  const [device, geo] = await Promise.all([detectDevice(), resolveGeo()]);

  await supabase.from("user_sessions").upsert(
    {
      user_id: userId,
      device_id: currentDeviceId(),
      browser: device.browser,
      os: device.os_name,
      ip_address: geo.ip,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      latitude: geo.latitude,
      longitude: geo.longitude,
      isp: geo.isp,
      asn: geo.asn,
      device_type: device.device_type,
      device_vendor: device.device_vendor,
      device_model: device.device_model,
      os_version: device.os_version,
      browser_version: device.browser_version,
      screen_resolution: device.screen_resolution,
      is_online: true,
      user_agent: device.user_agent,
      current_path: window.location.pathname,
      last_active_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id,device_id" },
  );
}

/**
 * Lightweight presence ping: refreshes `last_active_at` and the page the user is
 * currently viewing so the operations console can show who is online.
 */
export async function heartbeat(userId: string, path: string) {
  if (typeof window === "undefined") return;
  const [device, geo] = await Promise.all([detectDevice(), resolveGeo()]);
  await supabase.from("user_sessions").upsert(
    {
      user_id: userId,
      device_id: currentDeviceId(),
      browser: device.browser,
      os: device.os_name,
      ip_address: geo.ip,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      latitude: geo.latitude,
      longitude: geo.longitude,
      isp: geo.isp,
      device_type: device.device_type,
      device_vendor: device.device_vendor,
      device_model: device.device_model,
      os_version: device.os_version,
      browser_version: device.browser_version,
      screen_resolution: device.screen_resolution,
      is_online: true,
      user_agent: device.user_agent,
      current_path: path,
      last_active_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id,device_id" },
  );
}

export async function listSessions(): Promise<SessionRow[]> {
  const active = currentDeviceId();
  const { data: me } = await supabase.auth.getUser();
  const userId = me.user?.id;
  if (!userId) return [];

  // Device management only ever shows the signed-in account's own devices,
  // even for staff accounts that can read the monitoring table.
  const { data, error } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("last_active_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((s) => ({
    id: s.id,
    deviceId: s.device_id,
    browser: s.browser,
    os: s.os,
    ip: s.ip_address,
    country: s.country,
    lastActiveAt: s.last_active_at,
    isCurrent: s.device_id === active,
  }));
}

export async function removeSession(id: string) {
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("user_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", me.user.id);
  if (error) throw new Error(error.message);
}

export async function signOutEverywhere() {
  const { data: me } = await supabase.auth.getUser();
  if (me.user) {
    await supabase.from("user_sessions").delete().eq("user_id", me.user.id);
  }
  await supabase.auth.signOut({ scope: "global" });
}
