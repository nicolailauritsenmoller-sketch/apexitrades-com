import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHAPTERS = [
  { seconds: 0, label: "0:00 - Public Landing & One-Click Registration" },
  { seconds: 12, label: "0:12 - High-Density Terminal & Order Execution" },
  { seconds: 25, label: "0:25 - Real-Time Crypto Scalping Contracts" },
  { seconds: 38, label: "0:38 - Multi-Asset Portfolio & Exposure Analytics" },
  { seconds: 50, label: "0:50 - Instant Treasury Funding & VIP Concierge Desk" },
];

export function TourVideoPlayer({ hdUrl, sdUrl, poster }: { hdUrl: string; sdUrl: string; poster: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingTime = useRef<number | null>(null);
  const resumePlayback = useRef(true);
  const [quality, setQuality] = useState<"hd" | "sd">("hd");
  const [autoplay, setAutoplay] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const activeChapter = CHAPTERS.reduce((active, chapter, index) => currentTime >= chapter.seconds ? index : active, 0);

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
  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState === 0) {
      pendingTime.current = seconds;
      resumePlayback.current = true;
      return;
    }
    video.currentTime = seconds;
    setCurrentTime(seconds);
    play();
  };
  const changeQuality = (next: "hd" | "sd") => {
    if (next === quality) return;
    const video = videoRef.current;
    pendingTime.current = video?.currentTime ?? currentTime;
    resumePlayback.current = video ? !video.paused : autoplay;
    setReady(false);
    setError(false);
    setQuality(next);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-y border-border bg-surface px-4 py-2">
        <Button variant="ghost" size="icon" aria-label={playing ? "Pause tour" : "Play tour"} title={playing ? "Pause tour" : "Play tour"}
          onClick={() => playing ? videoRef.current?.pause() : play()}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={autoplay} className="size-4 accent-primary"
            onChange={(event) => {
              setAutoplay(event.target.checked);
              if (event.target.checked) play(); else videoRef.current?.pause();
            }} />
          Autoplay
        </label>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Video quality">
          <Button variant={quality === "sd" ? "secondary" : "ghost"} className="min-h-11" size="sm" aria-pressed={quality === "sd"} onClick={() => changeQuality("sd")}>720p</Button>
          <Button variant={quality === "hd" ? "secondary" : "ghost"} className="min-h-11" size="sm" aria-pressed={quality === "hd"} onClick={() => changeQuality("hd")}>1080p HD</Button>
        </div>
      </div>
      <div className="relative aspect-video w-full bg-background">
        <video ref={videoRef} src={quality === "hd" ? hdUrl : sdUrl} poster={poster} controls muted={false} autoPlay={autoplay} playsInline preload="auto"
          aria-label="Velocity Trade 60-second platform walkthrough" className="h-full w-full"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onError={() => { setError(true); setReady(false); }}
          onLoadedMetadata={(event) => {
            setError(false);
            setReady(true);
            const time = pendingTime.current;
            if (time !== null) {
              event.currentTarget.currentTime = time;
              setCurrentTime(time);
              pendingTime.current = null;
              if (resumePlayback.current) play(); else event.currentTarget.pause();
            }
          }} />
        {!ready && !error && <span role="status" className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/90 px-3 py-2 text-xs text-muted-foreground">Loading video...</span>}
        {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 p-4 text-center text-sm">
          <p>The tour could not load. Please try again.</p>
          <Button variant="outline" onClick={() => { setError(false); videoRef.current?.load(); }}>Retry video</Button>
        </div>}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        {CHAPTERS.map((chapter, index) => <Button key={chapter.seconds} variant={activeChapter === index ? "secondary" : "outline"}
          aria-pressed={activeChapter === index} onClick={() => seek(chapter.seconds)}
          className="num min-h-11 max-w-full whitespace-normal rounded-full px-3 py-2 text-left text-xs">
          {chapter.label}
        </Button>)}
      </div>
      <div className="border-t border-border px-4 py-4">
        <Button asChild className="min-h-11 w-full sm:w-auto">
          <Link to="/auth">Try Velocity Trade Demo <ArrowUpRight /></Link>
        </Button>
      </div>
    </>
  );
}