# Independent Shikaku corpus verification

Original Python standard-library reviewer. It does not import or run the game's
solver, candidate generator, authoring generator, TypeScript, or dependencies.

Copy these five files together into `scripts/shikaku-independent/`:

- `verify.py`
- `audit_traces.py`
- `test_verifier.py`
- `legacy12.json`
- `README.md`

From the repository root:

```sh
python3 scripts/shikaku-independent/verify.py --repo . --require-200 --output independent-report.json
python3 scripts/shikaku-independent/audit_traces.py --repo . --require-200 --output trace-audit-report.json
python3 -m unittest discover -s scripts/shikaku-independent -p 'test_*.py' -v
```

`verify.py` also accepts a JSON corpus as its positional argument, `--require-count N`,
`--budget N` (1–200000), `--timeout SECONDS` (per board), and `--legacy PATH`.
The default legacy snapshot is alongside the script. Passing an empty `--legacy`
disables prefix comparison for other uses. TypeScript loading only parses the known
literal arrays and their final `...shikakuExpansion` data append; no code is executed.

## Correctness and diversity

The verifier checks clue indices/areas, all certificate rectangle coordinates,
exactly one matching-area clue per rectangle, no overlap, every cell covered,
and every clue used once. It enumerates every coordinate rectangle and assigns
one compatible rectangle per clue by a bounded search. It stops at a second
solution. `budget`, `timeout`, `invalid`, `no_solution`, and `multiple` fail.
Only an exhaustive one-solution result matching the certificate passes.

Canonicalization independently applies all eight square rotations/reflections.
It rejects both duplicate numbered-clue layouts and duplicate solution partitions
with clue positions ignored, including duplicates against the original twelve.
Legacy preservation is an exact parsed-object prefix comparison.

## Logical quality

The solution-blind propagation analysis runs these cumulative tiers to a fixed point:

1. Single remaining rectangle per clue; remove overlapping rectangles.
2. A cell is coverable by only one clue; retain that clue's rectangles covering it.
3. Cells contained in every remaining rectangle of a clue exclude rectangles of other clues.
4. Pairwise support: remove a rectangle with no nonoverlapping option for another clue.

No tier reads the solution, assumes uniqueness, or does trial-and-error search.
The first tier that solves is reported. Needing tier 3 means tiers 1–2 reached a
fixed point unresolved; it does not claim every imaginable human technique fails.

`audit_traces.py` separately checks each author-reported deduction against freshly
enumerated coordinate candidates, including reported removal counts and group
thresholds. It also checks the author report's public-clue SHA-256, trace indices,
and the independent grouping result: levels 41–90 need coverage; 91–200 need shared
cells relative to the preceding tier. It independently detects recursive
non-guillotine partitions, which is broader than the author's no-first-cut subset.

This review concerns data and mathematical playability. It does not replace runtime
transition replay, UI/browser accessibility checks, production build, or exact-commit CI.
