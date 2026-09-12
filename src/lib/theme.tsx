import { useCallback, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type Theme = "light" | "dark" | "system";
export const THEME_KEY = "velocity.theme";

/** Inline script injected before hydration so the theme class is applied without flash. */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"dark";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){document.documentElement.classList.add("dark");}})();`;

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  window.dispatchEvent(new CustomEvent<Theme>("velocity:theme", { detail: theme }));
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const next = readTheme();
    setThemeState(next);
    applyTheme(next);
    const onChange = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readTheme() === "system") applyTheme("system");
    };
    window.addEventListener("velocity:theme", onChange);
    media.addEventListener("change", onSystemChange);
    return () => {
      window.removeEventListener("velocity:theme", onChange);
      media.removeEventListener("change", onSystemChange);
    };
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

  return { theme, setTheme };
}

/** The only platform theme control, presented inside Profile preferences. */
export function ThemeSetting() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold">Appearance</p>
        <p className="text-xs text-muted-foreground">Choose light, dark, or follow your device.</p>
      </div>
      <div className="grid grid-cols-3 rounded-lg border border-border p-0.5">
        {(
          [
            { id: "light" as const, label: "Light", Icon: Sun },
            { id: "dark" as const, label: "Dark", Icon: Moon },
            { id: "system" as const, label: "System", Icon: Monitor },
          ]
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            className={`flex min-h-9 touch-manipulation items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
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
