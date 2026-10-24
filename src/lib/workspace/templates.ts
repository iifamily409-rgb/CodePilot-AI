import "server-only";

export type TemplateId =
  | "blank"
  | "website"
  | "landing"
  | "dashboard"
  | "portfolio"
  | "blog"
  | "api"
  | "python"
  | "fullstack";

export const TEMPLATES: Array<{
  id: TemplateId;
  name: string;
  description: string;
  preview: boolean;
  language: string;
}> = [
  { id: "blank", name: "Blank project", description: "A README and an empty workspace you can fill from chat.", preview: false, language: "text" },
  { id: "website", name: "Website", description: "Responsive multi-section site with HTML, CSS and vanilla JS.", preview: true, language: "html" },
  { id: "landing", name: "Landing page", description: "Single-page product landing page with hero, features and CTA.", preview: true, language: "html" },
  { id: "dashboard", name: "Dashboard", description: "Static analytics dashboard with charts drawn on canvas.", preview: true, language: "html" },
  { id: "portfolio", name: "Portfolio", description: "Developer portfolio with project cards and contact section.", preview: true, language: "html" },
  { id: "blog", name: "Blog", description: "Static blog with posts rendered from a JavaScript data file.", preview: true, language: "html" },
  { id: "api", name: "Node.js API", description: "Dependency-free HTTP API with node:test tests.", preview: false, language: "javascript" },
  { id: "python", name: "Python script", description: "Python module with unittest coverage.", preview: false, language: "python" },
  { id: "fullstack", name: "Full-stack app", description: "Node HTTP server serving a UI plus a JSON API, with tests.", preview: true, language: "javascript" },
];

