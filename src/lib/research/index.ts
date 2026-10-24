import "server-only";
import { getDb, newId, nowIso } from "../db";
import { researchEnv } from "../env";
import { safeJson, safeRequest, readStream } from "../security/safe-fetch";
import { decodeEntities, extractMainText, parseDuckDuckGoHtml, type SearchHit } from "./html";

export type ResearchResult = {
  provider: string;
  query: string;
  results: SearchHit[];
  note?: string;
  configured: boolean;
};

export type ResearchProviderInfo = {
  id: string;
  label: string;
  configured: boolean;
  requirements: string;
  note: string;
};

export function researchProviders(): ResearchProviderInfo[] {
  const env = researchEnv();
  return [
    {
      id: "searxng",
      label: "SearXNG (self-hosted)",
      configured: Boolean(env.searxngUrl),
      requirements: "Set SEARXNG_URL to a SearXNG instance with the JSON format enabled.",
      note: "Metasearch, no API key, runs on your own infrastructure.",
    },
    {
      id: "brave",
      label: "Brave Search API",
      configured: Boolean(env.braveKey),
      requirements: "Set BRAVE_SEARCH_API_KEY. Brave offers a free tier with monthly query limits and requires a credit card on some plans — check their current terms.",
      note: "Official JSON search API with its own quota.",
    },
    {
      id: "tavily",
      label: "Tavily Search API",
      configured: Boolean(env.tavilyKey),
      requirements: "Set TAVILY_API_KEY. Tavily's free tier has a monthly credit limit.",
      note: "Search API aimed at LLM agents.",
    },
    {
      id: "duckduckgo",
      label: "DuckDuckGo HTML (no key)",
      configured: env.allowDuckDuckGo,
      requirements: "Enabled by default. Disable with RESEARCH_DISABLE_DUCKDUCKGO=1.",
      note: "Uses DuckDuckGo's public HTML endpoint, which is unofficial, may rate-limit or change without notice, and returns no publication dates.",
    },
  ];
}

export async function searchWeb(query: string, limit = 6): Promise<ResearchResult> {
  const env = researchEnv();
  const errors: string[] = [];

  if (env.searxngUrl) {
    try {
      const url = new URL("/search", env.searxngUrl);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("categories", "general");
      const res = await safeJson(url.toString(), { timeoutMs: 20_000 });
      if (res.status === 200 && Array.isArray(res.data?.results)) {
        const results = res.data.results.slice(0, limit).map((item: any) => ({
          title: String(item.title ?? ""),
          url: String(item.url ?? ""),
          snippet: String(item.content ?? "").slice(0, 400),
          publishedAt: item.publishedDate ?? null,
        }));
        return { provider: "searxng", query, results, configured: true };
      }
      errors.push(`SearXNG returned HTTP ${res.status}. JSON output may be disabled in settings.yml.`);
    } catch (error) {
      errors.push(`SearXNG: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  if (env.braveKey) {
    try {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(Math.min(limit, 20)));
      const res = await safeJson(url.toString(), {
        headers: { "x-subscription-token": env.braveKey, accept: "application/json" },
        timeoutMs: 20_000,
      });
      if (res.status === 200) {
        const results = (res.data?.web?.results ?? []).map((item: any) => ({
          title: String(item.title ?? ""),
          url: String(item.url ?? ""),
          snippet: decodeEntities(String(item.description ?? "")).replace(/<[^>]+>/g, ""),
          publishedAt: item.age ?? item.page_age ?? null,
        }));
        return { provider: "brave", query, results, configured: true };
      }
      errors.push(`Brave returned HTTP ${res.status}.`);
    } catch (error) {
      errors.push(`Brave: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  if (env.tavilyKey) {
    try {
      const res = await safeJson("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: env.tavilyKey, query, max_results: limit, search_depth: "basic" }),
        timeoutMs: 25_000,
      });
      if (res.status === 200) {
        const results = (res.data?.results ?? []).map((item: any) => ({
          title: String(item.title ?? ""),
          url: String(item.url ?? ""),
          snippet: String(item.content ?? "").slice(0, 400),
          publishedAt: item.published_date ?? null,
        }));
        return { provider: "tavily", query, results, configured: true };
      }
      errors.push(`Tavily returned HTTP ${res.status}.`);
    } catch (error) {
      errors.push(`Tavily: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  if (env.allowDuckDuckGo) {
    try {
      const body = new URLSearchParams({ q: query, kl: "us-en" }).toString();
      const res = await safeRequest("https://html.duckduckgo.com/html/", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "text/html",
        },
        body,
        timeoutMs: 20_000,
      });
      const html = await readStream(res.stream, 3_000_000);
      if (res.status === 200) {
        const results = parseDuckDuckGoHtml(html, limit);
        if (results.length > 0) {
          return {
            provider: "duckduckgo",
            query,
            results,
            configured: true,
            note: "Results come from DuckDuckGo's public HTML endpoint (no key, no publication dates, rate limits may apply).",
          };
        }
        errors.push("DuckDuckGo returned no parseable results — it may be rate limiting this server.");
      } else if (res.status === 202 || res.status === 429) {
        errors.push("DuckDuckGo rate-limited this request. Configure SEARXNG_URL for reliable research.");
      } else {
        errors.push(`DuckDuckGo returned HTTP ${res.status}.`);
      }
    } catch (error) {
      errors.push(`DuckDuckGo: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  return {
    provider: "none",
    query,
    results: [],
    configured: researchProviders().some((p) => p.configured),
    note:
      errors.length > 0
        ? errors.join(" ")
        : "No research provider is configured. Set SEARXNG_URL (recommended, self-hosted) or another provider key.",
  };
}

/** Fetch a page for deeper research, treating the content as untrusted data. */
export async function fetchPage(url: string): Promise<{ title: string; url: string; text: string }> {
  const res = await safeRequest(url, {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "CodePilotAI-Research/0.1" },
    timeoutMs: 20_000,
    maxRedirects: 3,
  });
  const contentType = String(res.headers["content-type"] ?? "");
  const raw = await readStream(res.stream, 3_000_000);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Fetching ${url} returned HTTP ${res.status}.`);
  }
  if (!contentType.includes("text/") && !contentType.includes("json")) {
    throw new Error(`Unsupported content type for research: ${contentType || "unknown"}.`);
  }
  const text = contentType.includes("html") ? extractMainText(raw) : raw.slice(0, 12_000);
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return {
    title: titleMatch ? decodeEntities(titleMatch[1]).trim().slice(0, 200) : new URL(res.finalUrl).hostname,
    url: res.finalUrl,
    text,
  };
}

export function recordResearch(
  userId: string,
  query: string,
  chatId: string | null,
  result: ResearchResult,
): void {
  getDb()
    .prepare(
      "INSERT INTO research_queries (id, user_id, chat_id, query, provider, results_json, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      newId("res"),
      userId,
      chatId,
      query,
      result.provider,
      JSON.stringify(result.results),
      result.note ?? null,
      nowIso(),
    );
}
