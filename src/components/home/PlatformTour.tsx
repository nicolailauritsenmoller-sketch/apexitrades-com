import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import tourThumb from "@/assets/platform-tour-thumb.jpg";
import tourVideo from "@/assets/platform-tour.mp4.asset.json";

/**
 * Platform Tour video section.
 * Supports direct MP4 (default), YouTube, or Vimeo URLs - set TOUR_VIDEO_URL
 * to an embed URL (e.g. https://www.youtube.com/embed/...) to switch provider.
 * Timestamps seek the native player; for YouTube/Vimeo embeds they reload the
 * embed with the start offset.
 */
const TOUR_VIDEO_URL: string = (tourVideo as { url: string }).url;

const TIMESTAMPS = [
  { seconds: 0, label: "0:00 - Real-Time Terminal & Execution" },
  { seconds: 2, label: "0:02 - Live Charts & Order Book" },
  { seconds: 4, label: "0:04 - Portfolio & Exposure Tracking" },
  { seconds: 6, label: "0:06 - Markets & Account Overview" },
];

function providerOf(url: string): "mp4" | "youtube" | "vimeo" {
  if (/youtube|youtu\.be/.test(url)) return "youtube";
  if (/vimeo/.test(url)) return "vimeo";
  return "mp4";
}

export function PlatformTourSection() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-sm font-semibold tracking-tight">
            See How Velocity Trade Works
          </h2>
          <span className="num text-xs text-muted-foreground">2 min</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative m-4 block w-[calc(100%-2rem)] touch-manipulation overflow-hidden rounded-xl border border-border text-left"
          aria-label="Play Platform Tour (2 Min)"
        >
          <img
            src={tourThumb}
            alt="Velocity Trade terminal preview"
            width={1280}
            height={720}
            loading="lazy"
            className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105"
              style={{ boxShadow: "var(--glow-primary)" }}
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
              <Play className="relative size-7 fill-current" />
            </span>
          </span>
          <span className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Play Platform Tour (2 Min)</span>
            <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
              Watch 2-Min Platform Walkthrough
            </span>
          </span>
        </button>
      </section>
      <PlatformTourModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PlatformTourModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [embedStart, setEmbedStart] = useState(0);
  const provider = providerOf(TOUR_VIDEO_URL);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const seek = (seconds: number) => {
    if (provider === "mp4" && videoRef.current) {
      videoRef.current.currentTime = Math.min(seconds, videoRef.current.duration || seconds);
      videoRef.current.play().catch(() => {});
    } else {
      setEmbedStart(seconds);
    }
  };

  const embedUrl =
    provider === "youtube"
      ? `${TOUR_VIDEO_URL}${TOUR_VIDEO_URL.includes("?") ? "&" : "?"}autoplay=1&start=${embedStart}`
      : provider === "vimeo"
        ? `${TOUR_VIDEO_URL}#t=${embedStart}s`
        : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Platform Tour video"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-4xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Platform Tour</span>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 touch-manipulation items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close video"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="aspect-video w-full bg-black">
          {provider === "mp4" ? (
            <video
              ref={videoRef}
              src={TOUR_VIDEO_URL}
              poster={tourThumb}
              controls
              autoPlay
              playsInline
              className="h-full w-full"
            />
          ) : (
            <iframe
              key={embedStart}
              src={embedUrl ?? TOUR_VIDEO_URL}
              title="Velocity Trade Platform Tour"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {TIMESTAMPS.map((ts) => (
            <button
              key={ts.seconds}
              type="button"
              onClick={() => seek(ts.seconds)}
              className="num touch-manipulation rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {ts.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
