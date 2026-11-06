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
 *
 * Fresh languages apply in two stages so the switch feels instant:
 *  1. every string already in the cache is applied synchronously in the same pass;
 *  2. the remaining strings are fetched in parallel batches and applied the
 *     moment each batch returns - the whole page lands within about a second.
 */

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "SVG", "PATH"]);
const BATCH = 60;
const CONCURRENCY = 3;
const MAX_BATCHES_PER_PASS = 24;

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
  // Keep the latest server fn in a ref so the pass effect depends only on the
  // language; an unstable fn reference would otherwise cancel in-flight passes
  // on every render and stall translation until the page goes idle.
  const translateRef = useRef(translate);
  translateRef.current = translate;
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

    /** Applies every cached translation currently missing from the DOM. */
    const applyCached = (): string[] => {
      const targets = collect(document.body);
      const missing: string[] = [];
      for (const target of targets) {
        const hit = cache[target.original];
        if (hit) apply(target, hit);
        else if (!missing.includes(target.original)) missing.push(target.original);
      }
      return missing;
    };

    const pass = async () => {
      if (cancelled) return;
      if (running.current) {
        pending.current = true;
        return;
      }
      running.current = true;
      try {
        // Stage 1: synchronous cache sweep - instant for repeat languages.
        const missing = applyCached();
        if (missing.length === 0) return;

        // Stage 2: fetch the rest in parallel batches, applying each batch as
        // soon as it lands so the page fills in progressively within a second.
        const chunks: string[][] = [];
        for (let i = 0; i < missing.length && i < BATCH * MAX_BATCHES_PER_PASS; i += BATCH) {
          chunks.push(missing.slice(i, i + BATCH));
        }
        let cursor = 0;
        const worker = async () => {
          while (!cancelled) {
            const idx = cursor++;
            const chunk = chunks[idx];
            if (!chunk) return;
            try {
              const result = await translateRef.current({ data: { lang, texts: chunk } });
              if (cancelled) return;
              chunk.forEach((src, i2) => {
                cache[src] = result[i2] ?? src;
              });
              writeCache(lang, cache);
              applyCached();
            } catch {
              /* keep original copy on failure */
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => worker()),
        );
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
      timer = setTimeout(() => void pass(), 150);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [lang]);

  return null;
}
