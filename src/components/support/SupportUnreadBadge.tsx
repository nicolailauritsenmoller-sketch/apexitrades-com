import { Headphones } from "lucide-react";
import { useSupportUnread } from "@/lib/use-support-unread";

/** Red counter dot for unread support replies. Renders nothing when zero. */
export function SupportUnreadBadge({ className = "" }: { className?: string }) {
  const n = useSupportUnread();
  if (!n) return null;
  return (
    <span
      aria-label={`${n} unread support message${n === 1 ? "" : "s"}`}
      className={`absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-bear px-1 text-[10px] font-bold leading-none text-bear-foreground ${className}`}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

/** Header support launcher with unread counter. */
export function SupportNavButton() {
  return (
    <button
      type="button"
      aria-label="Support messages"
      onClick={() => window.dispatchEvent(new CustomEvent("velocity:open-chat", { detail: {} }))}
      className="relative grid size-9 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Headphones className="size-4.5" />
      <SupportUnreadBadge className="right-0 top-0" />
    </button>
  );
}
