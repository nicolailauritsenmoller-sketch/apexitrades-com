import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "light" | "dark";
export const THEME_KEY = "velocity.theme";

/** Inline script injected before hydration so the theme class is applied without flash. */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var r=document.documentElement;r.classList.toggle("dark",t==="dark");}catch(e){}})();`;

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new CustomEvent<Theme>("velocity:theme", { detail: theme }));
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const next = readTheme();
    setThemeState(next);
    applyTheme(next);
    const onChange = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail);
    window.addEventListener("velocity:theme", onChange);
    return () => window.removeEventListener("velocity:theme", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme],
  );

  return { theme, setTheme, toggle };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`grid size-9 shrink-0 touch-manipulation place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

/** Labelled light/dark switch for settings menus. */
export function ThemeSetting() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div>
        <p className="text-sm font-semibold">Appearance</p>
        <p className="text-xs text-muted-foreground">Choose light or dark interface.</p>
      </div>
      <div className="inline-flex rounded-full border border-border p-0.5">
        {(
          [
            { id: "light" as const, label: "Light", Icon: Sun },
            { id: "dark" as const, label: "Dark", Icon: Moon },
          ]
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            className={`flex touch-manipulation items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              theme === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
