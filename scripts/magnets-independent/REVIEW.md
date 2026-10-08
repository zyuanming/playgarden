# Independent Magnets rules and campaign review

Verdict: PASS for the reviewed campaign, rules, solver behavior, data separation,
and source adaptation. No blocking functional defect found. This review was
performed by a non-author; no game implementation or author generator was changed.

## Independent campaign proof

All 36 actual public puzzles have exactly one solution. An independently written
binary-per-cell integer model solved each puzzle, then excluded that assignment
with a Hamming-distance constraint. Every second solve proved infeasible; every
first solution passed the independent literal rule evaluator and matched the
original offline certificate. Neither generator nor runtime solver is imported
by this proof. The MILP oracle was itself cross-checked against complete brute
force solution sets on 114 small fixtures.

- 36 distinct puzzle orbits under D4 and global pole inversion.
- 36 distinct solved-tiling orbits under the same transformations.
- 32 distinct tiling orbits; repeated tilings have different solutions/clues.
- Nine levels each at 4×4, 4×6, 6×6, and 6×8; four chapters.
- Every board has at least two horizontal and two vertical dominoes; every
  answer uses neutral and both polarity states.
- 2–11 neutral dominoes, 6–17 finite clues; 14 levels have exact-zero clues.
- Public levels are the exact certificate-free projection of the author JSON.
  Runtime imports inspected: UI → public levels/rule engine, no offline answer
  import. The source-only answer separation is real; these offline repository
  certificates are intentionally reviewable.

This establishes puzzle and structural variety. Human difficulty calibration was
not measured; author search-node counts should not be described as human ratings.

## Runtime differential evidence

The system under test was transpiled with installed TypeScript. Expected outcomes
came from separate Python literal-grid evaluation and exhaustive enumeration.

- 114 independent tiny puzzles; 8,544 exhaustive partial-state inspections,
  including exact conflict sets, both quota signs and both axes.
- 8,544 hint-existence/preservation checks; 8,544 zero-budget checks.
- 558 correct campaign prefixes; 216 incompatible campaign single-choice probes.
- 88,497 paired-cell edits; 35,453 terminal or no-op guards.
- 1,044 invalid state/edit guards; 324 corrupt-save rejections.

Checks distinguish omitted quota −1 from exact zero, undecided from neutral,
diagonal contact from forbidden orthogonal equal poles, paired opposite ends,
terminal edit lock, unsatisfiable search from budget exhaustion, and compatible
hints from overwriting existing choices. All passed. A deliberately stale stored
proof was rejected before consuming answers. Standard-library-only self-tests
were additionally run with `python3 -S` and passed; the optional MILP case skips
unless explicitly enabled.

Latest differential duration: 13.547 seconds. The scripts and
commands are documented in `scripts/magnets-independent/README.md`. Stored proof:
`docs/magnets/independent-campaign.json`. Routine tests need only Python stdlib and
existing npm dependencies. SciPy is explicitly optional for proof regeneration;
there is no new install step or workflow dependency.

## Actual MIT adaptation and distinct mechanism

Read `vendor/sgtatham-magnets/magnets.c`, its unchanged licence, source metadata,
`magnetsLogic.ts`, the UI, campaign source, Binary Balance rules, and notices.
Vendored SHA256 and Git-blob hashes match `source.json`; the public licence is
byte-identical to the vendored licence, and third-party notice includes the MIT
copyright/permission terms.

The adaptation is substantive rule execution: upstream `OPPOSITE` (line 72)
becomes the same opposite-pole calculation; `count_rowcol`/`check_rowcol`
(lines 734/751) become separate sign counters and optional quota checks;
`check_completion` (line 763) becomes all-domino decisions plus row/column totals
and orthogonal equal-pole rejection. Whole-domino representation enforces paired
opposite terminals or paired neutral cells. The explicit −1 unknown state
replaces upstream EMPTY plus GS_SET distinction. Partial impossibility bounds,
bounded interactive search, campaign, persistence, and interface are original
additions rather than a claim of porting the entire upstream solver.

This is mechanically distinct from Binary Balance: three choices per domino,
neutral pairs, individually specified or omitted sign quotas, and equal-pole
adjacency constraints. Binary Balance instead fills independent binary cells,
requires half of each sign, forbids triples, and forbids duplicate completed
rows/columns. No Binary Balance engine import was found in the Magnets UI/rules.

## Scope and identities

UI source was checked for sign-at-click behavior, opposite paired ends, pause and
terminal guards, hints requiring user confirmation, and separate unknown/neutral
explanations. This report makes no DOM screenshot, pixel, full-suite, CI, merge,
or deployment claim. Those are separate validation stages.

- `src/games/magnetsLogic.ts`: `4e3204758a78afbe419a2b35b1a780eb2f20ea91779cfd397a728f51aa47bd13`
- `src/games/magnetsLevels.ts`: `5c84dde2bc3a2c691537757ad330a4025aa67a1df58ab4372ecf2ac8719fa01b`
- `src/games/MagnetsGarden.tsx`: `9a4ef302899d5925acc5400c1bf9fcb639b61a1d8003c6f02cbaeeab746637bc`
- `docs/magnets/campaign.json`: `c1e7acd8f726a988cf52ab3805e15da58d94463436265e56650ee9a4ab5e880b`
- `docs/magnets/independent-campaign.json`: `0a3d808c63c8548afbd891ba4b1a104f73738ea689156aefc4ce6cc86f1cd8cd`
- `vendor/sgtatham-magnets/magnets.c`: `ab823aceb8e85de0a06f498b463ca843b7a41abd2d04e296ab0473a67b3e6e44`
- `vendor/sgtatham-magnets/LICENCE`: `42ad32e495b10a778fa7c935e07326b40ac8d11b400a0919a623bcf2e048e294`
