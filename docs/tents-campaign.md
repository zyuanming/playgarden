# Forest Campsite: 200 original puzzles

This expansion preserves the original twelve Tents levels and appends 188 original puzzles. It changes no other game rules or puzzle banks. The catalog becomes **80 games / 1,724 levels**; Tents, Shikaku, Slant, and Lights Out contain 200, 200, 300, and 112 levels respectively. These are separate measures from the long-term number of distinct games.

## Content and learning sequence

| Levels | Chapter | Boards | Observable reasoning focus |
|---|---|---|---|
| 1–12 | Classic introduction | Original 4×4–7×7 | Preserved titles, clues, certificates, and indices |
| 13–40 | 行列与树影 | Four 4×4, twenty-four 5×5 | Zero/full lines, remaining counts, tree singletons, tent spacing |
| 41–90 | 间距与排除 | Six 5×5, forty-four 6×6 | Non-touching patterns within a row/column |
| 91–140 | 树旁的空间 | Seventeen 6×6, thirty-three 7×7 | A tent cannot block all possible positions beside a tree |
| 141–200 | 森林综合挑战 | Sixty 7×7 | Alternating line patterns and tree-space deductions |

The classic pack is retained rather than re-sorted into the new learning sequence. New chapters introduce stronger rule combinations and longer recorded deduction chains, not larger search-node counts. Within chapters, board size and weighted deduction length guide ordering. Neither ordering nor these measurements claim that every adjacent pair is strictly harder for every person.

Tents cannot touch, including diagonals. Every row and column has an exact tent target. Trees and tents must admit a one-to-one orthogonal pairing; extra adjacency is allowed. Matching edges need not be drawn, and multiple matchings for one tent layout are **one puzzle solution**, not ambiguity. Grass marks are optional notes.

## Authorship, deterministic generation, and rejection

- Original offline authoring code: `scripts/tents/generate.py`.
- Version: `tents-original-v1`; seed: `202610052238`.
- Static expansion: `src/games/tentsExpansionData.json`, with stable IDs and content version 1.
- Reproduction: `python3 scripts/tents/generate.py --check` verifies byte-identical generated data and report.
- Provenance and individual step traces: `docs/tents/authoring-report.json`.
- No downloaded puzzle bank, new runtime dependency, external artwork, network call, or runtime randomness.

The constructor samples non-touching tent layouts and places distinct neighboring trees. Candidates are rejected unless a public-clue deduction trace solves them and bounded complete search proves exactly one tent placement. Search stops at a second distinct placement and explicitly rejects budget exhaustion. It does not infer uniqueness from the supplied certificate.

The retained campaign is deduplicated against all twelve originals under all eight square symmetries, both by public tree/count clues and independently by tent-layout structure. Moving trees around the same rotated/reflected tent answer does not create another accepted puzzle. The new levels also reject translated patterns and padding the same tent pattern onto a larger board. Original levels 1 and 2 have one such translation-equivalent tent pattern; they are retained unchanged as the only explicit legacy exception, while their public puzzles and board-bounded D4 layouts remain distinct. A deterministic oversampled pool is spread across the qualifying range instead of retaining only the earliest random candidates.

## Logical traces and independent validation

The authoring trace reads public trees/counts and accumulated deductions, never the answer certificate. It uses:

1. Tent spacing: a known tent excludes its eight neighboring cells.
2. Line counts: a fulfilled row/column leaves grass, or all remaining possibilities must be tents.
3. Tree singleton: the only still-possible orthogonal neighbor must hold a tent.
4. Line patterns: enumerate placements in one line that meet its count, avoid fixed grass, include fixed tents, and do not touch; retain only cell values shared by all patterns.
5. Tree space: if a cell would conflict with every possible tent beside one tree, and is not itself one of that tree's options, it must be grass.

No guess, answer lookup, uniqueness assumption, or global search result is used to fill a logical trace. Each complete trace is independently replayed with its premises checked. A separate tree-to-tent assignment enumerator, rather than the production row-mask algorithm, proves unique **layouts** from public clues and validates the certificates afterward. See `scripts/tents-independent/` and the independent review for exact scope and measurements.

## Runtime, state, and controls

- Board size remains capped at 7×7; search retains its 50,000-node cap.
- Runtime solving, winning, conflicts, and hints do not read stored answers.
- A hint uses the actual current marks and requires complete enumeration before calling a value forced. Wrong positions offer a retraction with an honest repair explanation.
- Undo retains 300 mutations. Fixed trees, repeated same-value tools, pause, and terminal-round controls cannot mutate the board.
- Modified navigation/edit keys are ignored without triggering native Enter/Space button clicks.
- Titles and chapter learning notes accompany the dynamic `001 / 200` level badge. Existing shell selection, next-level navigation, completion, and current progress persistence remain in use.
- No historical save migration was added. The original twelve keep their exact indices and contents.

## Verification and publication scope

The focused campaign tests exercise all 200 levels via actual cell/button controls in both configured Chromium viewports. Five-level journeys let existing CI sharding distribute the work. Control tests cover wrong-step recovery, current-state hints, undo, restart, pause/resume, keyboard activation/modifiers, final-level exit, and current progress refresh. Screenshots preserve chapter first/middle/last states plus transient controls.

Local standard-library Python and native Node checks can run in the cloud workspace. This workspace has no project npm dependencies; no dependency installation or alternate browser route was used. Aggregate type checks, DOM tests, production builds, and real browser operation must be established by the unchanged CI release gates for the exact published commit. Independent screenshot review distinguishes CI control replay from live independent human-style solving. Desktop/mobile viewport emulation is not a claim of physical-device, Safari, or assistive-technology certification.

A pushed commit alone is not release completion: the exact remote commit, required CI, Pages deployment, and public-site commit stamp must agree before reporting it as delivered.
