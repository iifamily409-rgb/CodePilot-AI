import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { streamChat } from "@/lib/ai/adapters";
import type { ProviderRow } from "@/lib/ai/types";
import { parseDuckDuckGoHtml, extractMainText, decodeEntities } from "@/lib/research/html";

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/v1/models") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: "mock", name: "Mock" }] }));
      return;
    }
    if (req.url === "/v1/chat/completions") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `model=${parsed.model};stream=${parsed.stream};fallbacks=${parsed.provider?.allow_fallbacks}` } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: " ok" } }] })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      });
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "not found" } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function provider(protocol: ProviderRow["protocol"] = "openai_compatible"): ProviderRow {
  return {
    id: "prv_test",
    user_id: "usr_test",
    name: "Mock",
    protocol,
    base_url: baseUrl,
    auth_type: "none",
    api_key_enc: null,
    headers_enc: null,
    enabled: 1,
    allow_private: 1,
    last_check_at: null,
    last_check_ok: null,
    last_check_message: null,
    created_at: "",
    updated_at: "",
  };
}

async function collect(generator: AsyncGenerator<any>): Promise<any[]> {
  const events: any[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

describe("OpenAI-compatible adapter", () => {
  it("streams text deltas from a local endpoint", async () => {
    const events = await collect(
      streamChat({
        provider: provider(),
        apiKey: null,
        headers: {},
        modelId: "mock-model",
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    const text = events.filter((e) => e.type === "text").map((e) => e.text).join("");
    expect(text).toBe("model=mock-model;stream=true;fallbacks=undefined ok");
    expect(events.at(-1)?.type).toBe("done");
  });

  it("disables OpenRouter router fallbacks so a paid model cannot be substituted", async () => {
    const events = await collect(
      streamChat({
        provider: provider("openrouter"),
        apiKey: "key",
        headers: {},
        modelId: "free/model",
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    const text = events.filter((e) => e.type === "text").map((e) => e.text).join("");
    expect(text).toContain("fallbacks=false");
  });

  it("reports provider HTTP errors instead of inventing success", async () => {
    const bad = { ...provider(), base_url: `${baseUrl}/missing` };
    const events = await collect(
      streamChat({ provider: bad, apiKey: null, headers: {}, modelId: "x", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(events.some((e) => e.type === "error")).toBe(true);
  });
});

describe("research HTML parsing", () => {
  it("extracts real result titles, URLs and snippets", () => {
    const html = `
      <div class="result results_links">
        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fnextjs.org%2Fdocs&amp;rut=abc">Next.js <b>Docs</b></a>
        <a class="result__snippet" href="#">Official Next.js documentation &amp; guides.</a>
      </div>`;
    const hits = parseDuckDuckGoHtml(html);
    expect(hits[0].url).toBe("https://nextjs.org/docs");
    expect(hits[0].title).toContain("Next.js");
    expect(hits[0].snippet).toContain("Official Next.js documentation & guides.");
  });

  it("strips scripts and decodes entities for page text", () => {
    const text = extractMainText("<html><head><title>A &amp; B</title></head><body><script>alert(1)</script><p>Hello&nbsp;world</p></body></html>");
    expect(text).toContain("A & B");
    expect(text).not.toContain("alert(1)");
    expect(decodeEntities("&#39;quoted&#39;")).toBe("'quoted'");
  });
});
