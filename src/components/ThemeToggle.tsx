import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/** Compact sun/moon light/dark switch used in the app and landing headers. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`grid size-9 shrink-0 touch-manipulation place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
