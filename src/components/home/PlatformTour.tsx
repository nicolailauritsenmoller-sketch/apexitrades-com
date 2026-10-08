import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TourVideoPlayer } from "@/components/home/TourVideoPlayer";
import tourThumb from "@/assets/platform-tour-thumb.jpg";
import tourVideo from "@/assets/platform-tour-1080p.webm.asset.json";
import tourVideoSd from "@/assets/platform-tour-720p.webm.asset.json";

export function PlatformTourSection() {
  const [open, setOpen] = useState(false);
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
              <span className="absolute inset-0 motion-safe:animate-ping rounded-full bg-primary/40" />
              <Play className="relative size-7 fill-current" />
            </span>
          </span>
          <span className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">Play Platform Tour (60 Sec)</span>
            <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
              Watch 60-Second Walkthrough
            </span>
          </span>
        </Button>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="z-[120] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl gap-0 overflow-y-auto border-border bg-surface p-0">
          <div className="flex min-h-14 items-center px-4 pr-12">
            <DialogTitle className="text-sm font-semibold">Platform Tour</DialogTitle>
          </div>
          {open && <TourVideoPlayer hdUrl={tourVideo.url} sdUrl={tourVideoSd.url} poster={tourThumb} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
