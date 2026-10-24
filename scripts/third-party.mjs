import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const names = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);

const rows = [];
for (const name of [...names].sort()) {
  try {
    const meta = JSON.parse(await fs.readFile(path.join(root, "node_modules", name, "package.json"), "utf8"));
    const license = typeof meta.license === "string" ? meta.license : meta.license?.type ?? "see package";
    rows.push(`| ${name} | ${meta.version ?? ""} | ${license} | ${meta.homepage ?? meta.repository?.url ?? ""} |`);
  } catch {
    rows.push(`| ${name} | unknown | unknown | — |`);
  }
}

const content = `# Third-party notices

X-Flex is MIT licensed. It depends on the packages below, each under its own license.

This file lists **direct** dependencies declared in \`package.json\`. Transitive dependencies carry their own licenses in \`node_modules\`; run \`scripts/third-party.mjs\` after changing dependencies and review the full dependency tree before redistributing a build.

## Runtime dependencies

| Package | Version | License | Homepage |
| --- | --- | --- | --- |
${rows.filter((row) => Object.keys(pkg.dependencies ?? {}).some((dep) => row.startsWith(`| ${dep} |`))).join("\n")}

## Development dependencies

| Package | Version | License | Homepage |
| --- | --- | --- | --- |
${rows.filter((row) => Object.keys(pkg.devDependencies ?? {}).some((dep) => row.startsWith(`| ${dep} |`))).join("\n")}

## Bundled assets

No third-party fonts, images, or icon packs are bundled. The interface uses system fonts and text/CSS icons. Monaco Editor is loaded by \`@monaco-editor/react\`; its distribution remains under the MIT License and its bundled language definitions carry their respective notices.

## Notes

- MIT, Apache-2.0, BSD and ISC licenses permit redistribution with attribution; retain their notices.
- This file is not a substitute for reviewing the complete dependency tree and the licenses of any assets you add.
- If you add a dependency, add it to \`package.json\`, then regenerate this file with \`node scripts/third-party.mjs\`.
`;

await fs.writeFile(path.join(root, "THIRD_PARTY_NOTICES.md"), content, "utf8");
console.log(`wrote THIRD_PARTY_NOTICES.md (${rows.length} direct dependencies)`);
