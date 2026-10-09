# 三子移阵

Original GPL-3.0-only rules engine, search implementation, eight tactical positions, UI, Chinese text and SVG cover. No external code, assets or level collection copied. Three Men's Morris is a traditional public ruleset.

Each side owns three pieces. Placement uses empty nodes; afterward movement follows a single adjacent segment of the visible 3×3 line graph, including center-to-corner diagonals. A real three-piece row, column or diagonal wins. The player controls green; a deterministic local opponent searches seven plies. Tactical exercises progress from remaining placements through immediate repositioning to multi-turn wins. This is a bounded computer, not an advertised perfect solver.

Position plus player-to-move repeated three times, 80 plies without a line, or no legal move produces a draw. Draws never award completion. Current-state hints use the same search and distinguish unconfirmed results. Undo restores the full previous human/computer round, reset restores the original exercise, pause disables input, and a victory cannot be undone or altered.

Browser spec e2e/three-morris.spec.ts: real first/final victories, local AI replies, touch and keyboard, whole-round undo, pause/reset, screenshots, browser errors and mobile overflow. Spec written; contributor did not run unit or browser suites.
