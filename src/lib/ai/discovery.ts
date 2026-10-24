import "server-only";
import net from "node:net";
import { providerJson } from "./http";
import { DEFAULT_LOCAL_HOSTS } from "../security/url-policy";
import type { ModelCapabilities, PricingStatus, ProviderRow } from "./types";

export type DiscoveredModel = {
  model_id: string;
  display_name: string;
  pricing_status: PricingStatus;
  input_price_per_mtok: number | null;
  output_price_per_mtok: number | null;
  context_length: number | null;
  capabilities: ModelCapabilities;
  source: string;
  notes: string | null;
};

export function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (DEFAULT_LOCAL_HOSTS.includes(host)) return true;
    if (host.endsWith(".local")) return true;
    if (net.isIP(host) && (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("127."))) return true;
    return false;
  } catch {
    return false;
  }
}

function perMillion(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 1_000_000 * 1_000_000) / 1_000_000;
}

const CODING_KEYWORDS = /(coder|code|devstral|starcoder|deepseek|qwen.*code|codestral|swe)/i;

/**
 * Pricing classification from the provider's own catalog values only. A model
 * is `verified_free` when both input and output prices are exactly 0.
 */
export function classifyOpenRouter(model: any): DiscoveredModel {
  const prompt = model?.pricing?.prompt;
  const completion = model?.pricing?.completion;
  const promptNum = prompt === undefined ? NaN : Number(prompt);
  const completionNum = completion === undefined ? NaN : Number(completion);
  let status: PricingStatus = "unverified";
  if (Number.isFinite(promptNum) && Number.isFinite(completionNum)) {
    status = promptNum === 0 && completionNum === 0 ? "verified_free" : "paid";
  }
  const params: string[] = Array.isArray(model?.supported_parameters) ? model.supported_parameters : [];
  const inputs: string[] = Array.isArray(model?.architecture?.input_modalities)
    ? model.architecture.input_modalities
    : [];
  const context = typeof model?.context_length === "number" ? model.context_length : null;
  const text = `${model?.id ?? ""} ${model?.name ?? ""} ${model?.description ?? ""}`;
  const capabilities: ModelCapabilities = {
    tools: params.includes("tools") || params.includes("tool_choice"),
    reasoning: params.some((p) => p.includes("reasoning")),
    vision: inputs.includes("image"),
    long_context: context !== null && context >= 100_000,
    coding: CODING_KEYWORDS.test(text),
    json_mode: params.includes("response_format") || params.includes("structured_outputs"),
  };
  return {
    model_id: String(model.id),
    display_name: String(model.name ?? model.id),
    pricing_status: status,
    input_price_per_mtok: perMillion(prompt),
    output_price_per_mtok: perMillion(completion),
    context_length: context,
    capabilities,
    source: "catalog",
    notes: status === "verified_free" ? "Catalog reports zero input and output price." : null,
  };
}

