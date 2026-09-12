import { useEffect, useRef } from "react";

type Pin = {
  id: string;
  userId: string;
  name: string;
  email?: string | null;
  city: string | null;
  country: string | null;
  ip: string | null;
  isp: string | null;
  deviceModel?: string | null;
  lat: number | null;
  lng: number | null;
  online: boolean;
};

const esc = (v: unknown) =>
  String(v ?? "—").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

/**
 * Leaflet map with OpenStreetMap tiles. Loaded lazily on the client only —
 * Leaflet touches `window` at import time. Online sessions render as blinking
 * green beacons; offline ones as static slate dots.
 */
export default function SessionMap({
  sessions,
  onPick,
}: {
  sessions: Pin[];
  onPick: (userId: string) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const pins = sessions.filter((s) => s.lat != null && s.lng != null);

  useEffect(() => {
    let cancelled = false;

    function render(L: any) {
      if (!layer.current) return;
      layer.current.clearLayers();
      for (const p of pins) {
        const icon = L.divIcon({
          className: "",
          html: `<span class="session-beacon${p.online ? " is-online" : ""}"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const marker = L.marker([p.lat!, p.lng!], { icon, riseOnHover: true });
        const popup = `
          <div style="min-width:190px;line-height:1.45">
            <b>${esc(p.name)}</b><br/>
            <span style="opacity:.8">${esc(p.email)}</span><br/>
            ${esc([p.city, p.country].filter(Boolean).join(", ") || "Unknown location")}<br/>
            IP ${esc(p.ip)}${p.isp ? ` · ${esc(p.isp)}` : ""}<br/>
            <b>${esc(p.deviceModel)}</b><br/>
            <span style="color:${p.online ? "#16a34a" : "#64748b"}">
              ${p.online ? "● Online now" : "○ Offline"}
            </span>
          </div>`;
        marker.bindPopup(popup);
        marker.bindTooltip(popup, { direction: "top", opacity: 0.98 });
        marker.on("click", () => pick.current(p.userId));
        marker.addTo(layer.current);
      }
    }

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !host.current) return;
      if (!map.current) {
        map.current = L.map(host.current, {
          center: [20, 0],
          zoom: 2,
          worldCopyJump: true,
          attributionControl: false,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(
          map.current,
        );
        layer.current = L.layerGroup().addTo(map.current);
      }
      render(L);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessions]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return (
    <div className="relative">
      <div
        ref={host}
        className="h-[320px] w-full overflow-hidden rounded-xl border border-border sm:h-[420px]"
      />
      {pins.length === 0 && (
        <p className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-background/70 text-xs text-muted-foreground">
          No geolocated sessions yet.
        </p>
      )}
    </div>
  );
}
