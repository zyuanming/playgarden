# Independent Tents review

This standard-library Python audit is intentionally separate from the runtime and authoring algorithms. No module here imports, executes, or delegates correctness to `tentsLogic.ts` or `scripts/tents/generate.py`.

## Reproduce

From the repository root:

```sh
python3 -m unittest discover -s scripts/tents-independent -p 'test_*.py'
python3 scripts/tents-independent/verify.py --repo . --expect-count 200 --ablate --output /tmp/tents-independent-report.json
python3 scripts/tents-independent/audit_traces.py --repo . --output /tmp/tents-trace-audit.json
```

These are also included in `npm test`. The complete JSON reports contain per-level evidence. The tracked compact results and review are `docs/tents/independent-summary.json` and `docs/tents/independent-review.md`.

## Correctness boundary

- Decode the static original level array and its explicit JSON appendix as inert data. Require the Node-compatible `with { type: "json" }` attribute and reject unexpected paths, attributes, or expansion-wrapper behavior.
- Extract only board size, tree coordinates, and row/column totals before solving.
- Assign a legal adjacent tent to each tree. Enforce distinct tent cells, all eight non-touching neighbors, and both axes' totals. Deduplicate complete assignments by sorted tent placement. This differs from the runtime's row-mask enumeration.
- Exhaust the search before declaring one placement unique. The independent node ceiling remains 200,000. A node budget, timeout, or one-solution search limit cannot be called unique.
- Independently check the final bijection with subset-DP matching; extra tree adjacency remains legal.
- Only then compare the independently derived placement to the authoring certificate.
- Canonicalize public clues and independently derived tent layouts separately over eight square isometries. Compare the entire 200-level campaign, including the original 12.
- Also remove translation and board size after all eight tent-layout transformations. Any appended puzzle reusing this normalized geometry fails, even on a different-sized board. The unavoidable original-level 1/2 repetition is reported and exempted only because both are preserved legacy puzzles.
- Preserve the first twelve objects exactly. Their frozen fixture is additionally pinned by a canonical SHA-256 of the baseline content, so editing both fixture and level data does not silently change the regression contract.

## Educational evidence

`audit_traces.py` checks every authoring step against its specific stated local premise. It independently enumerates all local binary row/column patterns, validates tree-space exclusions, rejects invented/omitted pattern supports and fabricated reasons, and replays from public clues without reading an answer certificate. Every changed cell's opposite value is separately disproved by the exhaustive tree-assignment oracle.

A second procedure computes parallel fixed-point closures with three rule families, independent of the author's chosen step order:

1. Basic: line count, established-tent spacing, and single-candidate trees.
2. Patterns: basic rules plus consensus across every legal non-touching arrangement in one row or column.
3. Tree-space: pattern rules plus elimination of a cell that would block every possible tent for a tree.

This establishes actual stalls of weaker families, rather than inferring difficulty from the presence of a label in one chosen trace. It is a formal model of these rule families, not a measured human solve-time rating. Chapter 4 extends and mixes chapter 3's reasoning rather than claiming a new fourth rule family.

The optional `--ablate` analysis also removes whole clue axes and pairs of same-axis counts. Removing only one count would always be redundant because the opposite axis fixes the total; it would be misleading as a clue-quality measure.

## Adversarial tests

Coverage includes zero/one/two placements; two different tree matchings for the same placement; Hall matching traps where every tree and tent still has a neighbor; diagonal contact; all eight symmetries; same tent layout with different public clues; translated shapes across board sizes and the legacy-only exception; invalid inputs; certificate poisoning; incomplete searches; tiny-board cross-checks against direct tent-cell subset enumeration; exact legacy preservation; and fabricated or incomplete deduction traces.
