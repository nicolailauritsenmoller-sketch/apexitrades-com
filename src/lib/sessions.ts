import { supabase } from "@/integrations/supabase/client";

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
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "Unknown browser";

  const os =
    /Windows NT 10/.test(ua) ? "Windows"
    : /Windows/.test(ua) ? "Windows"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
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
  const deviceId = currentDeviceId();
  const { browser, os } = parseUserAgent(navigator.userAgent);
  const net = await lookupNetwork();

  await supabase.from("user_sessions").upsert(
    {
      user_id: userId,
      device_id: deviceId,
      browser,
      os,
      ip_address: net.ip,
      country: net.country,
      user_agent: navigator.userAgent,
      last_active_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_id" },
  );
}

export async function listSessions(): Promise<SessionRow[]> {
  const active = currentDeviceId();
  const { data, error } = await supabase
    .from("user_sessions")
    .select("*")
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
  const { error } = await supabase.from("user_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function signOutEverywhere() {
  const active = currentDeviceId();
  await supabase.from("user_sessions").delete().neq("device_id", active);
  await supabase.from("user_sessions").delete().eq("device_id", active);
  await supabase.auth.signOut({ scope: "global" });
}
