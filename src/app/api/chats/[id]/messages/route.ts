import { z } from "zod";
import { assertCsrf, requireAuth } from "@/lib/auth";
import { ApiError, parseJson, route } from "@/lib/api";
import { appendMessage, listMessages, requireChat, updateChat } from "@/lib/chats";
import { getProject } from "@/lib/projects";
import { getRepository } from "@/lib/github/connection";
import { listTree } from "@/lib/workspace/fs";
import { runAgent, type AgentEvent } from "@/lib/ai/agent";
import { ModelEligibilityError, resolveEligibleModel, selectModelForTask } from "@/lib/ai/eligibility";
import { MODES, maxSteps } from "@/lib/ai/modes";
import { modePrompt, projectContext, SECURITY_PREAMBLE } from "@/lib/ai/prompts";
import type { ChatMessage } from "@/lib/ai/types";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";
import { redactSecrets } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sse(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function flattenTree(node: any, depth = 0, out: string[] = []): string[] {
  if (out.length > 150) return out;
  const pad = "  ".repeat(depth);
  out.push(node.type === "directory" ? `${pad}${node.name}/` : `${pad}${node.name}`);
  for (const child of node.children ?? []) flattenTree(child, depth + 1, out);
  return out;
}

const BodySchema = z.object({
  content: z.string().min(1).max(20_000),
  modelRef: z.string().max(300).optional().nullable(),
  mode: z.enum(MODES as [string, ...string[]]).optional(),
});

export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  await assertCsrf(request, auth);
  enforceRateLimit(`chat-send:${auth.user.id}`, 40, 600);
  const body = await parseJson(request, BodySchema);
  const chat = requireChat(auth.user.id, id);
  if (body.mode || body.modelRef) {
    updateChat(auth.user.id, id, { mode: body.mode as any, modelRef: body.modelRef });
  }
  const mode = (body.mode ?? chat.mode) as any;
  const project = chat.project_id ? getProject(auth.user.id, chat.project_id) : undefined;
  const repository = chat.repository_id ? getRepository(auth.user.id, chat.repository_id) : undefined;

  let ref = body.modelRef ?? chat.model_ref;
  let selectionNote: string | null = null;
  if (!ref) {
    const smart = selectModelForTask(auth.user.id, { tools: mode !== "ask" });
    ref = smart?.ref ?? null;
    selectionNote = smart?.reason ?? null;
  }
  let modelInfo: { provider: string; model: string; pricingStatus: string } | null = null;
  try {
    const resolved = resolveEligibleModel(auth.user.id, ref);
    modelInfo = {
      provider: resolved.provider.name,
      model: resolved.model.display_name,
      pricingStatus: resolved.model.pricing_status,
    };
  } catch (error) {
    if (error instanceof ModelEligibilityError) {
      throw new ApiError(
        `${error.message} Configure an eligible provider in Provider Manager, or mark a model verified free after confirming its pricing.`,
        403,
        "model_ineligible",
      );
    }
    throw error;
  }

  const userMessage = appendMessage(auth.user.id, id, { role: "user", content: body.content, modelRef: ref });
  const history = listMessages(auth.user.id, id, 40)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-30)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  let tree: string | null = null;
  if (project) {
    try {
      tree = flattenTree(await listTree(auth.user.id, project.id)).slice(0, 150).join("\n");
    } catch {
      tree = null;
    }
  }
  const systemPrompt = [
    SECURITY_PREAMBLE,
    modePrompt(mode),
    projectContext({
      projectName: project?.name,
      tree,
      repository: repository?.full_name,
      branch: chat.branch,
    }),
  ].join("\n\n");

  const encoderEvents: AgentEvent[] = [];
  const interrupted = { value: false };
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent | Record<string, unknown>) => {
        try {
          controller.enqueue(sse(event));
        } catch {
          // client disconnected
        }
        if ("type" in event && typeof event.type === "string") {
          encoderEvents.push(event as AgentEvent);
        }
      };
      emit({ type: "meta", messageId: userMessage.id, model: modelInfo, selectionNote, maxSteps: maxSteps(mode) });
      let text = "";
      let citations: any[] = [];
      try {
        const result = await runAgent({
          userId: auth.user.id,
          mode,
          modelRef: ref!,
          messages: history as ChatMessage[],
          systemPrompt,
          projectId: project?.id ?? null,
          repositoryId: repository?.id ?? null,
          signal: request.signal,
          onEvent: (event) => {
            if (event.type === "text") text += event.text;
            if (event.type === "citation") citations.push(event.citation);
            emit(event);
          },
        });
        text = result.text || text;
        if (!citations.length) citations = result.citations;
        const saved = appendMessage(auth.user.id, id, {
          role: "assistant",
          content: redactSecrets(text),
          modelRef: ref,
          citations,
          events: encoderEvents.filter((e) => e.type === "tool_result" || e.type === "plan" || e.type === "fallback" || e.type === "model").slice(0, 100),
          status: request.signal.aborted ? "stopped" : "complete",
        });
        emit({ type: "saved", messageId: saved.id, citations: citations.length });
      } catch (error) {
        const message = redactSecrets(error instanceof Error ? error.message : "Generation failed.");
        const saved = appendMessage(auth.user.id, id, {
          role: "assistant",
          content: text,
          modelRef: ref,
          citations,
          status: "error",
          error: message,
        });
        emit({ type: "error", message });
        emit({ type: "saved", messageId: saved.id, citations: citations.length });
        audit(request, auth.user.id, "chat.generation_failed", chat.id);
      } finally {
        interrupted.value = request.signal.aborted;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
});
