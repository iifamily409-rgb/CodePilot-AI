"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Alert, Badge, Card, Spinner, cx } from "../ui";

export function ResearchPanel() {
  const [providers, setProviders] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<{ providers: any[]; recent: any[] }>("/api/research");
      setProviders(data.providers);
      setRecent(data.recent);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => { void load(); }, []);

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const data = await api<any>("/api/research", { method: "POST", body: { query } });
      setResult(data);
      await load();
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Web research</h1>
        <p className="mt-1 text-sm text-muted">Real search results with titles, URLs and snippets. Retrieved pages are treated as untrusted data.</p>
      </div>
      {error ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-4">
        {providers.map((provider) => (
          <Card key={provider.id} className="p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{provider.label}</p>
              <Badge tone={provider.configured ? "success" : "warning"}>{provider.configured ? "ready" : "not set"}</Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted">{provider.note}</p>
            <p className="mt-1 text-[11px] text-muted">{provider.requirements}</p>
          </Card>
        ))}
      </div>
      {providers.every((p) => !p.configured) ? (
        <Alert tone="warning" title="No research provider configured">Set SEARXNG_URL (recommended) or an API key for Brave/Tavily, then restart. DuckDuckGo fallback can be re-enabled by removing RESEARCH_DISABLE_DUCKDUCKGO.</Alert>
      ) : null}
      <Card>
        <div className="flex flex-wrap gap-2">
          <input className="cp-input flex-1" placeholder="e.g. Next.js 15 route handler caching official docs" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <button type="button" onClick={search} disabled={busy} className="cp-btn cp-btn-primary">{busy ? <Spinner /> : null}Search</button>
        </div>
        {result ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge tone="accent">{result.provider}</Badge>
              <span>{result.results.length} results</span>
              {result.note ? <span>{result.note}</span> : null}
            </div>
            <ol className="mt-3 space-y-3">
              {result.results.map((hit: any, index: number) => (
                <li key={`${hit.url}-${index}`} className="rounded-lg border border-border bg-bgsoft p-3">
                  <a href={hit.url} target="_blank" rel="noopener noreferrer nofollow" className="cp-link text-sm font-medium">{hit.title || hit.url}</a>
                  <p className="mt-1 break-all text-[11px] text-muted">{hit.url}</p>
                  {hit.snippet ? <p className="mt-1 text-xs text-muted">{hit.snippet}</p> : null}
                  {hit.publishedAt ? <p className="mt-1 text-[11px] text-muted">Published: {hit.publishedAt}</p> : null}
                </li>
              ))}
            </ol>
            {result.results.length === 0 ? <p className="mt-2 text-sm text-muted">No results were returned. {result.note}</p> : null}
          </div>
        ) : null}
      </Card>
      <Card>
        <h2 className="font-semibold">Recent queries</h2>
        {recent.length === 0 ? <p className="mt-2 text-sm text-muted">No research queries recorded yet.</p> : (
          <ul className="mt-3 space-y-2">
            {recent.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-bgsoft p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{item.query}</span>
                  <span className="text-muted">{item.provider} · {new Date(item.created_at).toLocaleString()}</span>
                </div>
                {item.error ? <p className="mt-1 text-warning">{item.error}</p> : null}
                {item.results?.length ? <p className="mt-1 text-muted">{item.results.length} results stored</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className={cx("text-xs text-muted")}>To use these sources in a coding task, ask in chat: “Research X and implement Y with citations.” The agent calls the same research adapter.</p>
    </div>
  );
}
