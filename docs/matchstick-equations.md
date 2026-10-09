# 火柴等式

Original GPL-3.0-only seven-segment implementation, ten authored finite puzzles and original SVG cover. No copied external source, level set or artwork.

Each move removes exactly one existing segment and places it in one empty segment slot; rotation of that match is allowed. Numbers use the conventional seven-segment 0–9 display. Operators have a horizontal and vertical slot and must finish as + or −. The equals sign is fixed. Two-digit results cannot begin with zero. Temporary non-digit patterns are allowed during a two-move exercise; only a legal, arithmetically true display within the move budget wins. Alternative answers are accepted.

Ten exercises introduce within-digit changes, cross-digit transfers, operator changes, two-digit results and two-step rearrangements. This rule is spatial conservation of match segments, distinct from selecting arithmetic expressions or carrying digits.

Touch/keyboard interface separates selecting a symbol from choosing one of its seven large segment buttons. Picking a match does not change state or consume a move; placing it completes an atomic transfer. Pause and victory freeze gameplay. Undo restores the entire prior display and move count; restart is clean. Current-state hints enumerate valid arithmetic endpoints and compute exact transfer distance within remaining budget, including incomplete live glyphs. They never silently reset to a stored solution.

Integration: `MatchstickEquations` default component; `matchstickEquationsLevels` export from `src/games/matchstickEquationsLogic.ts`; 10 levels. Targeted desktop/mobile browser journey is `e2e/matchstick-equations.spec.ts`. No unit tests or E2E invocation run by the author; integration owner runs the required one targeted invocation.
