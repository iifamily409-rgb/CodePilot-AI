/** Minimal, dependency-free HTML helpers for search results and page text. */

export function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    hellip: "…",
    mdash: "—",
    ndash: "–",
    rsquo: "’",
    lsquo: "‘",
    ldquo: "“",
    rdquo: "”",
  };
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

export function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string | null;
};

/** Parse the DuckDuckGo HTML endpoint (no API key, unofficial but real results). */
export function parseDuckDuckGoHtml(html: string, limit = 8): SearchHit[] {
  const hits: SearchHit[] = [];
  const blockRegex = /<div[^>]+class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]+class="[^"]*result|<\/div>\s*$)/gi;
  const anchorRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
  const snippetRegex = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i;
  const simpleRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="[^"]*result__a|<\/body>|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = simpleRegex.exec(html)) !== null && hits.length < limit) {
    let url = decodeEntities(match[1]);
    try {
      const parsed = new URL(url, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) url = uddg;
    } catch {
      continue;
    }
    const title = stripTags(match[2]);
    if (!title) continue;
    const snippet = stripTags(match[3] ?? "").slice(0, 400);
    hits.push({ title, url, snippet, publishedAt: null });
  }
  void blockRegex;
  void anchorRegex;
  void snippetRegex;
  return hits;
}

export function extractMainText(html: string, maxChars = 12_000): string {
  const withoutBoiler = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : "";
  const text = stripTags(withoutBoiler);
  return `${title ? `# ${title}\n\n` : ""}${text.slice(0, maxChars)}`;
}
