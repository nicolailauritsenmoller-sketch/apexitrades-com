import { useEffect, useRef, useState } from "react";

/** Returns a transient "flash-up"/"flash-down" class whenever `value` ticks. */
export function usePriceFlash(value: number | undefined | null) {
  const prev = useRef<number | null>(null);
  const [cls, setCls] = useState("");
  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    const last = prev.current;
    prev.current = value;
    if (last == null || last === value) return;
    setCls(value > last ? "flash-up" : "flash-down");
    const t = setTimeout(() => setCls(""), 700);
    return () => clearTimeout(t);
  }, [value]);
  return cls;
}
