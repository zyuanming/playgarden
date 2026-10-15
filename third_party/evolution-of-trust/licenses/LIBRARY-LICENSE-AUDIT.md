# Trust third-party library audit

Audited 2026-10-12, pinned ncase/trust commit `6ec45d73befdb922bd40654dd1c1c903a953562f`.

The requested seven vendored libraries are identified. The collection includes full MIT, Apache-2.0, ISC, BSD-3-Clause and CC0 texts/notices applicable to the identified code, including Pixi's embedded dependencies. No incompatible license was identified for a GPLv3 host. Do not describe the entire game distribution or vendor directory as CC0.

This is an audit and notice package, not a runtime change. No upstream source was installed or executed. Only this licenses directory was written.

The seven current materialized source files were re-read at final freeze and their byte lengths, Git blob SHAs and SHA-256 values verified against materialized-text-manifest.json. Early extra-newline artifacts are not part of the frozen comparison.

## Reviewable deliverables

- `library-manifest.json`: all seven top-level files, SHA-256 hashes, upstream URLs, modification descriptions, and 18 Pixi component/notice entries.
- `THIRD-PARTY-NOTICES.txt`: complete assembled notices suitable for redistribution with the affected code.
- Individual license texts: source-preserving copies or clearly labeled declarations plus the linked full standardized terms.
- `license-provenance.json`: fetched upstream license URLs and Git blob SHAs, plus provenance for extracted notices.
- `pixi-bundle-source-map-verification.json`: exact official build blob identifiers and all 181 minified-map source paths.
- `source-comparison-notes.json`: top-level comparisons and known local modifications.
- `frozen-source-comparison.json`: exact current-file equality checks after byte-preserving materialization.

## Top-level identifications

| Vendored file | Identified source | License | Difference |
|---|---|---|---|
| js/lib/pixi.min.js | Pixi 4.4.3 official dist | MIT; bundled ISC, MIT, BSD-3-Clause, CC0 | Exact byte match |
| js/lib/howler.js | Howler 2.0.0 official dist | MIT | One comment typo corrected |
| js/lib/tweenjs-0.6.2.min.js | TweenJS 0.6.2 | MIT | Exact byte match |
| js/lib/q.js | Q 1.5.1 | MIT AND Apache-2.0 | Two marked stack-probe statements commented out |
| js/lib/minpubsub.src.js | MinPubSub 0.0.2 | MIT | Exact byte match |
| js/lib/pegasus.js | Pegasus 0.3.4-era commit 46374014c2db41ea54190ef542d19558a31cb1c1 | MIT | Marked JSON parse block disabled; sets null; upstream final newline omitted |
| css/balloon.css | Balloon.css 0.4.0 commit d7884de673f96612a670328bb9d8cc5970443e08 | MIT | Four styling edit groups |

Q's `LICENSE` fetched at v1.5.0 and v1.5.1 has the same blob SHA `9ce1ea591fca2060658d95475291967610763b2b` and byte-identical text. The saved q-license.txt is therefore also the exact v1.5.1 license. Q's header additionally identifies Tyler Close's MIT portions and Google/Mark Miller's Apache-2.0 portions. Both notices and the complete Apache-2.0 license are included. The v1.5.1 tree has no separate NOTICE file.

Howler includes its spatial-audio portion in the same dist file and under the same release MIT grant. TweenJS's original 2011–2015 banner must remain even though the release LICENSE.txt uses a 2014 copyright line; both are preserved by retaining source plus the supplied license.

## Exact Pixi build and source-map checks

Official repository moved from `pixijs/pixi.js` to `pixijs/pixijs`. All reads used the latter canonical repository and tag v4.4.3.

| Artifact | Git blob SHA |
|---|---|
| dist/pixi.min.js | 38ea4f1b62fb50e46783972f6777faafe1422b94 |
| dist/pixi.js | 20971ce4a4cdd7bce258da959dd4a43a2a319620 |
| dist/pixi.min.js.map | 321b55111be4ee48b65131603859f836783d234f |
| dist/pixi.js.map | 4d6109c35ea09a776ff1e4de3b8ac1aa452bd198 |

The vendored minified bytes exactly equal the official minified distribution, including its final newline; both have Git blob SHA 38ea4f1b62fb50e46783972f6777faafe1422b94. The readable banner says 2017-03-23 12:28:01 UTC; minified says 12:28:18 UTC. Both are the same official v4.4.3 distribution.

All 181 source paths represented by the minified map occur in the readable map, with byte-identical sourcesContent for every path. The readable map has 185 paths; the four omitted from the minified map are re-export-only `src/extract/index.js`, `src/interaction/index.js`, `src/loaders/index.js`, and `src/particles/index.js`. This is not a version mismatch.

