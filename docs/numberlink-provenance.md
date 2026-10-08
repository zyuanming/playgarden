# 彩线连园 / Numberlink Garden

Original Playgarden implementation, authored 2026-10-08. License: GPL-3.0-only.

## Scope and origin

This game implements general matching-pair orthogonal path-cover rules. Connect each coloured, symbol-labelled pair without sharing cells or crossing, then cover every non-hole cell. It is not an adaptation or port of an upstream software project. No third-party game source, official Flow branding, commercial level pack, font, audio or artwork is incorporated. No additional dependencies or network calls are required.

All 15 levels are individually authored route covers in `src/games/numberlinkLevels.ts`, progressing from 4×4 to 4×5, 5×5 and 6×5. Board shapes, internal endpoint placements, pair counts (2–5), bends and holes vary. Recolours, rotations and mirrored templates are not counted as separate levels. The stored example is one construction witness, not a claim of uniqueness or optimality.

`NumberlinkGarden.tsx`, `numberlinkLogic.ts`, `numberlinkStorage.ts`, `numberlinkGarden.css`, level data, the E2E scenario and `public/numberlink-art.svg` are original project-authored contributions under GPL-3.0-only. The illustration is hand-authored SVG geometry, including its endpoint symbols; no generated raster asset or external graphics are needed. Full GPL text is included in `public/numberlink-LICENSE.txt` (identical to the repository's LICENSE).

## Behaviour

- Click an endpoint, then adjacent cells; a drag gesture is never required.
- Distinct symbols and colours identify pairs. The selected line head is dashed. A pair list, connection count and coverage meter give text feedback.
- Clicking back along the selected path truncates its tail. Clearing only affects the selected path; undo replays the remaining legal action history.
- Completion checks the actual endpoints, orthogonal adjacency, non-overlap, hole avoidance and complete cell coverage. It never compares player paths to the authored example, so all rule-correct solutions are accepted.
- “Hint” opens a clearly labelled complete reference diagram. It explicitly does not solve the current partial state or claim a unique/shortest continuation. Reference routes also have readable row/column coordinates.
- Arrow keys move focus; Enter/Space clicks the focused cell. Pause locks play. Restart clears the current game. Current-browser saves contain versioned action history, not trusted board/win flags; invalid replays reset safely.
- History is capped at 4,096 actions, with an explicit user-visible undo/restart explanation at the limit. Storage failure is reported without blocking play.

## Delivery and verification status

The contributor did not execute tests, builds, old-game sweeps, dependency installation or browser sessions. `e2e/numberlink.spec.ts` is delivered unrun. The integration owner owns ordinary build/type/license checks and exactly one targeted E2E invocation for the finished game, using existing desktop/mobile projects. The authored scenario completes the first/middle/final layouts through actual controls and exercises overlap rejection, truncation, clear/undo, pause, reference hints, reload/reset and forged-save rejection. This document does not claim those journeys have passed.
