import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { TERMS_MD } = await import("../src/content/legal/terms.ts");
const { PRIVACY_MD } = await import("../src/content/legal/privacy.ts");
const { ACCEPTABLE_USE_MD } = await import("../src/content/legal/acceptable-use.ts");

const docs = {
  terms: TERMS_MD,
  privacy: PRIVACY_MD,
  "acceptable-use": ACCEPTABLE_USE_MD,
};

await fs.mkdir(path.join(root, "docs", "legal"), { recursive: true });
for (const [slug, body] of Object.entries(docs)) {
  const file = path.join(root, "docs", "legal", `${slug}.md`);
  await fs.writeFile(file, body, "utf8");
  console.log(`wrote ${path.relative(root, file)}`);
}
