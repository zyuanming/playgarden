# Grid Garden registration instructions

This package contains only files owned by the Grid Garden integration. Merge these paths into the application without replacing shared catalog, registry, shell, workflow or package files.

1. Add `grid-garden` once to `GAME_IDS` in `src/lib/catalog.ts`. Do not alter existing game IDs or counts. Add the entry from `docs/grid-garden-catalog-entry.json` to `src/lib/registry.ts`, converting its `component` value to `lazy(() => import("../games/GridGarden"))` in the same form as neighboring games. This is one distinct game with 28 authored lessons; the ending is not a level.
2. Append `docs/grid-garden-runtime-source-addendum.json` to `vendoredComponents` in `docs/runtime-source-manifest.json` and append `docs/grid-garden-notice-addendum.md` to `THIRD_PARTY_NOTICES.md`. Run the existing `node scripts/sync-license-notices.mjs` once with the installed locked dependencies to regenerate the shared public notice.
3. Add `python3 scripts/grid-garden/verify-sources.py &&` to the existing build verification chain. No new npm dependencies or upstream build commands are needed.
4. After an authorized edit to these game files, run `python3 scripts/grid-garden/adapt.py` if the static patch changed, then `python3 scripts/grid-garden/package-source.py`. The distribution manifest and source ZIP must be regenerated before `verify-sources.py`.
5. Run the ordinary project typechecked build, then the single targeted invocation `npm run test:e2e -- e2e/grid-garden.spec.ts`. The existing runner supplies desktop and mobile projects. Review the actual mobile screenshots before merge. Use the exact PR marker `Final E2E: e2e/grid-garden.spec.ts` for this game; do not run the full browser suite or add unit-test sweeps.

The journey uses visible host/editor controls for all 28 original lessons. It covers failed input, equivalent layouts, touch help, draft reentry, reset, real next-transition pause/resume, final-only denial, full-course ending, 320 px layouts and exit with pending work. Solutions are static authored-target transcriptions, including the original lesson-26 effective class override; it does not inject runtime game state.

Counts, metadata and source identity are declared in `docs/grid-garden-level-inventory.json`, `docs/grid-garden-source-map.json` and `vendor/grid-garden-original/source-manifest.json`. The game differs mechanically from Flexbox Froggy and CSS Diner: it teaches two-dimensional grid lines, row/column spans, areas, ordering and fixed/fractional tracks through actual CSS Grid layout.
