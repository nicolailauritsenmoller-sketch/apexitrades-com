import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Batch UI-string translation used by the runtime auto-translation layer.
 * Keeps every screen in sync with the selected language without shipping a
 * hand-written dictionary for thousands of literals.
 */

const schema = z.object({
  lang: z.string().min(2).max(5),
  texts: z.array(z.string().min(1).max(400)).min(1).max(120),
});

const LANG_NAME: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  zh: "Simplified Chinese",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  ru: "Russian",
  tr: "Turkish",
  hi: "Hindi",
};

export const translateTexts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<string[]> => {
    const target = LANG_NAME[data.lang];
    if (!target || data.lang === "en") return data.texts;

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return data.texts;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content:
                `You localize a crypto/stock trading web app UI into ${target}. ` +
                "Input is a JSON array of UI strings. Return ONLY a JSON array of the same length, " +
                "same order, with each string translated. Keep ticker symbols (BTC, ETH, XAU/USD), " +
                "numbers, currency codes, percentages, dates, brand names and URLs unchanged. " +
                "Keep translations short so they fit the same UI space.",
            },
            { role: "user", content: JSON.stringify(data.texts) },
          ],
        }),
      });
      if (!res.ok) return data.texts;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = json.choices?.[0]?.message?.content ?? "";
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return data.texts;
      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed) || parsed.length !== data.texts.length) return data.texts;
      return parsed.map((v, i) => (typeof v === "string" && v.trim() ? v : data.texts[i]!));
    } catch {
      return data.texts;
    }
  });
