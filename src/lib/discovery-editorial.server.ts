import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function editorialClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Editorial service unavailable");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } } });
}
export async function readModeration() {
  const { data, error } = await editorialClient().from("discovery_moderation").select("content_kind,content_id,status,priority");
  if (error) throw new Error("Editorial moderation unavailable");
  return data ?? [];
}
export async function publishedArticles() {
  const { data, error } = await editorialClient().from("discovery_articles").select("id,title,excerpt,category,tickers,published_at").order("published_at", { ascending: false }).limit(100);
  if (error) throw new Error("Editorial articles unavailable");
  return (data ?? []).flatMap(row => row.published_at ? [{ id: `velocity:${row.id}`, title: row.title, excerpt: row.excerpt, category: row.category as import("./news.functions").NewsCategory, tickers: row.tickers, publishedAt: row.published_at, source: "Velocity Research Desk", url: "https://veloxitrade-com.lovable.app/dashboard", domain: "veloxitrade-com.lovable.app", region: "global" as const, image: null }] : []);
}