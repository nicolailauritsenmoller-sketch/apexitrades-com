import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TourVideoPlayer } from "@/components/home/TourVideoPlayer";
import tourThumb from "@/assets/platform-tour-thumb.jpg";
import tourVideo from "@/assets/platform-tour-1080p.webm.asset.json";
import tourVideoSd from "@/assets/platform-tour-720p.webm.asset.json";

export function PlatformTourSection() {
  const [open, setOpen] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry?.isIntersecting === true);
    }, { threshold: 0.15 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;
    const syncPlayback = () => {
      if (visible && !open && !document.hidden) {
        void video.play().catch(() => { /* Poster remains visible if autoplay is unavailable. */ });
      } else video.pause();
    };
    syncPlayback();
    document.addEventListener("visibilitychange", syncPlayback);
    return () => document.removeEventListener("visibilitychange", syncPlayback);
  }, [visible, open]);
  return (
    <>
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-sm font-semibold tracking-tight">
            See How Velocity Trade Works
          </h2>
          <span className="num text-xs text-muted-foreground">60-second tour</span>
        </div>
        <Button
          variant="ghost"
          type="button"
          onClick={() => setOpen(true)}
          className="group relative m-4 block h-auto w-[calc(100%-2rem)] touch-manipulation overflow-hidden rounded-xl border border-border p-0 text-left"
          aria-label="Play Platform Tour"
        >
          <video
            ref={previewRef}
            src={visible ? tourVideoSd.url : undefined}
            poster={tourThumb}
            muted loop playsInline autoPlay={visible && !open} preload="none"
            aria-hidden="true"
            width={1280}
            height={720}
            className={`tour-preview-motion pointer-events-none aspect-video w-full object-cover ${visible && !open ? "tour-preview-running" : ""}`}
          />
          <span className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105"
              style={{ boxShadow: "var(--glow-primary)" }}
            >
              <span className="absolute inset-0 motion-safe:animate-ping rounded-full bg-primary/40" />
              <Play className="relative size-7 fill-current" />
            </span>
          </span>
          <span className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
            <span className="tour-audio-badge max-w-full whitespace-normal rounded-lg border border-primary/50 bg-background/90 px-3 py-2 text-xs font-semibold text-foreground backdrop-blur sm:text-sm">
              Tap to Expand &amp; Play Walkthrough with Audio
            </span>
          </span>
        </Button>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="z-[120] block h-dvh max-h-dvh w-screen max-w-none gap-0 overflow-y-auto rounded-none border-0 bg-surface p-0 sm:rounded-none">
          <div className="flex min-h-14 items-center px-4 pr-12">
            <DialogTitle className="text-sm font-semibold">Platform Tour</DialogTitle>
          </div>
          <div className="mx-auto w-full max-w-5xl pb-6">
            {open && <TourVideoPlayer hdUrl={tourVideo.url} sdUrl={tourVideoSd.url} poster={tourThumb} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
