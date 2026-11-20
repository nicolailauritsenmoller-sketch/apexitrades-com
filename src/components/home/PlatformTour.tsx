import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TourVideoPlayer } from "@/components/home/TourVideoPlayer";
import tourThumb from "@/assets/platform-tour-thumb.jpg";
import tourVideo from "@/assets/platform-tour-v2-1080p.webm.asset.json";
import tourVideoSd from "@/assets/platform-tour-v2-720p.webm.asset.json";
import tourVideoMp4 from "@/assets/platform-tour-v2-1080p.mp4.asset.json";
import tourVideoSdMp4 from "@/assets/platform-tour-v2-720p.mp4.asset.json";

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
        <Button
          variant="ghost"
          type="button"
          onClick={() => setOpen(true)}
          className="group relative m-4 block h-auto w-[calc(100%-2rem)] touch-manipulation overflow-hidden rounded-xl border border-border p-0 text-left"
          aria-label="Play Platform Tour"
        >
          <video
            ref={previewRef}
            src={visible ? tourVideoSdMp4.url : undefined}
            poster={tourThumb}
            muted loop playsInline autoPlay={visible && !open} preload="none"
            aria-hidden="true"
            width={1280}
            height={720}
            className={`tour-preview-motion pointer-events-none aspect-video w-full object-cover ${visible && !open ? "tour-preview-running" : ""}`}
          />
          <span className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        </Button>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="z-[120] block h-dvh max-h-dvh w-screen max-w-none gap-0 overflow-y-auto rounded-none border-0 bg-surface p-0 sm:rounded-none">
          <div className="flex min-h-14 items-center px-4 pr-12">
            <DialogTitle className="text-sm font-semibold">Platform Tour</DialogTitle>
          </div>
          <div className="mx-auto w-full max-w-5xl pb-6">
            {open && <TourVideoPlayer hd={{ mp4: tourVideoMp4.url, webm: tourVideo.url }} sd={{ mp4: tourVideoSdMp4.url, webm: tourVideoSd.url }} poster={tourThumb} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
