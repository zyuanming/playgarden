# Project license, prior releases, and complete corresponding source

## Current project terms

Effective with the first commit containing this notice, Playgarden's project-authored material and contributions we have the right to relicense are distributed under **GNU GPL version 3 only**, SPDX `GPL-3.0-only`. The complete, unmodified license is in the repository root `LICENSE` and the website's `playgarden-COPYING.txt`. Copyright (c) 2026 YuanMing applies to those project contributions, not to upstream contributors' work.

Unless separately identified, this covers our code, tests, build and generation scripts, teaching text and puzzle data, documentation, and original graphics for which we hold applicable rights. It does not claim exclusive copyright over public-domain, uncopyrightable or externally owned material. Asset provenance remains documented separately in THIRD_PARTY_NOTICES. No noncommercial condition or mandatory contribution-back-to-this-repository condition is added. This is GPL-3.0-only, not AGPL and not GPL-3.0-or-later.

GPL permits commercial use. Its source and licensing obligations apply to covered distribution/conveyance as described by the license; this notice does not claim that merely running a private modification or hosting a server always requires publication of that private source.

## Third-party components are not relabeled

MIT, BSD-2-Clause, ISC and other third-party notices remain in their original form. Upstream source snapshots, license files, attribution, authors and fixed-version records remain intact. Attributed adaptations separately identify Playgarden modifications and their date; our changes may be GPL-covered while the original portions retain their upstream terms. See THIRD_PARTY_NOTICES.md and the self-contained public THIRD_PARTY_NOTICES.txt for the shipped runtime notices.

The runtime uses React, React DOM and scheduler (MIT), Three.js (MIT), lucide-react (ISC), adapted Slant and open-gomoku sources (MIT), the Xiangqi rule component (BSD-2-Clause), and the runner modules (MIT). Referenced Black Box source is retained with its MIT license but is not executed. Toolchain licenses remain their own; their presence does not relicense the tools. External assets, fonts, puzzle collections and future candidate games always need their own review. No Night Patrol noncommercial assets or unlicensed Diver code are added by this change.

## Earlier MIT releases keep their rights

The earlier repository version through commit `0e46980f321d9348ff13020f8583a81591c96d3c` was distributed under its existing MIT grant, subject to separately licensed components. Those already granted rights are not retroactively withdrawn. The previous project notice is retained for historical reference in `docs/licensing-history/MIT-through-0e46980.txt`, and the exact historical tree is available at https://github.com/zyuanming/playgarden/tree/0e46980f321d9348ff13020f8583a81591c96d3c . That historical file is not an offer to dual-license new GPL-covered contributions under MIT.

## Obtain the source matching the browser build

Every deployed page carries its exact 40-character build revision in `index.html`, in the `playgarden-commit` meta element. The visible “本版本完整源码与构建说明” link reads that revision and links to `https://github.com/zyuanming/playgarden/tree/REVISION`, rather than relying on a moving homepage or a potentially newer main branch. The tree's Code menu provides a source ZIP; Git may check out the same revision. Development builds with no stamped revision link to main and are not claimed to be a published revision.

That tree includes the preferred editable application sources, complete puzzle data and certificates, original programmatic graphics, supplied artwork, source snapshots and license notices, package-lock, test and generator sources, build configuration and CI/deployment scripts. No private generator, model service, account, secret or remote AI is required. GitHub distributes this corresponding source without an additional fee. Preserve an equally clear source-access route when redistributing built copies; a minified JS bundle alone is not the complete corresponding source.

Use Node 24 and npm: run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build -- --base=/playgarden/`. The Pages workflow also stamps the exact commit in the generated HTML and performs preview/public verification. The binary artwork supplied in `public/` is included; editable SVG sources accompany the programmatic cards. See README and per-game provenance files for source and asset details.

## Exact editable sources of bundled non-system libraries

The complete source route also includes the following exact upstream source trees, served without additional charge. These contain the preferred editable sources and build scripts, not just precompiled npm files. The versions match package-lock.json and the installed packages used for the build. The project lockfile retains the resolved package URLs and integrity digests; `docs/runtime-source-manifest.json` supplies machine-readable mappings. Distributors are responsible for keeping corresponding-source access available, including when source is served from these different servers.

| Distributed component | Exact upstream source and build material |
| --- | --- |
| React / React DOM 19.3.0; scheduler 0.28.0 | [react/react v19.3.0, commit 1d34f91](https://github.com/react/react/tree/1d34f91dfde6bba84d08b683aaba164c7194dacb): packages/*/src, scripts/rollup, root package and yarn configuration |
| Three.js 0.180.0 | [mrdoob/three.js r180, commit 0af9729](https://github.com/mrdoob/three.js/tree/0af9729d0c143a86a1d725d6e2c3ad83301f3f34): src and utils/build/rollup.config.js |
| lucide-react 0.468.0 | [lucide-icons/lucide 0.468.0, commit f12b0de](https://github.com/lucide-icons/lucide/tree/f12b0de177fbc2a6795e99be065887e72b237123): packages/lucide-react/src, editable icons/*.svg and release/build scripts; the tagged source uses a version placeholder, and .github/workflows/release.yml sets the release version before build/publish |
| Vite 7.3.6 emitted preload helper | [vitejs/vite v7.3.6, commit 0a7b53b](https://github.com/vitejs/vite/tree/0a7b53ba230c6e68f502a89864534c607d393ab7): packages/vite/src/node/plugins/modulePreloadPolyfill.ts, importAnalysisBuild.ts and package build configuration |

The complete editable upstream Slant/open-gomoku/Xiangqi/runner source snapshots are already retained in this repository with their fixed-version manifests and full original notices.

## License text provenance

The exact GPLv3 text was obtained from the SPDX license-list-data repository, `text/GPL-3.0-only.txt`, Git blob `f6cdd22a6c1fbc887e08a215cb4beb3c47048041`: https://github.com/spdx/license-list-data/blob/main/text/GPL-3.0-only.txt . Its concluding “How to Apply” section is a general FSF template; the project's actual grant is expressly version 3 only as stated here. Do not change the license's verbatim text to edit that template.
