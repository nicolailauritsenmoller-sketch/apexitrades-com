import { useEffect, useRef } from "react";

type Pin = {
  id: string;
  userId: string;
  name: string;
  city: string | null;
  country: string | null;
  ip: string | null;
  isp: string | null;
  lat: number | null;
  lng: number | null;
  online: boolean;
};

/**
 * Leaflet map with OpenStreetMap tiles. Loaded lazily on the client only —
 * Leaflet touches `window` at import time.
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
  const pins = sessions.filter((s) => s.lat != null && s.lng != null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !host.current || map.current) return;
      map.current = L.map(host.current, {
        center: [20, 0],
        zoom: 2,
        worldCopyJump: true,
        attributionControl: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      render(L);
    })();

    function render(L: any) {
      if (!layer.current) return;
      layer.current.clearLayers();
      for (const p of pins) {
        const marker = L.circleMarker([p.lat!, p.lng!], {
          radius: 7,
          weight: 2,
          color: p.online ? "#16a34a" : "#94a3b8",
          fillColor: p.online ? "#22c55e" : "#cbd5e1",
          fillOpacity: 0.85,
        });
        marker.bindTooltip(
          `<b>${p.name}</b><br/>${[p.city, p.country].filter(Boolean).join(", ") || "Unknown location"}` +
            `<br/>${p.ip ?? "—"}${p.isp ? ` · ${p.isp}` : ""}`,
          { direction: "top" },
        );
        marker.on("click", () => onPick(p.userId));
        marker.addTo(layer.current);
      }
    }

    if (map.current) {
      void import("leaflet").then((m) => render(m.default));
    }

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
