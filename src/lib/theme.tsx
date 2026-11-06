import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ThemeVariant = "classic" | "midnight" | "obsidian";
export const THEME_KEY = "velocity.theme";
export const THEME_VARIANT_KEY = "velocity.theme-variant";
export const DEFAULT_THEME: Theme = "dark";
export const DEFAULT_THEME_VARIANT: ThemeVariant = "classic";

/** Inline script injected before hydration so theme class and variant apply without flash. */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"${DEFAULT_THEME}";var v=localStorage.getItem("${THEME_VARIANT_KEY}")||"${DEFAULT_THEME_VARIANT}";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";if(v==="midnight"||v==="obsidian"){document.documentElement.setAttribute("data-variant",v);}else{document.documentElement.removeAttribute("data-variant");}}catch(e){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}})();`;

function readTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return DEFAULT_THEME;
}

function readVariant(): ThemeVariant {
  if (typeof window === "undefined") return DEFAULT_THEME_VARIANT;
  const stored = localStorage.getItem(THEME_VARIANT_KEY);
  return stored === "midnight" || stored === "obsidian" ? stored : DEFAULT_THEME_VARIANT;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  window.dispatchEvent(new CustomEvent<Theme>("velocity:theme", { detail: theme }));
}

function applyVariant(variant: ThemeVariant) {
  const root = document.documentElement;
  if (variant === "midnight" || variant === "obsidian") {
    root.setAttribute("data-variant", variant);
  } else {
    root.removeAttribute("data-variant");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [variant, setVariantState] = useState<ThemeVariant>(DEFAULT_THEME_VARIANT);

  useEffect(() => {
    const next = readTheme();
    setThemeState(next);
    applyTheme(next);
    const nextVariant = readVariant();
    setVariantState(nextVariant);
    applyVariant(nextVariant);
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

  const setVariant = useCallback((next: ThemeVariant) => {
    setVariantState(next);
    applyVariant(next);
    try {
      localStorage.setItem(THEME_VARIANT_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return { theme, setTheme, variant, setVariant };
}
