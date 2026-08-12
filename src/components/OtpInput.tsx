import { useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
};

/** Six-box numeric code entry used for signup and password-reset verification. */
export function OtpInput({ value, onChange, length = 6, disabled }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setDigit(index: number, digit: string) {
    const clean = digit.replace(/\D/g, "");
    if (!clean) {
      const next = digits.map((d, i) => (i === index ? "" : d)).join("");
      onChange(next.trimEnd());
      return;
    }
    const chars = clean.split("");
    const next = [...digits];
    chars.forEach((c, offset) => {
      if (index + offset < length) next[index + offset] = c;
    });
    onChange(next.join("").slice(0, length));
    const focusAt = Math.min(index + chars.length, length - 1);
    refs.current[focusAt]?.focus();
  }

  return (
    <div className="flex justify-between gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          className="num size-11 rounded-lg border border-input bg-background text-center text-lg font-bold outline-none transition-colors focus:border-ring disabled:opacity-50"
        />
      ))}
    </div>
  );
}
