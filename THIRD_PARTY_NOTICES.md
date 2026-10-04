# Third-party notices

The original Playgarden code is MIT licensed; see LICENSE. This inventory covers direct dependencies, not a claim that every future candidate game or asset has been audited. Installed packages retain their upstream license files. See package-lock.json for exact resolved versions.

| Package                                                   | License    | Upstream                                           |
| --------------------------------------------------------- | ---------- | -------------------------------------------------- |
| React / React DOM                                         | MIT        | https://github.com/facebook/react                  |
| Three.js                                                  | MIT        | https://github.com/mrdoob/three.js                 |
| lucide-react                                              | ISC        | https://github.com/lucide-icons/lucide             |
| Vite                                                      | MIT        | https://github.com/vitejs/vite                     |
| TypeScript                                                | Apache-2.0 | https://github.com/microsoft/TypeScript            |
| Vitest                                                    | MIT        | https://github.com/vitest-dev/vitest               |
| Prettier                                                  | MIT        | https://github.com/prettier/prettier               |
| Testing Library                                           | MIT        | https://github.com/testing-library                 |
| jsdom                                                     | MIT        | https://github.com/jsdom/jsdom                     |
| Playwright                                                | Apache-2.0 | https://github.com/microsoft/playwright            |
| @types/node, @types/react, @types/react-dom, @types/three | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped |

The project does not import Three.js example assets or any third-party game source. Candidate resources in docs/OPEN_SOURCE_RESOURCES.md are references only, not bundled dependencies.

Catalog art: AI-generated original artwork commissioned for Playgarden, generated using OpenAI image generation on 2026-10-04. No external licensed character, game logo, or stock image is used. Geometry and gameplay content are original. System fonts are used; no font files are bundled.

Redistributors must retain relevant upstream notices when distributing dependency code. The dependency license texts are included in node_modules after npm ci; a license inventory is not a substitute for those texts.
