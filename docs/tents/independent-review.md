# Independent review: Tents 200-level campaign

## Result

**Passed independent mathematical correctness, content-preservation, symmetry-diversity, and rule-progression review.** All 200 puzzles have exactly one tent placement. All certificates agree with an independently derived solution, and all 200 have distinct public-clue and tent-layout structures under rotations and reflections. Original levels 1–12 remain exactly equal to the frozen `d52e1ef7` baseline fixture, including titles and save indices.

Review code does not import the runtime solver or authoring generator. The runtime enumerates row masks; the independent oracle assigns adjacent tent coordinates to trees, deduplicates alternative matchings by tent placement, and exhausts that search. A second subset-DP algorithm checks the required tree/tent bijection. This preserves the rule that a tent may be adjacent to more than one tree. Such extra adjacency occurs in **156 of 200** puzzles.

## Progression evidence

All **2,862** recorded deductions pass independently reconstructed local-premise checks. All **3,896** changed cells also pass a separate exhaustive test showing that their opposite value is impossible given the preceding state. No answer certificate or uniqueness assumption is used to justify a local rule.

| Appended chapter | Levels | Proven rule boundary | Trace steps, min / median / max | Median parallel rounds with full rules |
| --- | --- | --- | --- | --- |
| 行列与树影 | 13–40, 28 puzzles | All solve with basic counts, tent spacing, and tree singles | 5 / 8 / 10 | 2 |
| 间距与排除 | 41–90, 50 puzzles | Basic rules stall on all 50; line-pattern consensus solves all 50 | 9 / 12.5 / 17 | 5 |
| 树旁的空间 | 91–140, 50 puzzles | Even line-pattern rules stall on all 50; tree-space deductions solve all 50 | 12 / 17 / 22 | 7 |
| 森林综合挑战 | 141–200, 60 puzzles | Weaker rules stall on all 60; mixed pattern/space deductions solve all 60 | 18 / 20 / 24 | 8 |

The weaker-rule closures are independently computed in parallel until no rule can add a fact. They do not replay or inherit the author's priority order. Thus the skill transitions are stronger evidence than merely counting how often a generator chose a rule.

The final chapter has 60 seven-by-seven boards, 8–11 tents per board, at most two zero lines, and at least two line-pattern deductions per recorded solve. Its median initially viable candidate count is 23, compared with 7 in the first appended chapter. Median largest tree-competition component size rises from 2 to 3, and the final chapter has a median of zero initial single-candidate trees per board.

## Diversity and bounded behavior

- Board-size distribution: 7 four-by-four, 33 five-by-five, 64 six-by-six, and 96 seven-by-seven boards.
- Tent counts span 3–11; both clue layouts and tent-only layouts are D4-distinct across the entire campaign.
- A stronger translation-normalized check removes both board size and position: all 188 additions remain distinct from each other and the legacy corpus. There are 199 normalized geometries across 200 levels; the sole repeated pair is original levels 1/2, preserved intentionally. The audit rejects every repeated geometry involving a new level.
- Independent exhaustive searches require 4–41 tree-assignment nodes per puzzle, comfortably inside the verifier's unchanged 200,000-node safety ceiling.
- Axis and two-count ablations complete without an inconclusive budget or timeout. Some puzzles remain uniquely determined after an entire clue axis is removed; the UI's redundant counts still provide useful learner cross-checks.
- The original 12 retain their existing mixed 4–7-size introduction. The appended chapters restart with small-board practice rather than silently reordering saved progress.

## Code review

The static-data wrapper uses a type-only back reference, so there is no runtime initialization cycle. The authoring search, full-game rules, and independent oracle agree on non-touching tents, row/column totals, and existence of a bijection; none incorrectly requires exactly one adjacent tree per tent. The generator's uniqueness test treats a budget exit as unproven. Tree-space deductions correctly exclude only cells outside the tree's remaining candidate domain.

The reviewed UI additions expose chapter objectives and 200-level numbering without remapping legacy indices. Completion is latched and terminal edits, hints, and undo are blocked; pause, reset, and level replacement remain state-scoped. Modified native Enter/Space are prevented on board controls. A Tents-only campaign-text style was added after review to keep objective text compact without changing Shikaku.

One mismatched test expectation for appended IDs was reported and corrected; generated IDs remain stable chapter-specific identifiers. This review's trace checks tie those identifiers and indices to the shipped data and verify provenance hashes.

### Node 24 JSON-module compatibility

The expansion wrapper explicitly imports its JSON data with `with { type: "json" }`. The independent inert-data adapter now requires this attribute and rejects missing, incorrect, or extra attributes, a different data path, and computed exports. Direct Node v24.19.0 loading of the actual updated TypeScript wrapper succeeds and returns all 188 appended levels. All corpus and deduction metrics remain unchanged after this import-only fix; Playwright discovery and browser results are verified separately in CI.

## Scope and limitations

This is evidence of staged logical practice and structural variety. It is not a human playtest, an empirical solve-time estimate, or a promise that every consecutive board is harder than its predecessor. The final two chapters share a rule family, with the final chapter providing longer and more mixed applications. Pixel/layout acceptance and browser event behavior are covered by the separate browser verification, not inferred from this mathematical review.

All 29 verifier/adversarial self-tests pass. See `independent-summary.json` for compact reproducible metrics and `scripts/tents-independent/README.md` for exact commands and test coverage. Raw per-level reports are generated into `/tmp` by the test command rather than committed as another copy of the campaign.
