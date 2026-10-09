# 饼干陷阱 · Chomp Garden

Original code, eight original teaching layouts, text and SVG illustration. GPL-3.0-only. Chomp is a public mathematical ruleset; no third-party implementation, artwork or level collection was copied.

Players select an existing square and remove its entire upper-right rectangle. Taking the lower-left poisoned cookie immediately loses. The local computer uses exact memoized finite-state minimax on the actual remaining shape, with no random or deliberately weak reply. Only a real opponent loss awards completion. The eight finite boards change dimensions without rotated duplicates (2×2 through 4×5).

The player can inspect a bite preview and request an exact current-state hint. A hint explicitly distinguishes winning positions from lost positions. Undo rolls back both player and computer moves; restart creates a clean state; pause disables every board action; terminal victories are locked. Buttons support touch, Tab, Enter/Space and directional focus.

Targeted browser coverage: e2e/chomp-garden.spec.ts covers first/final actual wins against the local AI, poisoned loss, pause, whole-turn undo, restart, keyboard play, terminal lock, screenshots, runtime errors and viewport overflow. Contributor did not run suites; integration owner runs the single required targeted invocation.
