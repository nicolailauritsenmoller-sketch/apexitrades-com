import { useEffect, useRef } from "react";

/**
 * DOM-reconstructing video player for a recorded rrweb session.
 * Client-only: rrweb-player touches `window`/`document` at import time.
 * Ships with play/pause, a scrubbable timeline with event indicators and
 * 1x / 2x / 4x speed controls.
 */
export default function RrwebPlayer({ events }: { events: any[] }) {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let player: any = null;

    (async () => {
      const mod: any = await import("rrweb-player");
      await import("rrweb-player/dist/style.css");
      if (cancelled || !host.current || events.length < 2) return;
      host.current.innerHTML = "";
      const width = Math.min(host.current.clientWidth || 800, 900);
      player = new (mod.default ?? mod)({
        target: host.current,
        props: {
          events,
          width,
          height: Math.round(width * 0.62),
          autoPlay: true,
          showController: true,
          speedOption: [1, 2, 4],
          mouseTail: { strokeStyle: "#FCD535" },
        },
      });
    })();

    return () => {
      cancelled = true;
      try {
        player?.$destroy?.();
      } catch {
        /* player already torn down */
      }
      if (host.current) host.current.innerHTML = "";
    };
  }, [events]);

  if (events.length < 2) {
    return (
      <p className="grid h-48 place-items-center rounded-lg border border-border bg-secondary/30 text-xs text-muted-foreground">
        This recording is too short to play back.
      </p>
    );
  }

  return <div ref={host} className="overflow-hidden rounded-lg border border-border" />;
}
