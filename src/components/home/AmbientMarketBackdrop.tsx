import { useEffect, useRef, useState } from "react";
import videoAsset from "@/assets/market-ambient.mp4.asset.json";
import posterImg from "@/assets/market-ambient-poster.jpg";

type Props = {
  /** Opacity of the media layer (0-1). */
  intensity?: number;
  className?: string;
};

/**
 * Ambient looping market video used as a section background.
 * - Plays only while the section is on screen (smooth scroll performance)
 * - Video is desktop-only; mobile falls back to a static high-res graphic
 */
export function AmbientMarketBackdrop({ intensity = 0.35, className = "" }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    io.observe(host);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) void v.play().catch(() => undefined);
    else v.pause();
  }, [visible]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Mobile / reduced-motion: static graphic */}
      <img
        src={posterImg}
        alt=""
        loading="lazy"
        width={1920}
        height={1088}
        className="absolute inset-0 size-full object-cover md:hidden"
        style={{ opacity: intensity }}
      />
      {/* Desktop: looping ambient video */}
      <video
        ref={videoRef}
        src={videoAsset.url}
        poster={posterImg}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 hidden size-full object-cover md:block motion-reduce:hidden"
        style={{ opacity: intensity }}
      />
      {/* Contrast mask */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/40 to-background" />
    </div>
  );
}
