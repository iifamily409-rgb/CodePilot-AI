"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Alert, Badge, Card, Spinner, StatusPill, cx } from "../ui";

type Model = {
  ref: string; modelId: string; displayName: string; provider: { name: string; protocol: string } | null;
  pricingStatus: string; inputPricePerMtok: number | null; outputPricePerMtok: number | null;
  contextLength: number | null; capabilities: Record<string, boolean>; enabled: boolean;
  source: string; notes: string | null; lastCheckedAt: string; eligibility: { eligible: boolean; reason: string };
};

const CAPABILITIES = [
  { id: "coding", label: "Coding" },
  { id: "reasoning", label: "Reasoning" },
  { id: "tools", label: "Tool calling" },
  { id: "long_context", label: "Long context" },
  { id: "vision", label: "Vision" },
]

export function ModelExplorer() {
  const [models, setModels] = useState<Model[]>([]);
  const [smart, setSmart] = useState<{ ref: string; reason: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [provider, setProvider] = useState("");
  const [capability, setCapability] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshResults, setRefreshResults] = useState<any[] | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ models: Model[]; smartSelection: any }>("/api/models");
      setModels(data.models);
      setSmart(data.smartSelection);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function refreshAll() {
    setBusy(true);
    setRefreshResults(null);
    try {
      const data = await api<{ results: any[] }>("/api/models", { method: "POST", body: {} });
      setRefreshResults(data.results);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(model: Model) {
    try {
      await api("/api/models/classify", { method: "POST", body: { providerId: model.ref.split("::")[0], modelId: model.modelId, enabled: !model.enabled } });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const providers = useMemo(() => [...new Set(models.map((m) => m.provider?.name).filter(Boolean))] as string[], [models]);
  const filtered = models.filter((model) => {
    if (filter && !`${model.displayName} ${model.modelId}`.toLowerCase().includes(filter.toLowerCase())) return false;
    if (provider && model.provider?.name !== provider) return false;
    if (capability && !model.capabilities[capability]) return false;
    if (statusFilter && model.pricingStatus !== statusFilter) return false;
    return true;
  });
  const eligibleCount = models.filter((m) => m.eligibility.eligible).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Model explorer</h1>
          <p className="mt-1 text-sm text-muted">Live catalogs from your configured providers. Only verified-free and local models are eligible.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refreshAll} disabled={busy} className="cp-btn cp-btn-primary">{busy ? <Spinner /> : null}Refresh models</button>
          <Link href="/app/providers" className="cp-btn cp-btn-ghost">Providers</Link>
        </div>
      </div>
      {error ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">{error}</p> : null}
      {refreshResults ? (
        <Alert tone={refreshResults.every((r) => r.ok) ? "success" : "warning"} title="Refresh results">
          <ul className="space-y-1">
            {refreshResults.map((result) => (
              <li key={result.provider}>{result.provider}: {result.ok ? `${result.count} models` : result.error}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <input className="cp-input max-w-xs" placeholder="Search models…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <select className="cp-input !w-auto" value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="">All providers</option>
            {providers.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select className="cp-input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All pricing states</option>
            <option value="verified_free">Verified free</option>
            <option value="local">Local</option>
            <option value="unverified">Unverified</option>
            <option value="paid">Paid</option>
          </select>
          {CAPABILITIES.map((item) => (
            <button key={item.id} type="button" onClick={() => setCapability(capability === item.id ? null : item.id)} className={cx("cp-badge", capability === item.id && "!text-accent !border-[color-mix(in_oklab,var(--accent)_45%,transparent)]")}>{item.label}</button>
          ))}
          <span className="ml-auto text-xs text-muted">{filtered.length} shown · {eligibleCount}/{models.length} eligible</span>
        </div>
      </Card>
      {smart ? (
        <Alert tone="info" title="Smart selection (optional)">
          Suggested model: <code>{smart.ref}</code> — {smart.reason}
        </Alert>
      ) : null}
      {loading ? <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading catalog…</div> : null}
      {!loading && models.length === 0 ? (
        <Card><p className="text-sm text-muted">No models discovered yet. Add a provider and press Refresh models. If you have no provider, create a local Ollama runtime or add an OpenRouter key.</p></Card>
      ) : null}
      <div className="grid gap-2">
        {filtered.map((model) => (
          <div key={model.ref} className="cp-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{model.displayName}</h3>
                  <StatusPill status={model.pricingStatus} />
                  {!model.enabled ? <Badge tone="neutral">disabled</Badge> : null}
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted">{model.ref}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(model.capabilities).filter(([, value]) => value).map(([key]) => (
                    <Badge key={key} tone="accent">{key.replace("_", " ")}</Badge>
                  ))}
                  {model.contextLength ? <Badge>{model.contextLength.toLocaleString()} ctx</Badge> : null}
                  {model.inputPricePerMtok !== null ? <Badge>${model.inputPricePerMtok}/M in</Badge> : null}
                  {model.outputPricePerMtok !== null ? <Badge>${model.outputPricePerMtok}/M out</Badge> : null}
                </div>
                <p className="mt-2 text-xs text-muted">{model.eligibility.eligible ? model.eligibility.reason : model.eligibility.reason}</p>
                {model.notes ? <p className="mt-1 text-[11px] text-muted">{model.notes}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button type="button" onClick={() => toggle(model)} className="cp-btn cp-btn-ghost !py-1 !text-xs">{model.enabled ? "Disable" : "Enable"}</button>
                <span className="text-[10px] text-muted">checked {new Date(model.lastCheckedAt).toLocaleDateString()}</span>
                <span className="text-[10px] text-muted">{model.source}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
