import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  ariaLabel?: string;
};

/**
 * WhatsApp-style composer: Enter inserts a newline, Shift+Enter or Cmd/Ctrl+Enter sends.
 * The textarea grows with content up to ~5 lines, then scrolls internally.
 */
export function ChatComposerInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  maxLength,
  className = "",
  ariaLabel = "Message",
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onSubmit();
        }
        // plain Enter falls through and inserts a newline
      }}
      rows={1}
      enterKeyHint="enter"
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`max-h-[132px] min-h-9 flex-1 resize-none overflow-y-auto touch-manipulation outline-none transition-[height] duration-100 ${className}`}
    />
  );
}
