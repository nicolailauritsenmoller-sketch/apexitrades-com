import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { translateTexts } from "@/lib/translate.functions";

/**
 * Runtime translation layer.
 *
 * Translates every rendered UI string (text nodes + placeholder/aria-label/title)
 * on every route the moment the language changes - no reload required. Results are
 * cached in localStorage per language so repeat visits are instant and free.
 * Numbers, tickers and prices are deliberately skipped.
 */

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "SVG", "PATH"]);
const BATCH = 60;
const MAX_BATCHES_PER_PASS = 6;

function cacheKey(lang: string) {
  return `velocity.i18n-cache.${lang}`;
}

function readCache(lang: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(lang)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeCache(lang: string, cache: Record<string, string>) {
  try {
    const entries = Object.entries(cache).slice(-4000);
    localStorage.setItem(cacheKey(lang), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* storage full or unavailable */
  }
}

/** Only translate human sentences - never prices, tickers or symbols. */
function translatable(value: string) {
  const s = value.trim();
  if (s.length < 2 || s.length > 300) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  if (/^[\d\s.,:%+\-$€£¥/]+$/.test(s)) return false;
  if (/^[A-Z0-9]{2,6}([/-][A-Z0-9]{2,6})?$/.test(s)) return false; // BTC, XAU/USD, BTC-PERP
  return true;
}

function skipped(el: Element | null) {
  let node: Element | null = el;
  while (node) {
    if (SKIP_TAGS.has(node.tagName)) return true;
    if (node.hasAttribute?.("data-no-translate")) return true;
    if (node.classList?.contains("num")) return true;
    node = node.parentElement;
  }
  return false;
}

type Target =
  | { kind: "text"; node: Text; original: string }
  | { kind: "attr"; el: Element; attr: string; original: string };

function collect(root: Node): Target[] {
  const out: Target[] = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n = walker.nextNode();
  while (n) {
    const text = n as Text;
    const el = text.parentElement;
    const stored = el?.getAttribute("data-i18n-src");
    const original = (stored && el?.childNodes.length === 1 ? stored : text.nodeValue) ?? "";
    if (!skipped(el) && translatable(original)) {
      out.push({ kind: "text", node: text, original: original.trim() });
    }
    n = walker.nextNode();
  }

  const rootEl = root instanceof Element ? root : document.body;
  const scope: Element[] = [
    ...(root instanceof Element ? [rootEl] : []),
    ...Array.from(rootEl.querySelectorAll<Element>("[placeholder],[aria-label],[title]")),
  ];
  for (const el of scope) {
    if (skipped(el)) continue;
    for (const attr of ["placeholder", "aria-label", "title"]) {
      const stored = el.getAttribute(`data-i18n-${attr}`);
      const original = stored ?? el.getAttribute(attr);
      if (original && translatable(original)) {
        out.push({ kind: "attr", el, attr, original: original.trim() });
      }
    }
  }

  return out;
}

function restoreOriginals() {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-i18n-src]"))) {
    const src = el.getAttribute("data-i18n-src");
    if (src != null && el.childNodes.length === 1 && el.firstChild?.nodeType === Node.TEXT_NODE) {
      el.firstChild.nodeValue = src;
    }
    el.removeAttribute("data-i18n-src");
  }
  for (const attr of ["placeholder", "aria-label", "title"]) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-i18n-${attr}]`))) {
      const src = el.getAttribute(`data-i18n-${attr}`);
      if (src != null) el.setAttribute(attr, src);
      el.removeAttribute(`data-i18n-${attr}`);
    }
  }
}

export function AutoTranslate() {
  const { lang } = useI18n();
  const translate = useServerFn(translateTexts);
  const running = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (lang === "en") {
      restoreOriginals();
      return;
    }

    let cancelled = false;
    const cache = readCache(lang);

    const apply = (target: Target, translated: string) => {
      if (target.kind === "text") {
        const el = target.node.parentElement;
        if (el && el.childNodes.length === 1) el.setAttribute("data-i18n-src", target.original);
        target.node.nodeValue = translated;
      } else {
        target.el.setAttribute(`data-i18n-${target.attr}`, target.original);
        target.el.setAttribute(target.attr, translated);
      }
    };

    const pass = async () => {
      if (cancelled) return;
      if (running.current) {
        pending.current = true;
        return;
      }
      running.current = true;
      try {
        const targets = collect(document.body);
        const missing: string[] = [];
        for (const target of targets) {
          const hit = cache[target.original];
          if (hit) apply(target, hit);
          else if (!missing.includes(target.original)) missing.push(target.original);
        }
        if (missing.length === 0) return;

        for (let i = 0; i < missing.length && i < BATCH * MAX_BATCHES_PER_PASS; i += BATCH) {
          const chunk = missing.slice(i, i + BATCH);
          const result = await translate({ data: { lang, texts: chunk } });
          if (cancelled) return;
          chunk.forEach((src, idx) => {
            cache[src] = result[idx] ?? src;
          });
          writeCache(lang, cache);
          for (const target of collect(document.body)) {
            const hit = cache[target.original];
            if (hit) apply(target, hit);
          }
        }
      } catch {
        /* keep original copy on failure */
      } finally {
        running.current = false;
        if (pending.current && !cancelled) {
          pending.current = false;
          void pass();
        }
      }
    };

    void pass();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void pass(), 350);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [lang, translate]);

  return null;
}
