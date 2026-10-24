# Third-party notices

X-Flex is MIT licensed. It depends on the packages below, each under its own license.

This file lists **direct** dependencies declared in `package.json`. Transitive dependencies carry their own licenses in `node_modules`; run `scripts/third-party.mjs` after changing dependencies and review the full dependency tree before redistributing a build.

## Runtime dependencies

| Package | Version | License | Homepage |
| --- | --- | --- | --- |
| @monaco-editor/react | 4.7.0 | MIT | https://github.com/suren-atoyan/monaco-react#readme |
| better-sqlite3 | 13.0.3 | MIT | http://github.com/WiseLibs/better-sqlite3 |
| diff | 8.0.4 | BSD-3-Clause | https://github.com/kpdecker/jsdiff.git |
| highlight.js | 11.12.0 | BSD-3-Clause | https://highlightjs.org/ |
| jszip | 3.10.2 | (MIT OR GPL-3.0-or-later) | https://github.com/Stuk/jszip.git |
| monaco-editor | 0.55.1 | MIT | https://github.com/microsoft/monaco-editor |
| next | 15.5.28 | MIT | https://nextjs.org |
| react | 19.3.1 | MIT | https://react.dev/ |
| react-dom | 19.3.1 | MIT | https://react.dev/ |
| react-markdown | 10.1.0 | MIT |  |
| rehype-highlight | 7.0.2 | MIT |  |
| remark-gfm | 4.0.1 | MIT |  |
| server-only | 0.0.1 | MIT | https://reactjs.org/ |
| zod | 4.6.7 | MIT | https://zod.dev |

## Development dependencies

| Package | Version | License | Homepage |
| --- | --- | --- | --- |
| @eslint/eslintrc | 3.3.7 | MIT | https://github.com/eslint/eslintrc#readme |
| @tailwindcss/postcss | 4.3.3 | MIT | https://tailwindcss.com |
| @types/better-sqlite3 | 7.6.13 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/better-sqlite3 |
| @types/diff | 7.0.2 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/diff |
| @types/node | 22.20.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node |
| @types/react | 19.3.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react |
| @types/react-dom | 19.3.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom |
| eslint | 9.39.5 | MIT | https://eslint.org |
| eslint-config-next | 15.5.28 | MIT | https://nextjs.org/docs/app/api-reference/config/eslint |
| tailwindcss | 4.3.3 | MIT | https://tailwindcss.com |
| typescript | 5.9.3 | Apache-2.0 | https://www.typescriptlang.org/ |
| vitest | 3.2.7 | MIT | https://github.com/vitest-dev/vitest#readme |

## Bundled assets

No third-party fonts, images, or icon packs are bundled. The interface uses system fonts and text/CSS icons. Monaco Editor is loaded by `@monaco-editor/react`; its distribution remains under the MIT License and its bundled language definitions carry their respective notices.

## Notes

- MIT, Apache-2.0, BSD and ISC licenses permit redistribution with attribution; retain their notices.
- This file is not a substitute for reviewing the complete dependency tree and the licenses of any assets you add.
- If you add a dependency, add it to `package.json`, then regenerate this file with `node scripts/third-party.mjs`.