export async function discoverModels(
  provider: ProviderRow,
): Promise<{ models: DiscoveredModel[]; source: string; note?: string }> {
  if (provider.protocol === "openrouter") {
    const res = await providerJson(provider, "/models", { timeoutMs: 30_000 });
    if (res.status !== 200 || !Array.isArray(res.data?.data)) {
      throw new Error(`OpenRouter model catalog request failed (HTTP ${res.status}). ${res.text.slice(0, 200)}`);
    }
    return {
      models: res.data.data.map(classifyOpenRouter),
      source: "openrouter_catalog",
      note: `${res.data.data.length} models returned by the OpenRouter catalog.`,
    };
  }

  if (provider.protocol === "ollama") {
    const res = await providerJson(provider, "/api/tags", { timeoutMs: 15_000 });
    if (res.status !== 200 || !Array.isArray(res.data?.models)) {
      throw new Error(`Ollama did not return a model list (HTTP ${res.status}). Is \`ollama serve\` running?`);
    }
    return {
      models: res.data.models.map((m: any): DiscoveredModel => ({
        model_id: String(m.name ?? m.model),
        display_name: String(m.name ?? m.model),
        pricing_status: "local",
        input_price_per_mtok: 0,
        output_price_per_mtok: 0,
        context_length: null,
        capabilities: {},
        source: "local",
        notes: m.details?.parameter_size ? `Local model (${m.details.parameter_size}).` : "Local model.",
      })),
      source: "ollama_tags",
      note: "Local runtime: capabilities are not declared by Ollama's tags endpoint.",
    };
  }

  if (provider.protocol === "opencode") {
    const res = await providerJson(provider, "/config/providers", { timeoutMs: 20_000 });
    if (res.status !== 200 || !res.data) {
      throw new Error(`OpenCode server did not return providers (HTTP ${res.status}). Start it with \`opencode serve\`.`);
    }
    const providers: any[] = res.data.providers ?? res.data.data ?? [];
    const models: DiscoveredModel[] = [];
    for (const entry of providers) {
      const providerId = String(entry.id ?? entry.providerID ?? "");
      const providerName = String(entry.name ?? providerId);
      const local = ["ollama", "lmstudio", "llamacpp", "local"].includes(providerId.toLowerCase());
      for (const [modelId, model] of Object.entries<any>(entry.models ?? {})) {
        const cost = model?.cost;
        let status: PricingStatus = local ? "local" : "unverified";
        if (!local && cost && Number(cost.input) === 0 && Number(cost.output) === 0) status = "verified_free";
        else if (!local && cost && (Number(cost.input) > 0 || Number(cost.output) > 0)) status = "paid";
        models.push({
          model_id: `${providerId}/${modelId}`,
          display_name: `${providerName} · ${model?.name ?? modelId}`,
          pricing_status: status,
          input_price_per_mtok: cost ? perMillion(cost.input) : null,
          output_price_per_mtok: cost ? perMillion(cost.output) : null,
          context_length: typeof model?.limit?.context === "number" ? model.limit.context : null,
          capabilities: { tools: Boolean(model?.tool_call) },
          source: "opencode_config",
          notes: local ? "Local provider via OpenCode." : null,
        });
      }
    }
    return {
      models,
      source: "opencode_config",
      note: "Model pricing comes from the OpenCode provider configuration. Unverified entries stay blocked by the free-only policy.",
    };
  }

  // Generic OpenAI-compatible endpoints expose no pricing metadata.
  const res = await providerJson(provider, "/models", { timeoutMs: 20_000 });
  if (res.status !== 200) {
    throw new Error(`The endpoint did not return a model list (HTTP ${res.status}). ${res.text.slice(0, 200)}`);
  }
  const list: any[] = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
  const local = isLocalBaseUrl(provider.base_url);
  return {
    models: list.map((m: any): DiscoveredModel => ({
      model_id: String(m.id ?? m.name),
      display_name: String(m.name ?? m.id),
      pricing_status: local ? "local" : "unverified",
      input_price_per_mtok: null,
      output_price_per_mtok: null,
      context_length: typeof m.context_length === "number" ? m.context_length : null,
      capabilities: {},
      source: local ? "local" : "catalog_unverified",
      notes: local
        ? "Local endpoint: no per-token charge from CodePilot AI."
        : "This endpoint publishes no pricing metadata. Confirm zero cost with your provider, then mark it verified free.",
    })),
    source: "openai_compatible_models",
    note: local
      ? "Local OpenAI-compatible endpoint."
      : "Generic OpenAI-compatible endpoints do not publish pricing; models are classified unverified until you confirm them.",
  };
}

export async function healthCheck(provider: ProviderRow): Promise<{ ok: boolean; message: string }> {
  try {
    const path =
      provider.protocol === "openrouter" || provider.protocol === "openai_compatible"
        ? "/models"
        : provider.protocol === "ollama"
          ? "/api/tags"
          : "/global/health";
    const res = await providerJson(provider, path, { timeoutMs: 15_000 });
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, message: `Connected (HTTP ${res.status}).` };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: `Authentication rejected (HTTP ${res.status}). Check the API key.` };
    }
    return { ok: false, message: `Endpoint responded with HTTP ${res.status}. ${res.text.slice(0, 200)}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Connection failed." };
  }
}
