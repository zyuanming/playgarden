# Independent Magnets review

This directory was written separately from the game and campaign generator. The
oracle does not import their code. It has two independent verification routes:

- `oracle.py` evaluates literal per-cell rules and exhaustively enumerates small
  boards using only Python's standard library. `fixtures.py` supplies 114 puzzles
  and all 8,544 partial states to the JavaScript differential runner.
- Optional SciPy/HiGHS integer proof uses two binary indicators per cell. Pair
  equalities exchange signs, adjacency inequalities exclude equal poles, and
  finite line quotas are exact sums. After finding a solution, a Hamming-distance
  exclusion asks for any different cell assignment; infeasibility proves uniqueness.
  Returned integer assignments are independently checked against the literal rules.

## Routine gate: no additional dependencies

Run from the repository root after the normal npm dependencies are installed:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/magnets-independent -p 'test_*.py'
node scripts/magnets-independent/runtime.mjs
```

The optional MILP self-test is explicitly skipped unless `MAGNETS_MILP=1`. The
runtime runner needs Python's standard library and the already-installed
TypeScript package. It checks the stored proof's SHA256 identities against both
`src/games/magnetsLevels.ts` and `docs/magnets/campaign.json` before consuming it.
Campaign edits therefore require a new independent uniqueness proof. Runtime
code edits are tested differentially rather than frozen to an old hash.

The Node runner accepts `[repo] [proof-json] [output-json]`. Defaults are the
current repository, `docs/magnets/independent-campaign.json`, and
`/tmp/magnets-runtime-review.json`.

## Optional proof regeneration

SciPy is an explicit optional dependency; no CI or dependency installation is
performed by these scripts. With SciPy already available:

```sh
OPENBLAS_NUM_THREADS=1 MAGNETS_MILP=1 PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/magnets-independent -p 'test_*.py'
OPENBLAS_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1 python3 scripts/magnets-independent/verify.py --repo . --output docs/magnets/independent-campaign.json
```

The MILP self-test compares the complete solution sets of all 114 small fixtures
against exhaustive enumeration, including inconsistent clues. Campaign proof
checks all 36 puzzles, exact public/offline separation, D4 + global polarity
canonicalization, neutral/mixed-orientation variety, and vendored licence/file
SHA256 and Git-blob identities. This is bounded at 60 seconds per MILP solve and
fails on inconclusive statuses; it never treats a timeout as uniqueness.

Runtime checking covers full/partial completion and conflict sets; omitted,
zero, and finite quotas; paired ends; neutral versus unknown; diagonal versus
orthogonal contact; hints preserving current choices; exhausted search versus
budget exhaustion; invalid states/edits; terminal locks; and corrupt save data.
This directory does not claim DOM or screenshot verification.
