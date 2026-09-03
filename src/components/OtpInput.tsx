import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
};

/** Six-box numeric code entry used for signup and password-reset verification. */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  invalid,
  autoFocus,
}: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function commit(next: string, focusAt: number) {
    onChange(next.slice(0, length));
    refs.current[Math.max(0, Math.min(focusAt, length - 1))]?.focus();
  }

  function setDigit(index: number, digit: string) {
    const clean = digit.replace(/\D/g, "");
    if (!clean) {
      onChange(digits.map((d, i) => (i === index ? "" : d)).join("").trimEnd());
      return;
    }
    const chars = clean.split("");
    const next = [...digits];
    chars.forEach((c, offset) => {
      if (index + offset < length) next[index + offset] = c;
    });
    commit(next.join(""), index + chars.length);
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
          aria-invalid={invalid}
          onFocus={(e) => e.currentTarget.select()}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
            if (!pasted) return;
            commit(pasted.slice(0, length), pasted.length);
          }}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          className={`num size-11 rounded-lg border bg-background text-center text-lg font-bold text-foreground outline-none transition-colors disabled:opacity-50 ${
            invalid
              ? "border-destructive focus:border-destructive"
              : "border-input focus:border-ring"
          }`}
        />
      ))}
    </div>
  );
}
