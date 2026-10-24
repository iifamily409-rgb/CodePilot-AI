"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Alert, Badge, Card, Spinner, StatusPill, cx } from "../ui";

type Provider = {
  id: string; name: string; protocol: string; baseUrl: string; authType: string;
  hasApiKey: boolean; enabled: boolean; lastCheckAt: string | null; lastCheckOk: boolean | null;
  lastCheckMessage: string | null; modelCounts: { total: number; eligible: number };
};

const PROTOCOLS = [
  { id: "openrouter", label: "OpenRouter", url: "https://openrouter.ai/api/v1", hint: "Official API. Catalog pricing decides eligibility; router fallbacks are disabled." },
  { id: "openai_compatible", label: "OpenAI-compatible endpoint", url: "https://api.example.com/v1", hint: "Any compatible API. Models are unverified until you confirm them or the endpoint is local." },
  { id: "ollama", label: "Ollama (local)", url: "http://localhost:11434", hint: "Local runtime on your machine. Requires `ollama serve`." },
  { id: "opencode", label: "OpenCode server", url: "http://localhost:4096", hint: "Requires `opencode serve`. Uses the documented HTTP API; non-streaming responses." },
];

export function ProviderManager() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState({ name: "", protocol: "openrouter", baseUrl: "https://openrouter.ai/api/v1", authType: "bearer", apiKey: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const data = await api<{ providers: Provider[] }>("/api/providers");
      setProviders(data.providers);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => { void load(); }, []);

  function pickProtocol(id: string) {
    const protocol = PROTOCOLS.find((p) => p.id === id);
    setForm((prev) => ({ ...prev, protocol: id, baseUrl: protocol?.url ?? prev.baseUrl }));
  }

  async function create() {
    setBusy("create");
    try {
      const data = await api<any>("/api/providers", { method: "POST", body: { ...form, apiKey: form.apiKey || null, discover: true } });
      setNotice(
        data.discovery?.error
          ? `Provider saved, but model discovery failed: ${data.discovery.error}`
          : `Provider saved. ${data.discovery?.count ?? 0} models discovered.`,
      );
      setForm({ ...form, name: "", apiKey: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function test(provider: Provider) {
    setBusy(`test-${provider.id}`);
    try {
      const result = await api<{ ok: boolean; message: string }>(`/api/providers/${provider.id}/test`, { method: "POST", body: {} });
      setNotice(`${provider.name}: ${result.message}`);
      await load();
    } catch (err) {
      setNotice(`${provider.name}: ${errorMessage(err)}`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function refresh(provider: Provider) {
    setBusy(`refresh-${provider.id}`);
    try {
      const result = await api<any>(`/api/providers/${provider.id}/models`, { method: "POST", body: {} });
      setNotice(`${provider.name}: ${result.count} models refreshed.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(provider: Provider) {
    setBusy(`toggle-${provider.id}`);
    try {
      await api(`/api/providers/${provider.id}`, { method: "PATCH", body: { enabled: !provider.enabled } });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(provider: Provider) {
    if (!window.confirm(`Remove "${provider.name}" and its discovered models?`)) return;
    setBusy(`remove-${provider.id}`);
    try {
      await api(`/api/providers/${provider.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function loadModels(provider: Provider) {
    setBusy(`models-${provider.id}`);
    try {
      const data = await api<{ models: any[] }>(`/api/providers/${provider.id}/models`);
      setModels((prev) => ({ ...prev, [provider.id]: data.models }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function classify(providerId: string, modelId: string, status: string) {
    let confirmation: string | null = null;
    if (status === "verified_free") {
      confirmation = window.prompt(
        "Confirm in writing that this model is zero-cost with your provider (this note is stored with the model):",
      );
      if (!confirmation || confirmation.trim().length < 10) return;
    }
    try {
      await api("/api/models/classify", { method: "POST", body: { providerId, modelId, pricingStatus: status, confirmation } });
      await loadModels(providers.find((p) => p.id === providerId)!);
      setNotice("Model classification updated.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI Provider Manager</h1>
          <p className="mt-1 text-sm text-muted">Multiple providers and models are supported. Keys are encrypted at rest and never returned to the browser.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="cp-btn cp-btn-primary">Add provider</button>
      </div>
      {error ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-success">{notice}</p> : null}
      {showForm ? (
        <Card>
          <h2 className="font-semibold">New provider</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div><label className="cp-label">Display name</label><input className="cp-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="OpenRouter (personal)" /></div>
            <div>
              <label className="cp-label">Protocol</label>
              <select className="cp-input" value={form.protocol} onChange={(e) => pickProtocol(e.target.value)}>
                {PROTOCOLS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div><label className="cp-label">Base URL</label><input className="cp-input font-mono text-xs" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} /></div>
            <div>
              <label className="cp-label">Authentication</label>
              <select className="cp-input" value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value })}>
                <option value="bearer">Bearer token</option>
                <option value="x-api-key">x-api-key header</option>
                <option value="basic">HTTP basic (OpenCode)</option>
                <option value="none">No credentials</option>
              </select>
            </div>
            <div className="md:col-span-2"><label className="cp-label">API key / password (optional for local runtimes)</label><input type="password" className="cp-input" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} autoComplete="off" placeholder="stored encrypted" /></div>
          </div>
          <p className="mt-2 text-xs text-muted">{PROTOCOLS.find((p) => p.id === form.protocol)?.hint}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={create} disabled={busy === "create" || !form.name || !form.baseUrl} className="cp-btn cp-btn-primary">{busy === "create" ? <Spinner /> : null}Save & discover models</button>
            <button type="button" onClick={() => setShowForm(false)} className="cp-btn cp-btn-ghost">Cancel</button>
          </div>
          <div className="mt-3"><Alert tone="info" title="Endpoint policy">Non-loopback endpoints must be HTTPS and resolve to public addresses. Private ranges, link-local and metadata IPs are blocked. Custom endpoints are not assumed free.</Alert></div>
        </Card>
      ) : null}
      {providers.length === 0 ? (
        <Card><p className="text-sm text-muted">No providers configured. Add OpenRouter with a key, or start a local Ollama runtime and add it as a local provider.</p></Card>
      ) : null}
      <div className="space-y-3">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{provider.name}</h3>
                  <Badge>{provider.protocol}</Badge>
                  {provider.enabled ? <Badge tone="success">Enabled</Badge> : <Badge tone="warning">Disabled</Badge>}
                  <Badge>{provider.modelCounts.eligible}/{provider.modelCounts.total} eligible</Badge>
                  {provider.lastCheckOk === true ? <StatusPill status="passed" /> : provider.lastCheckOk === false ? <StatusPill status="failed" /> : null}
                </div>
                <p className="mt-1 font-mono text-xs text-muted">{provider.baseUrl}</p>
                <p className="mt-1 text-xs text-muted">{provider.hasApiKey ? "Credential stored (encrypted)" : "No credential stored"}{provider.lastCheckAt ? ` · last check ${new Date(provider.lastCheckAt).toLocaleString()}` : ""}</p>
                {provider.lastCheckMessage ? <p className="mt-1 text-xs text-warning">{provider.lastCheckMessage}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => test(provider)} disabled={busy === `test-${provider.id}`} className="cp-btn cp-btn-subtle !py-1 !text-xs">{busy === `test-${provider.id}` ? <Spinner /> : null}Test</button>
                <button type="button" onClick={() => refresh(provider)} disabled={busy === `refresh-${provider.id}`} className="cp-btn cp-btn-subtle !py-1 !text-xs">{busy === `refresh-${provider.id}` ? <Spinner /> : null}Refresh models</button>
                <button type="button" onClick={() => loadModels(provider)} className="cp-btn cp-btn-ghost !py-1 !text-xs">View models</button>
                <button type="button" onClick={() => toggle(provider)} className="cp-btn cp-btn-ghost !py-1 !text-xs">{provider.enabled ? "Disable" : "Enable"}</button>
                <button type="button" onClick={() => remove(provider)} className="cp-btn cp-btn-danger !py-1 !text-xs">Remove</button>
              </div>
            </div>
            {models[provider.id] ? (
              <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface2 text-muted"><tr><th className="px-2 py-1.5">Model</th><th className="px-2 py-1.5">Pricing</th><th className="px-2 py-1.5">Context</th><th className="px-2 py-1.5">Classify</th></tr></thead>
                  <tbody>
                    {models[provider.id].map((model) => (
                      <tr key={model.model_id} className="border-t border-border">
                        <td className="px-2 py-1.5"><span className="font-mono">{model.model_id}</span><div className="text-muted">{model.display_name}</div></td>
                        <td className="px-2 py-1.5"><StatusPill status={model.pricing_status} /></td>
                        <td className="px-2 py-1.5 text-muted">{model.context_length ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          <select className="cp-input !py-0.5 !text-[11px]" value={model.pricing_status} onChange={(e) => classify(provider.id, model.model_id, e.target.value)}>
                            <option value="verified_free">verified free</option>
                            <option value="local">local</option>
                            <option value="unverified">unverified</option>
                            <option value="paid">paid</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
      <p className={cx("text-xs text-muted")}>
        Removing a provider deletes its model records. Conversations keep their historical model reference but cannot run until another eligible model is selected.
      </p>
    </div>
  );
}
