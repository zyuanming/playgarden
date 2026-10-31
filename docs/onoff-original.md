# ONOFF integration receipt

Fixed upstream source: cb1e2e4615af6195aeb0dade06c08738511dd3b6, https://github.com/starzonmyarmz/js13k-2018.

25 original levels, including the original random layouts in levels 12/14/17. Full source and license audit is in third_party/onoff/README.md. Runtime: all local classic-script bundle, SVG markup, system HUD text and synthesized audio. No remote assets or upstream build chain.

The isolated local branch includes the catalog/GameId/lazy component, scoped resume key, dev/build module generation, global license/source manifests, source archive, and deployment byte-identity workflow. The existing Final E2E selector automatically accepts e2e/onoff.spec.ts; no broader browser suite was added. The integration owner must reconcile the README/catalog count with any concurrent additions (this branch alone is 182 games / 3202 finite levels). No shared main edits or pushes were made.

Final E2E: e2e/onoff.spec.ts

Browser QA status: PREPARED, NOT RUN. Local Chromium was previously denied; it must not be retried. Use the normal authorized GitHub desktop/mobile targeted job. Review actual mobile screenshots before merge. Scope: earned level 1 crossing, level 2 layer drops, level 3 jump + midair switch, native death, a late spike layout, pause/resume, mute/gesture/audio disposal, pointer cancellation, restart, level switching, malformed/stale messages, exit/re-entry and startup failure/retry. No 25-level proof or whole-catalog sweep.

The iframe exposes __onoffSnapshot as read-only diagnostics; there is no successful-state setter or QA-only gameplay branch. Tests may read normal state to time inputs, but must not inject game objects, clocks, RNG, completion flags, or a winning coordinate.

## Local verification

The isolated registered-host typechecked production build and bounded source/runtime/archive checks passed on 2026-10-13. Build includes OnoffGame as a lazy chunk. Existing large-chunk Vite advisory remains unrelated. No unit tests, old-game solver sweeps, local browser retry or browser suite were invoked. Targeted E2E and mobile visual acceptance are still pending the integration owner's supported CI run.

Independent source review requested two scoped corrections: use the actual “返回游戏大厅” toolbar label in the exit journey, and include the real lazy host JS/CSS in deployment identity. The identity now binds the HTML-referenced application entry, its unique ONOFF dynamic import and stylesheet reference, and all local ONOFF resources. CI checks exact safe paths, byte lengths and SHA-256 from that same build. Local ignored identity files are diagnostics only, never evidence for a later release; CI must regenerate them from the deployed commit. Original source/license/CSS bytes remain unchanged, including four inherited whitespace warnings in the complete base-to-branch diff.
