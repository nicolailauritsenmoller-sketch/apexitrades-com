import shieldMark from "@/assets/velocity-shield.png";

/** Isolated shield emblem - for compact layouts, headers and avatars. */
export function BrandMark({
  className = "size-9",
  alt = "Velocity Trade",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={shieldMark}
      alt={alt}
      width={1024}
      height={1024}
      className={`${className} shrink-0 object-contain`}
    />
  );
}

/** Full lockup - shield emblem plus the VELOCITY TRADE wordmark. */
export function BrandLockup({
  className = "",
  markClassName = "size-9",
  textClassName = "truncate font-display text-sm font-bold tracking-tight",
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <BrandMark className={markClassName} />
      <span className={textClassName}>VELOCITY TRADE</span>
    </span>
  );
}

export { shieldMark };
