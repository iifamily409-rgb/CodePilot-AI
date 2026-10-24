export type ProviderProtocol = "openrouter" | "openai_compatible" | "ollama" | "opencode";
export const PROVIDER_PROTOCOLS: ProviderProtocol[] = [
  "openrouter",
  "openai_compatible",
  "ollama",
  "opencode",
];

export type PricingStatus = "verified_free" | "local" | "unverified" | "paid";
export const PRICING_STATUSES: PricingStatus[] = ["verified_free", "local", "unverified", "paid"];

export type AuthType = "bearer" | "x-api-key" | "basic" | "none";

export type ProviderRow = {
  id: string;
  user_id: string;
  name: string;
  protocol: ProviderProtocol;
  base_url: string;
  auth_type: AuthType;
  api_key_enc: string | null;
  headers_enc: string | null;
  enabled: number;
  allow_private: number;
  last_check_at: string | null;
  last_check_ok: number | null;
  last_check_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelCapabilities = {
  tools?: boolean;
  reasoning?: boolean;
  vision?: boolean;
  long_context?: boolean;
  coding?: boolean;
  json_mode?: boolean;
};

export type ModelRow = {
  id: string;
  provider_id: string;
  user_id: string;
  model_id: string;
  display_name: string;
  pricing_status: PricingStatus;
  input_price_per_mtok: number | null;
  output_price_per_mtok: number | null;
  context_length: number | null;
  capabilities_json: string;
  source: string;
  enabled: number;
  notes: string | null;
  last_checked_at: string;
};

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type StreamDelta =
  | { type: "text"; text: string }
  | { type: "tool_calls"; calls: ToolCall[] }
  | { type: "done"; finishReason?: string; usage?: Record<string, number> }
  | { type: "error"; message: string };

export type ChatRequest = {
  provider: ProviderRow;
  apiKey: string | null;
  headers: Record<string, string>;
  modelId: string;
  messages: ChatMessage[];
  tools?: ToolSchema[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export const MODEL_REF_SEPARATOR = "::";

export function modelRef(providerId: string, modelId: string): string {
  return `${providerId}${MODEL_REF_SEPARATOR}${modelId}`;
}

export function parseModelRef(ref: string): { providerId: string; modelId: string } | null {
  const index = ref.indexOf(MODEL_REF_SEPARATOR);
  if (index <= 0) return null;
  const providerId = ref.slice(0, index);
  const modelId = ref.slice(index + MODEL_REF_SEPARATOR.length);
  if (!providerId || !modelId) return null;
  return { providerId, modelId };
}
