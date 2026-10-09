# 彩珠归管

Original implementation, level arrangements, interface and SVG cover, GPL-3.0-only. No third-party assets or source. Generic single-bead color sorting is distinct from the existing volume-measuring jugs puzzle.

Eight finite lessons introduce two-color buffering, three-color cycles, depth, paired caps, four-deep tubes and five-color interleaving. Arrays are bottom-to-top. A move takes exactly one top bead to an empty tube or a matching top with remaining capacity. Victory requires every occupied tube to be full and monochrome, not merely grouped partials.

The current-state hint search is bounded and symmetry-reduced, and honestly reports if no route is found in its budget. It never changes the board. Undo restores one physical move; restart recreates the opening. Pause and won states lock every board control. Native buttons support touch, Tab, Enter and Space, with shape and textual color equivalents.

Verification: targeted `e2e/color-tubes.spec.ts` is supplied for the integration owner, including independent visible-board solving of first/final lessons on configured desktop/mobile projects. No unit suites or E2E runs performed by this contributor.
