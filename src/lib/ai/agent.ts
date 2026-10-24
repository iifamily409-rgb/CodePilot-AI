import "server-only";
import { streamChat, supportsTools } from "./adapters";
import { providerCredentials } from "./http";
import { eligibleModels, resolveEligibleModel } from "./eligibility";
import { maxSteps, type AgentMode } from "./modes";
import { executeTool, toolSchemas } from "./tools";
import type { ChatMessage, StreamDelta, ToolCall } from "./types";
import type { SearchHit } from "../research/html";

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "text"; text: string }
  | { type: "tool_start"; id: string; name: string; args: string }
  | { type: "tool_result"; id: string; name: string; ok: boolean; summary: string }
  | { type: "plan"; steps: string[] }
  | { type: "citation"; citation: SearchHit }
  | { type: "model"; modelRef: string; provider: string; model: string; pricingStatus: string }
  | { type: "fallback"; from: string; to: string; reason: string }
  | { type: "error"; message: string }
  | { type: "done"; filesChanged: string[] };

export type RunAgentInput = {
  userId: string;
  mode: AgentMode;
  modelRef: string;
  messages: ChatMessage[];
  systemPrompt: string;
  projectId: string | null;
  repositoryId: string | null;
  signal: AbortSignal;
  onEvent: (event: AgentEvent) => void;
};

export type RunAgentResult = { text: string; citations: SearchHit[]; toolCount: number };

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const primary = resolveEligibleModel(input.userId, input.modelRef);
  const tools = input.mode === "ask" || !supportsTools(primary.provider.protocol)
    ? []
    : toolSchemas(input.mode);

  const alternatives = eligibleModels(input.userId).filter(
    (candidate) =>
      candidate.ref !== primary.ref &&
      (tools.length === 0 || supportsTools(candidate.provider.protocol)),
  );

  let current = primary;
  let messages: ChatMessage[] = [
    { role: "system", content: input.systemPrompt },
    ...input.messages,
  ];
  const citations: SearchHit[] = [];
  const filesChanged = new Set<string>();
  let fullText = "";
  let toolCount = 0;
  let commandCount = 0;
  let fallbacks = 0;

  input.onEvent({
    type: "model",
    modelRef: current.ref,
    provider: current.provider.name,
    model: current.model.display_name,
    pricingStatus: current.model.pricing_status,
  });

  for (let step = 0; step < maxSteps(input.mode); step++) {
    if (input.signal.aborted) break;
    const credentials = providerCredentials(current.provider);
    let textThisStep = "";
    let calls: ToolCall[] = [];
    let failure: string | null = null;

    const attempt = async (candidate: typeof current): Promise<void> => {
      const creds = providerCredentials(candidate.provider);
      const generator = streamChat({
        provider: candidate.provider,
        apiKey: creds.apiKey,
        headers: creds.headers,
        modelId: candidate.model.model_id,
        messages,
        tools: tools.length ? tools : undefined,
      });
      for await (const delta of generator) {
        if (input.signal.aborted) return;
        if (delta.type === "text") {
          textThisStep += delta.text;
          fullText += delta.text;
          input.onEvent({ type: "text", text: delta.text });
        } else if (delta.type === "tool_calls") {
          calls.push(...delta.calls);
        } else if (delta.type === "error") {
          failure = delta.message;
        }
      }
    };

    try {
      await attempt(current);
    } catch (error) {
      failure = error instanceof Error ? error.message : "Model request failed.";
    }

    // Transparent fallback between the user's own eligible models only.
    if (failure && textThisStep.length === 0 && calls.length === 0 && fallbacks < 2) {
      const next = alternatives[fallbacks];
      if (next) {
        fallbacks += 1;
        input.onEvent({ type: "fallback", from: current.ref, to: next.ref, reason: failure });
        current = { ...next, eligibility: { eligible: true, status: next.model.pricing_status, reason: "" } };
        input.onEvent({
          type: "model",
          modelRef: next.ref,
          provider: next.provider.name,
          model: next.model.display_name,
          pricingStatus: next.model.pricing_status,
        });
        try {
          await attempt(current);
        } catch (error) {
          failure = error instanceof Error ? error.message : "Model request failed.";
        }
      }
    }

    if (failure && textThisStep.length === 0 && calls.length === 0) {
      input.onEvent({ type: "error", message: failure });
      return { text: fullText, citations, toolCount };
    }
    if (!calls.length) break;

    messages = [
      ...messages,
      {
        role: "assistant",
        content: textThisStep,
        tool_calls: calls,
      },
    ];

    for (const call of calls) {
      if (input.signal.aborted) break;
      if (toolCount >= 40) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: "Tool budget exhausted for this turn. Summarise what you have and finish.",
        });
        continue;
      }
      if (call.name === "run_command" && commandCount >= 6) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: "Command budget exhausted for this turn (max 6 commands).",
        });
        continue;
      }
      toolCount += 1;
      input.onEvent({ type: "tool_start", id: call.id, name: call.name, args: call.arguments.slice(0, 1000) });
      const result = await executeTool(call.name, call.arguments, {
        userId: input.userId,
        projectId: input.projectId,
        repositoryId: input.repositoryId,
        mode: input.mode,
        onCitation: (citation) => {
          if (!citations.some((c) => c.url === citation.url)) {
            citations.push(citation);
            input.onEvent({ type: "citation", citation });
          }
        },
      });
      if (call.name === "run_command") commandCount += 1;
      if (result.meta?.plan) input.onEvent({ type: "plan", steps: result.meta.plan as string[] });
      if (call.name === "write_file" && result.ok) filesChanged.add(String(JSON.parse(call.arguments || "{}").path ?? ""));
      if (call.name === "delete_file" && result.ok) filesChanged.add(String(JSON.parse(call.arguments || "{}").path ?? ""));
      input.onEvent({
        type: "tool_result",
        id: call.id,
        name: call.name,
        ok: result.ok,
        summary: result.content.slice(0, 600),
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: `<untrusted-tool-output tool="${call.name}">\n${result.content}\n</untrusted-tool-output>`,
      });
    }
  }

  input.onEvent({ type: "done", filesChanged: [...filesChanged].filter(Boolean) });
  return { text: fullText, citations, toolCount };
}
