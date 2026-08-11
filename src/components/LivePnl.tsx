import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/instruments";

/**
 * Running profit/loss readout. While `live` is true the value flashes bright
 * green on an upward move and bright red on a downward move. Once the trade
 * settles the flashing stops and the final figure is rendered statically.
 */
export function LivePnl({
  value,
  currency,
  live = false,
  className = "",
  size = "sm",
}: {
  value: number | null;
  currency: string;
  live?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const prev = useRef<number | null>(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!live || value == null) return;
    const before = prev.current;
    prev.current = value;
    if (before == null || before === value) return;
    setDir(value > before ? "up" : "down");
    const id = setTimeout(() => setDir(null), 650);
    return () => clearTimeout(id);
  }, [value, live]);

  if (value == null) return <span className="text-muted-foreground">—</span>;

  const positive = value >= 0;
  const text = `${positive ? "+" : "-"}${formatMoney(Math.abs(value), currency)}`;
  const sizeClass = size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-sm";

  return (
    <span
      key={dir ?? "idle"}
      aria-live={live ? "polite" : undefined}
      className={`num inline-block rounded-md px-1.5 py-0.5 font-bold tabular-nums transition-colors ${sizeClass} ${
        positive ? "text-bull" : "text-bear"
      } ${dir === "up" ? "flash-up" : dir === "down" ? "flash-down" : ""} ${className}`}
    >
      {text}
    </span>
  );
}
