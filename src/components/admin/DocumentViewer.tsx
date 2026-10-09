import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { Contrast, RotateCw, ZoomIn, ZoomOut, RefreshCcw } from "lucide-react";

/** Inspection viewer with rotate, zoom and invert/contrast controls. */
export function DocumentViewer({ src, alt }: { src: string; alt: string }) {
  const [rot, setRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [invert, setInvert] = useState(false);
  const [contrast, setContrast] = useState(false);

  const btn =
    "touch-manipulation rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground";
  const on = "border-primary/60 text-primary";

  const [full, setFull] = useState(false);
  return (
    <>
    {full && (
      <div role="dialog" aria-label="Document lightbox" onClick={() => setFull(false)} className="fixed inset-0 z-[200] grid cursor-zoom-out place-items-center bg-black/90 p-4">
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" style={{ transform: `rotate(${rot}deg)` }} />
      </div>
    )}
    <figure className="rounded-lg border border-border bg-muted/30">
      <div className="flex h-56 items-center justify-center overflow-auto">
        <img
          src={src}
          alt={alt}
          onClick={() => setFull(true)}
          className="max-h-full max-w-full cursor-zoom-in object-contain transition-transform"
          style={{
            transform: `rotate(${rot}deg) scale(${zoom})`,
            filter: `${invert ? "invert(1)" : ""} ${contrast ? "contrast(1.8) grayscale(1)" : ""}`.trim() || undefined,
          }}
        />
      </div>
      <figcaption className="flex flex-wrap items-center gap-1 border-t border-border p-1.5">
        <button type="button" aria-label="Rotate 90 degrees" className={btn} onClick={() => setRot((r) => (r + 90) % 360)}>
          <RotateCw className="size-3.5" />
        </button>
        <button type="button" aria-label="Zoom in" className={btn} onClick={() => setZoom((z) => Math.min(4, z + 0.5))}>
          <ZoomIn className="size-3.5" />
        </button>
        <button type="button" aria-label="Zoom out" className={btn} onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}>
          <ZoomOut className="size-3.5" />
        </button>
        <button type="button" aria-label="Invert colours" className={`${btn} ${invert ? on : ""}`} onClick={() => setInvert((v) => !v)}>
          <span className="text-[10px] font-bold">INV</span>
        </button>
        <button type="button" aria-label="High contrast" className={`${btn} ${contrast ? on : ""}`} onClick={() => setContrast((v) => !v)}>
          <Contrast className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Reset view"
          className={btn}
          onClick={() => {
            setRot(0);
            setZoom(1);
            setInvert(false);
            setContrast(false);
          }}
        >
          <RefreshCcw className="size-3.5" />
        </button>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {rot}° · {zoom.toFixed(1)}x
        </span>
        <button type="button" aria-label="Open lightbox" className={btn} onClick={() => setFull(true)}>
          <Maximize2 className="size-3.5" />
        </button>
        <a href={src} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline">
          Open
        </a>
      </figcaption>
    </figure>
    </>
  );
}