The map identifies browser-pack, bit-twiddle, earcut, eventemitter3, ismobilejs, object-assign, pixi-gl-core, path-browserify, process, punycode, querystring-es3, url, resource-loader, mini-signals, and parse-uri. The surrounding build also contains a UMD wrapper, Babel helper snippets and the BSD FXAA shader.

Source matches include earcut 2.1.1, eventemitter3 2.0.2, isMobile 0.4.1, object-assign 4.1.1, all 17 pixi-gl-core 1.1.0 files, path-browserify 0.0.0, process 0.11.9, punycode 1.4.1, all three querystring-es3 0.2.1 snapshot files, url.js 0.11.0, mini-signals 1.1.1 and parse-uri 1.0.0. “Source match” means the upstream file is byte-identical to map sourcesContent; it does not establish that no other release shares those bytes.

Resource-loader is identified as 2.0.7 from its generated files, the 2.0.7 STATUS_IE_BUG_EMPTY/status-type change, the dependency range, and release/build chronology. Its uncompiled tag sources were inspected, but an exact generated lib-vs-tag comparison cannot be made because that tag does not commit its lib directory. The exact generated bytes remain documented in the official Pixi map.

## License details beyond the Pixi banner

- Earcut's grant is ISC, not MIT.
- isMobile 0.4.1 explicitly uses CC0. Its header and complete CC0 legal code are included.
- The FXAA shader contains Armin Ronacher's 2011 BSD-3-Clause notice in its embedded shader string. The full notice is reproduced separately for binary/documentation distribution obligations.
- Browser shims carry Joyent and other Node contributors' MIT terms. querystring-es3 additionally has Irakli Gozalishvili's 2012 MIT notice; both are included.
- parse-uri's README credits Steven Levithan's parseUri 1.2.2. The original copyright/declaration and full linked MIT terms are included in addition to Kiko Beats's MIT file.
- bit-twiddle carries Mikola Lysenko's MIT license. Its source credits Sean Eron Anderson's public-domain Bit Twiddling Hacks snippets; that provenance is recorded separately without relabeling the JavaScript port.
- resource-loader's reduced async helpers conservatively retain Caolan McMahon's MIT notices from 1.x and contemporary 2.x. Babel 6 helper and UMD/browser-pack MIT notices are likewise included. These do not claim that the full development toolchain ships in the game.

## Specific qualification: pixi-gl-core

The v1.1.0 tag has no standalone LICENSE file or separate copyright statement. It does have an explicit package.json `"license": "MIT"` declaration, and README expressly says the content is released under the linked MIT License. All 17 embedded gl-core files exactly match that tag.

`pixigl-MIT-declaration-and-terms.txt` preserves that declaration, identifies the upstream author metadata, and reproduces the complete linked MIT permission/disclaimer text. It does not invent a year or a copyright line. This is permission evidence from the upstream project, rather than an inference from Pixi's top-level banner. If a downstream review policy requires a literal upstream LICENSE file, flag this evidence format for that review; do not claim such a file exists.

## Remaining uncertainty and integration actions

No unknown/incompatible license was identified among the requested files or the source-map-enumerated runtime packages. Exact installed versions of bit-twiddle, browser-pack, UMD, and the Babel/async helper origins cannot all be uniquely reconstructed from the build because the package ranges have no lockfile. Their code/declaration provenance and full relevant permissive terms are supplied; these version uncertainties should remain visible in any SBOM.

For integration:

1. Ship THIRD-PARTY-NOTICES.txt with the game assets, retain original source banners/notices, and make the notices accessible from the host's credits/licenses UI or documentation.
2. Label the original game separately from its third-party libraries. MIT/Apache-2.0/ISC/BSD/CC0 grants remain attached to their respective components.
3. Preserve the existing marked Q modifications; if further files are changed, add prominent change notices where Apache-2.0 or host GPL obligations apply.
4. For GPLv3 combined-source distribution, include or otherwise properly provide corresponding readable source and necessary build material. The official same-version Pixi readable file and both maps are identified above; they were read as audit evidence but were not added to runtime source by this task. A minified bundle alone should not be presented as the entire source offering.
5. No library replacement or version upgrade is required by the licensing evidence found here. Execution safety, CSP behavior (including gl-core's dynamic uniform-accessor functions), asset routing, and browser tests remain separate implementation checks.

Apache explicitly documents GPLv3 compatibility at https://www.apache.org/licenses/GPL-compatibility . Compatibility does not remove the need to keep Apache's license and attribution/modification notices. The Apache-2.0 grant text is sourced from the Apache Software Foundation; the standard MIT terms are verified at https://opensource.org/license/mit .

