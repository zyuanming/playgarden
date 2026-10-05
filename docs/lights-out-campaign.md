# Lights Out: fixed 112-level campaign

Version 1, rebuilt 2026-10-05 from main `a34aa781`. This is a new reconstruction; the earlier unpushed 112-level pack was unavailable and is not claimed as recovered.

## What ships

112 actual boards in `src/games/lightsOutCampaign.ts`, not a metadata-only count increase. Every board has a fixed initial mask and an exact minimum-move solution certificate. Runtime never generates a random level, and an invalid index raises an explicit error rather than silently showing level 1. The registry derives its count from the pack. The catalog now has 79 games and 1,048 levels; the other 78 games remain at 12 each.

| Chapter | Levels | Board | Minimum-move range | Lesson |
| --- | --- | --- | --- | --- |
| 初识联动 | 1–14 | 3×3 | 1–3 | Corner, edge, center; a lit cell need not be the switch to press |
| 叠加与抵消 | 15–28 | 3×3 | 3–5 | Overlapping crosses and parity cancellation |
| 四阶边界 | 29–42 | 4×4 | 3–5 | Transfer the rule to a larger board |
| 逐行推演 | 43–56 | 4×4 | 5–7 | Choose a first row, chase remaining lights downward |
| 五阶起步 | 57–70 | 5×5 | 6–8 | Transfer row chasing to five rows |
| 连锁规划 | 71–84 | 5×5 | 8–10 | Plan through temporary increases in lit cells |
| 全局观察 | 85–98 | 5×5 | 10–12 | Order independence; each switch at most once |
| 静夜挑战 | 99–112 | 5×5 | 12–15 | Combine strategies; finish with the all-on board |

The first three boards are deliberately placed corner, edge, and center one-move lessons. Minimum move counts increase within each chapter, with a deliberate reset when board size grows. They are a measurable progression, not a claim to fully measure human difficulty. Any valid solution wins; optimality is optional.

## Reproducible curation, not random filler

`node scripts/build-lights-out-campaign.mjs` reproduces the complete pack in memory and compares it byte-for-byte to the checked-in file. `--write` explicitly replaces the fixed data after review. Node 24 suffices; no dependency or network access is used.

1. Exhaust every 3×3 and 4×4 initial board, retaining solvable nonempty cases.
2. For 5×5, exhaust all 32,768 press patterns on each choice of three rows (10 choices). Supplement with the intentionally dense finale family: all-on, then every one-switch and two-switch deviation. Three-row patterns alone cannot provide 14–15 move challenges.
3. Score candidates by the runtime exact GF(2) solver, and fill explicit per-chapter minimum-move quotas.
4. Globally remove equivalent boards under all eight rotations/reflections. Each selected board represents a different puzzle orbit.
5. Choose the candidate with the largest minimum Hamming distance to already selected board orbits. Break ties with alternating sparse/balanced/dense light-count targets, then numeric mask order. This is a layout diversity criterion, not a subjective difficulty score.
6. Freeze initial masks and one optimal certificate. Keep full model tests for the exact solver and immutable undo behavior.

Lights Out can have several correct solutions (including equally short ones). “Unique boards” means no duplicate puzzle up to square symmetry, not that a puzzle has only one solution.

## Verification boundary

- Independent oracle enumerates every possible first-row press pattern and forces all later rows by clearing the row above. It does not import the runtime solver or neighbor function. This enumerates all solutions and certifies their minimum weight.
- Tests check all 112 certificates, D4 uniqueness, chapter coverage and progression, exact runtime solver agreement, invalid indices, and current progress indices 99–111.
- Browser journeys solve all 112 boards with independent certificates, split into eight chapter-sized tests on desktop and mobile. They check rendered initial lights, completion, chapter boundaries and mobile overflow.
- A separate browser journey uses the current save shape, earns level 100 through real clicks, reloads into level 101, tests high-level pause/hint/undo/reset, then completes level 112 and returns to the lobby. No pre-launch legacy-save migration is added.
- CI performs the repository's existing typecheck, unit tests, build, and browser checks. Actual run results belong in the PR; this document describes the checks rather than claiming unrun checks passed.
