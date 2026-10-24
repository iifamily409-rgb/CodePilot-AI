import "server-only";
import { errorMessageFromBody, providerJson, providerRequest, readLines } from "./http";
import type { ChatMessage, ChatRequest, StreamDelta, ToolCall } from "./types";

function openAiMessages(messages: ChatMessage[]) {
  return messages.map((message) => {
    if (message.role === "tool") {
      return { role: "tool", content: message.content, tool_call_id: message.tool_call_id };
    }
    if (message.role === "assistant" && message.tool_calls?.length) {
      return {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.tool_calls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }
    return { role: message.role, content: message.content };
  });
}

/** OpenAI-compatible streaming (OpenRouter, custom OpenAI-compatible endpoints). */
async function* openAiStream(req: ChatRequest): AsyncGenerator<StreamDelta> {
  const body: Record<string, unknown> = {
    model: req.modelId,
    messages: openAiMessages(req.messages),
    stream: true,
    temperature: req.temperature ?? 0.2,
  };
  if (req.maxTokens) body.max_tokens = req.maxTokens;
  if (req.tools?.length) {
    body.tools = req.tools;
    body.tool_choice = "auto";
  }
  if (req.provider.protocol === "openrouter") {
    // Prevent OpenRouter from silently routing to a different (possibly paid)
    // model when the requested one is unavailable.
    body.provider = { allow_fallbacks: false };
  }
  const res = await providerRequest(req.provider, "/chat/completions", {
    method: "POST",
    body,
    timeoutMs: req.timeoutMs ?? 180_000,
    headers: req.apiKey ? {} : {},
  });
  if (res.status < 200 || res.status >= 300) {
    const text = await collect(res.stream);
    yield { type: "error", message: errorMessageFromBody(text, res.status) };
    return;
  }
  const pending: Array<{ id: string; name: string; arguments: string }> = [];
  let finishReason: string | undefined;
  for await (const line of readLines(res.stream)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    if (payload === "[DONE]") break;
    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }
    if (parsed.error) {
      yield { type: "error", message: parsed.error.message ?? "The provider returned an error." };
      return;
    }
    const choice = parsed.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta ?? {};
    if (typeof delta.content === "string" && delta.content.length > 0) {
      yield { type: "text", text: delta.content };
    }
    for (const call of delta.tool_calls ?? []) {
      const index = typeof call.index === "number" ? call.index : pending.length;
      if (!pending[index]) pending[index] = { id: call.id ?? `call_${index}`, name: "", arguments: "" };
      if (call.id) pending[index].id = call.id;
      if (call.function?.name) pending[index].name += call.function.name;
      if (call.function?.arguments) pending[index].arguments += call.function.arguments;
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
  }
  const calls: ToolCall[] = pending
    .filter((call) => call && call.name)
    .map((call) => ({ id: call.id, name: call.name, arguments: call.arguments || "{}" }));
  if (calls.length) yield { type: "tool_calls", calls };
  yield { type: "done", finishReason };
}

/** Ollama /api/chat NDJSON streaming. */
async function* ollamaStream(req: ChatRequest): AsyncGenerator<StreamDelta> {
  const body: Record<string, unknown> = {
    model: req.modelId,
    messages: openAiMessages(req.messages),
    stream: true,
    options: { temperature: req.temperature ?? 0.2 },
  };
  if (req.tools?.length) body.tools = req.tools;
  const res = await providerRequest(req.provider, "/api/chat", {
    method: "POST",
    body,
    timeoutMs: req.timeoutMs ?? 300_000,
  });
  if (res.status < 200 || res.status >= 300) {
    const text = await collect(res.stream);
    yield { type: "error", message: errorMessageFromBody(text, res.status) };
    return;
  }
  for await (const line of readLines(res.stream)) {
    if (!line.trim()) continue;
    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (parsed.error) {
      yield { type: "error", message: parsed.error };
      return;
    }
    const content = parsed.message?.content;
    if (typeof content === "string" && content.length > 0) yield { type: "text", text: content };
    const calls = parsed.message?.tool_calls;
    if (Array.isArray(calls) && calls.length) {
      yield {
        type: "tool_calls",
        calls: calls.map((call: any, index: number) => ({
          id: `ollama_${index}_${Date.now()}`,
          name: call.function?.name ?? "",
          arguments:
            typeof call.function?.arguments === "string"
              ? call.function.arguments
              : JSON.stringify(call.function?.arguments ?? {}),
        })),
      };
    }
    if (parsed.done) {
      yield { type: "done", finishReason: parsed.done_reason };
      return;
    }
  }
  yield { type: "done" };
}

/**
 * OpenCode server runtime: the documented HTTP API is request/response based
 * (`POST /session/:id/message`), so output arrives as one chunk. Tool calling
 * is not exposed through this endpoint, so agent modes use another provider.
 */
async function* openCodeStream(req: ChatRequest): AsyncGenerator<StreamDelta> {
  const session = await providerJson(req.provider, "/session", {
    method: "POST",
    body: { title: "X-Flex" },
  });
  const sessionId = session.data?.id;
  if (!sessionId) {
    yield { type: "error", message: "OpenCode did not return a session id. Is `opencode serve` running with a compatible version?" };
    return;
  }
  const [providerId, ...rest] = req.modelId.split("/");
  const modelID = rest.join("/") || req.modelId;
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const system = req.messages.find((m) => m.role === "system")?.content;
  const res = await providerJson(req.provider, `/session/${encodeURIComponent(sessionId)}/message`, {
    method: "POST",
    body: {
      model: { providerID: providerId, modelID },
      system,
      parts: [{ type: "text", text: lastUser?.content ?? "" }],
    },
    timeoutMs: req.timeoutMs ?? 300_000,
  });
  if (res.status < 200 || res.status >= 300) {
    yield { type: "error", message: errorMessageFromBody(res.text, res.status) };
    return;
  }
  const parts = res.data?.parts ?? [];
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") yield { type: "text", text: part.text };
  }
  yield { type: "done" };
}

async function collect(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export function streamChat(req: ChatRequest): AsyncGenerator<StreamDelta> {
  switch (req.provider.protocol) {
    case "openrouter":
    case "openai_compatible":
      return openAiStream(req);
    case "ollama":
      return ollamaStream(req);
    case "opencode":
      return openCodeStream(req);
    default:
      return (async function* () {
        yield { type: "error" as const, message: "Unsupported provider protocol." };
      })();
  }
}

export function supportsTools(protocol: string): boolean {
  return protocol !== "opencode";
}
