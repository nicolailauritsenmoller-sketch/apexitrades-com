import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type TourSource = { mp4: string; webm: string };

export function TourVideoPlayer({ hd, poster }: { hd: TourSource; sd?: TourSource; poster: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    void video.play().catch(() => setPlaying(false));
  }, []);

  const play = () => {
    const video = videoRef.current;
    if (video) void video.play().catch(() => setPlaying(false));
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-y border-border bg-surface px-4 py-2">
        <Button variant="ghost" size="icon" aria-label={playing ? "Pause tour" : "Play tour"} title={playing ? "Pause tour" : "Play tour"}
          onClick={() => playing ? videoRef.current?.pause() : play()}>
          {playing ? <Pause /> : <Play />}
        </Button>
      </div>
      <div className="relative aspect-video w-full bg-background">
        <video ref={videoRef} poster={poster} controls muted={false} autoPlay playsInline preload="auto"
          aria-label="Velocity Trade 60-second platform walkthrough" className="h-full w-full"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onError={() => { setError(true); setReady(false); }}
          onLoadedMetadata={() => { setError(false); setReady(true); }}>
          {/* H.264 first for Safari/iOS; VP9 WebM as fallback. Error on the last source means nothing could play. */}
          <source src={hd.mp4} type="video/mp4" />
          <source src={hd.webm} type="video/webm"
            onError={() => { setError(true); setReady(false); }} />
        </video>
        {!ready && !error && <span role="status" className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/90 px-3 py-2 text-xs text-muted-foreground">Loading video...</span>}
        {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 p-4 text-center text-sm">
          <p>The tour could not load. Please try again.</p>
          <Button variant="outline" onClick={() => { setError(false); videoRef.current?.load(); }}>Retry video</Button>
        </div>}
      </div>
    </>
  );
}
