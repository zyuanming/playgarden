# Independent Same Game verification

Run from the repository root (Python standard library, no npm dependencies):

```sh
python3 -m unittest discover -s scripts/samegame-independent -p 'test_*.py'
python3 scripts/samegame-independent/verify.py --repo . --expect-count 100 --node-cap 50000 --timeout-seconds 120 --output /tmp/samegame-independent-report.json
```

The verifier reads the JSON campaign and extracts only literal JSON arrays from
`samegameLevels.ts`. It never imports or invokes the JavaScript generator, rule
engine, hint search, or normalization code. Its variable-height columns contain
bottom-up integer tuples, whereas its equivalence key uses column heights and
sorted per-color occupancy bitsets. Only color renaming and reversal of occupied
columns are quotiented; falling direction is not changed.

Every legal edge is enumerated, including descendants of singleton-color losing
positions. Win/loss is then assigned bottom-up by remaining tile count. The
verifier checks all opening branches, legal all-clear certificates, deterministic
certificate move selection, every trace field, every published metric, chapter
thresholds and aggregates, stable IDs, initial full-board validity, runtime data
parity, and campaign-wide duplicate freedom. Gravity contacts retain original
component identities, and column contacts retain original column coordinates.

Both a per-level node budget and an overall wall-clock deadline are enforced.
Exhaustion is `FAIL`, emits `budgetExhausted: true`, and exits with status 1; it is
never treated as a losing position. A successful JSON report includes actual
counts, elapsed time, and per-chapter evidence.

Self-tests include a separate, slow fixed-size row-major oracle over all 729
three-color 2×3 full boards and their reachable positions. They compare groups,
transitions, and win/loss classification, and check transition/reflection
commutation. Concrete 3×3 counterexamples prove that vertical reflection and
90-degree rotation can change solvability. Mutations target every metric and
trace field, opening outcomes, certificates, runtime parity, duplicate boards,
chapter indexing, invalid data types, and budget exhaustion.

This verifies the computational evidence and source-level game contract. It does
not certify human difficulty, originality of the historical Same Game rules,
mobile latency, rendered layout, browser behavior, or accessibility compliance.
Those require the separate runtime, DOM, browser, and playability reviews.