function page(title: string, body: string, styles = "style.css", script = "app.js") {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="${styles}" />
</head>
<body>
${body}
  <script src="${script}"></script>
</body>
</html>
`;
}

const STYLE = `:root {
  color-scheme: dark;
  --bg: #0b0e14;
  --panel: #121722;
  --text: #e6edf3;
  --muted: #93a1b1;
  --accent: #22d3ee;
  --violet: #a78bfa;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  background: radial-gradient(1200px 600px at 20% -10%, #172033 0%, var(--bg) 60%);
  color: var(--text);
  line-height: 1.6;
}
header.site {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2rem;
  border-bottom: 1px solid #1e2635;
}
nav a { color: var(--muted); text-decoration: none; margin-left: 1rem; }
nav a:hover { color: var(--accent); }
.logo { font-weight: 700; letter-spacing: -0.02em; }
.logo span { color: var(--accent); }
main { max-width: 1040px; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
h1 { font-size: clamp(2rem, 5vw, 3.25rem); line-height: 1.1; margin: 0 0 1rem; letter-spacing: -0.03em; }
h2 { margin-top: 2.5rem; font-size: 1.4rem; }
p.lead { color: var(--muted); font-size: 1.125rem; max-width: 62ch; }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 2rem; }
.card { background: var(--panel); border: 1px solid #1e2635; border-radius: 14px; padding: 1.25rem; }
.card h3 { margin: 0 0 .4rem; font-size: 1rem; }
.card p { margin: 0; color: var(--muted); font-size: .925rem; }
.button {
  display: inline-block;
  margin-top: 1.5rem;
  padding: .7rem 1.2rem;
  border-radius: 10px;
  background: linear-gradient(120deg, var(--accent), var(--violet));
  color: #06121a;
  font-weight: 600;
  text-decoration: none;
}
footer { padding: 2rem; border-top: 1px solid #1e2635; color: var(--muted); font-size: .875rem; }
canvas { width: 100%; height: auto; }
`;

export function buildTemplate(template: TemplateId, name: string): Record<string, string> {
  const safeName = name.replace(/[<>&"]/g, "").slice(0, 80) || "Project";
  const readme = `# ${safeName}\n\nGenerated with X-Flex.\n`;

  if (template === "blank") {
    return {
      "README.md": `# ${safeName}\n\nDescribe your project here, then ask X-Flex in Code mode to start building.\n`,
      "notes.md": "# Notes\n\n- What are you building?\n- What should it do?\n",
    };
  }

  if (template === "api") {
    return {
      "package.json": JSON.stringify(
        {
          name: "xflex-api",
          version: "1.0.0",
          private: true,
          type: "module",
          scripts: { start: "node src/server.js", test: "node --test" },
        },
        null,
        2,
      ),
      "src/server.js": `import http from "node:http";\nimport { json, notFound } from "./router.js";\n\nexport function createServer() {\n  return http.createServer((req, res) => {\n    const url = new URL(req.url ?? "/", "http://localhost");\n    if (url.pathname === "/api/health") return json(res, 200, { status: "ok" });\n    if (url.pathname === "/api/items") return json(res, 200, { items: [{ id: 1, title: "First item" }] });\n    return notFound(res);\n  });\n}\n\nif (import.meta.url === \`file://\${process.argv[1]}\`) {\n  const port = Number(process.env.PORT ?? 3001);\n  createServer().listen(port, () => console.log(\`API listening on http://localhost:\${port}\`));\n}\n`,
      "src/router.js": `export function json(res, status, body) {\n  res.writeHead(status, { "content-type": "application/json" });\n  res.end(JSON.stringify(body));\n}\n\nexport function notFound(res) {\n  json(res, 404, { error: "Not found" });\n}\n`,
      "test/api.test.js": `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { createServer } from "../src/server.js";\n\ntest("health endpoint responds", async () => {\n  const server = createServer();\n  await new Promise((resolve) => server.listen(0, resolve));\n  const port = server.address().port;\n  const res = await fetch(\`http://127.0.0.1:\${port}/api/health\`);\n  assert.equal(res.status, 200);\n  const body = await res.json();\n  assert.equal(body.status, "ok");\n  server.close();\n});\n`,
      "README.md": `# ${safeName}\n\nDependency-free Node.js API.\n\n\`\`\`bash\nnpm test\nnpm start\n\`\`\`\n\nEndpoints: \`GET /api/health\`, \`GET /api/items\`.\n`,
    };
  }

  if (template === "python") {
    return {
      "main.py": `\"\"\"${safeName} - entry point.\"\"\"\n\n\ndef greet(name: str) -> str:\n    \"\"\"Return a greeting.\"\"\"\n    cleaned = name.strip()\n    if not cleaned:\n        raise ValueError(\"name must not be empty\")\n    return f\"Hello, {cleaned}!\"\n\n\ndef main() -> None:\n    print(greet(\"X-Flex\"))\n\n\nif __name__ == \"__main__\":\n    main()\n`,
      "test_main.py": `import unittest\n\nfrom main import greet\n\n\nclass GreetTests(unittest.TestCase):\n    def test_greet(self):\n        self.assertEqual(greet(\"Ada\"), \"Hello, Ada!\")\n\n    def test_greet_rejects_blank(self):\n        with self.assertRaises(ValueError):\n            greet(\"   \")\n\n\nif __name__ == \"__main__\":\n    unittest.main()\n`,
      "README.md": `# ${safeName}\n\n\`\`\`bash\npython3 -m unittest -v\npython3 main.py\n\`\`\`\n`,
    };
  }

  if (template === "landing") {
    return {
      "index.html": page(
        safeName,
        `<header class="site"><div class="logo">${safeName}<span>.</span></div><nav><a href="#features">Features</a></nav></header>
<main>
  <p style="color:var(--accent);font-weight:600">Now in early access</p>
  <h1>Build something people remember.</h1>
  <p class="lead">A focused landing page you can edit in X-Flex. Change the copy, wire the call to action, then ship.</p>
  <a class="button" href="#features">Explore features</a>
  <section id="features" class="grid">
    <div class="card"><h3>Fast</h3><p>Plain HTML, CSS and JavaScript with no build step.</p></div>
    <div class="card"><h3>Accessible</h3><p>Semantic structure, visible focus states and readable contrast.</p></div>
    <div class="card"><h3>Yours</h3><p>Download as a ZIP or push to a GitHub branch you control.</p></div>
  </section>
</main>
<footer>© <span id="year"></span> ${safeName}</footer>`,
      ),
      "style.css": STYLE,
      "app.js": `document.getElementById("year").textContent = new Date().getFullYear();\n`,
      "README.md": readme.replace("Generated with X-Flex.", "Static landing page generated with X-Flex."),
    };
  }

  if (template === "dashboard") {
    return {
      "index.html": page(
        `${safeName} dashboard`,
        `<header class="site"><div class="logo">${safeName}<span>/</span>dashboard</div><nav><a href="#">Overview</a></nav></header>
<main>
  <h1>Overview</h1>
  <p class="lead">Sample metrics rendered with the Canvas API from local data. No tracking, no external requests.</p>
  <section class="grid">
    <div class="card"><h3>Active projects</h3><p id="metric-projects">—</p></div>
    <div class="card"><h3>Tasks completed</h3><p id="metric-tasks">—</p></div>
    <div class="card"><h3>Checks passing</h3><p id="metric-checks">—</p></div>
  </section>
  <section class="card" style="margin-top:1.5rem">
    <h3>Weekly activity</h3>
    <canvas id="chart" width="900" height="260" role="img" aria-label="Weekly activity chart"></canvas>
  </section>
</main>`,
      ),
      "style.css": STYLE,
      "app.js": `const data = [12, 18, 9, 22, 27, 16, 24];\nconst labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];\ndocument.getElementById("metric-projects").textContent = "7";\ndocument.getElementById("metric-tasks").textContent = "128";\ndocument.getElementById("metric-checks").textContent = "96%";\n\nconst canvas = document.getElementById("chart");\nconst ctx = canvas.getContext("2d");\nconst w = canvas.width;\nconst h = canvas.height;\nconst pad = 36;\nconst max = Math.max(...data);\nctx.strokeStyle = "#1e2635";\nctx.beginPath();\nfor (let i = 0; i <= 4; i++) {\n  const y = pad + ((h - pad * 2) / 4) * i;\n  ctx.moveTo(pad, y);\n  ctx.lineTo(w - pad, y);\n}\nctx.stroke();\nctx.beginPath();\ndata.forEach((value, index) => {\n  const x = pad + ((w - pad * 2) / (data.length - 1)) * index;\n  const y = h - pad - ((h - pad * 2) * value) / max;\n  if (index === 0) ctx.moveTo(x, y);\n  else ctx.lineTo(x, y);\n});\nconst gradient = ctx.createLinearGradient(0, 0, w, 0);\ngradient.addColorStop(0, "#22d3ee");\ngradient.addColorStop(1, "#a78bfa");\nctx.strokeStyle = gradient;\nctx.lineWidth = 3;\nctx.stroke();\nctx.fillStyle = "#93a1b1";\nctx.font = "12px system-ui";\nlabels.forEach((label, index) => {\n  const x = pad + ((w - pad * 2) / (data.length - 1)) * index;\n  ctx.fillText(label, x - 10, h - 12);\n});\n`,
      "README.md": readme.replace("Generated with X-Flex.", "Static dashboard generated with X-Flex."),
    };
  }

  if (template === "portfolio") {
    return {
      "index.html": page(
        safeName,
        `<header class="site"><div class="logo">${safeName}</div><nav><a href="#work">Work</a> <a href="#contact">Contact</a></nav></header>
<main>
  <h1>Developer &amp; builder</h1>
  <p class="lead">I build careful, fast interfaces and the systems behind them. Replace this copy with your own story.</p>
  <h2 id="work">Selected work</h2>
  <section class="grid">
    <article class="card"><h3>Project one</h3><p>Short description of the problem, your approach and the result.</p></article>
    <article class="card"><h3>Project two</h3><p>Short description of the problem, your approach and the result.</p></article>
    <article class="card"><h3>Project three</h3><p>Short description of the problem, your approach and the result.</p></article>
  </section>
  <h2 id="contact">Contact</h2>
  <p class="lead">Add your preferred contact method here — never commit private credentials.</p>
</main>`,
      ),
      "style.css": STYLE,
      "app.js": `console.log("Portfolio ready");\n`,
      "README.md": readme.replace("Generated with X-Flex.", "Portfolio generated with X-Flex."),
    };
  }

  if (template === "blog") {
    return {
      "index.html": page(
        safeName,
        `<header class="site"><div class="logo">${safeName}</div><nav><a href="#posts">Posts</a></nav></header>
<main><h1>Writing</h1><p class="lead">Posts are rendered from <code>posts.js</code>. Add an entry and reload.</p><section id="posts" class="grid"></section></main>`,
      ),
      "style.css": STYLE,
      "posts.js": `export const posts = [\n  {\n    title: "Hello, world",\n    date: "2026-01-01",\n    summary: "The first post on this static blog.",\n    body: "Edit posts.js to publish real writing. Everything stays local.",\n  },\n];\n`,
      "app.js": `import { posts } from "./posts.js";\n\nconst container = document.getElementById("posts");\nfor (const post of posts) {\n  const article = document.createElement("article");\n  article.className = "card";\n  const heading = document.createElement("h3");\n  heading.textContent = post.title;\n  const meta = document.createElement("p");\n  meta.textContent = post.date;\n  const summary = document.createElement("p");\n  summary.textContent = post.summary;\n  article.append(heading, meta, summary);\n  container.append(article);\n}\n`,
      "README.md": readme.replace("Generated with X-Flex.", "Static blog generated with X-Flex."),
    };
  }

  if (template === "fullstack") {
    return {
      "package.json": JSON.stringify(
        {
          name: "fullstack-app",
          version: "1.0.0",
          private: true,
          type: "module",
          scripts: { start: "node server.js", test: "node --test" },
        },
        null,
        2,
      ),
      "server.js": `import http from "node:http";\nimport { readFile } from "node:fs/promises";\nimport path from "node:path";\n\nconst root = path.dirname(new URL(import.meta.url).pathname);\nconst messages = [{ id: 1, text: "Ship something small today." }];\n\nexport function createServer() {\n  return http.createServer(async (req, res) => {\n    if (req.url === "/api/messages" && req.method === "GET") {\n      res.writeHead(200, { "content-type": "application/json" });\n      return res.end(JSON.stringify({ messages }));\n    }\n    const file = req.url === "/" ? "index.html" : (req.url ?? "").slice(1);\n    try {\n      const content = await readFile(path.join(root, "public", file));\n      const type = file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : "text/html";\n      res.writeHead(200, { "content-type": \`\${type}; charset=utf-8\` });\n      res.end(content);\n    } catch {\n      res.writeHead(404, { "content-type": "text/plain" });\n      res.end("Not found");\n    }\n  });\n}\n\nif (import.meta.url === \`file://\${process.argv[1]}\`) {\n  const port = Number(process.env.PORT ?? 3002);\n  createServer().listen(port, () => console.log(\`App on http://localhost:\${port}\`));\n}\n`,
      "public/index.html": page(
        safeName,
        `<header class="site"><div class="logo">${safeName}</div></header>\n<main><h1>Messages</h1><p class="lead">Served by a dependency-free Node HTTP server.</p><section id="list" class="grid"></section></main>`,
      ),
      "public/style.css": STYLE,
      "public/app.js": `const res = await fetch("/api/messages");\nconst { messages } = await res.json();\nconst list = document.getElementById("list");\nfor (const message of messages) {\n  const card = document.createElement("div");\n  card.className = "card";\n  card.textContent = message.text;\n  list.append(card);\n}\n`,
      "test/server.test.js": `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { createServer } from "../server.js";\n\ntest("api returns messages", async () => {\n  const server = createServer();\n  await new Promise((resolve) => server.listen(0, resolve));\n  const port = server.address().port;\n  const res = await fetch(\`http://127.0.0.1:\${port}/api/messages\`);\n  assert.equal(res.status, 200);\n  const body = await res.json();\n  assert.ok(Array.isArray(body.messages));\n  server.close();\n});\n`,
      "README.md": `# ${safeName}\n\nFull-stack starter: Node HTTP server + JSON API + static UI.\n\n\`\`\`bash\nnpm test\nnpm start\n\`\`\`\n`,
    };
  }

  return {
    "index.html": page(
      safeName,
      `<header class="site"><div class="logo">${safeName}<span>.</span></div><nav><a href="#about">About</a> <a href="#contact">Contact</a></nav></header>
<main>
  <h1>${safeName}</h1>
  <p class="lead">This is a working static website: semantic HTML, responsive CSS and a small script. Replace the copy and ask X-Flex in Code mode to extend it.</p>
  <section id="about" class="grid">
    <div class="card"><h3>Responsive</h3><p>Fluid type and a grid that adapts to small screens.</p></div>
    <div class="card"><h3>Accessible</h3><p>Real headings, landmarks and keyboard-friendly links.</p></div>
    <div class="card"><h3>Portable</h3><p>No build step, no dependencies — download the ZIP and open it anywhere.</p></div>
  </section>
  <h2 id="contact">Contact</h2>
  <p class="lead">Add your contact details here.</p>
</main>
<footer>© <span id="year"></span> ${safeName}</footer>`,
    ),
    "style.css": STYLE,
    "app.js": `document.getElementById("year").textContent = new Date().getFullYear();\n`,
    "README.md": readme,
  };
}

export function previewEntry(files: Array<{ path: string }>): string | null {
  if (files.some((f) => f.path === "index.html")) return "index.html";
  if (files.some((f) => f.path === "public/index.html")) return "public/index.html";
  return null;
}
