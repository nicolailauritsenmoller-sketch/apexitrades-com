import { useEffect, useRef } from "react";
import videoAsset from "@/assets/market-ambient.mp4.asset.json";
import videoWebm from "@/assets/market-ambient.webm.asset.json";
import posterImg from "@/assets/market-ambient-poster.jpg";

type Props = {
  /** Opacity of the media layer (0-1). */
  intensity?: number;
  /** Use fixed positioning so the video spans the whole page while scrolling. */
  fixed?: boolean;
  className?: string;
};

/**
 * Ambient looping market video used as a page/section background.
 * Autoplays muted + inline, loops continuously, and never blocks pointer events.
 */
export function AmbientMarketBackdrop({
  intensity = 0.45,
  fixed = false,
  className = "",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => void v.play().catch(() => undefined);
    tryPlay();
    // Some browsers pause background media on tab switch — resume on return.
    document.addEventListener("visibilitychange", tryPlay);
    window.addEventListener("focus", tryPlay);
    return () => {
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("focus", tryPlay);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${fixed ? "fixed" : "absolute"} inset-0 z-0 h-full w-full overflow-hidden ${className}`}
    >
      <video
        ref={videoRef}
        poster={posterImg}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        className="pointer-events-none absolute inset-0 size-full h-full w-full object-cover"
        style={{ opacity: intensity }}
      >
        <source src={videoWebm.url} type="video/webm" />
        <source src={videoAsset.url} type="video/mp4" />
      </video>
      {/* Contrast mask — keeps headlines legible over the footage */}
      <div className="absolute inset-0 bg-background/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/25 to-background/70" />
    </div>
  );
}
