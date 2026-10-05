# Independent Slant campaign verification

This directory contains a dependency-free Python verifier. It neither imports nor evaluates the game's code. Only the JSON data literal exported as `slantLevels` is parsed. The certificate JSON file is not opened until all puzzle searches have finished.

## Reproduce

```sh
python3 -m unittest discover -s scripts/slant-independent -p 'test_*.py'
python3 scripts/slant-independent/verify_corpus.py \
  --repo . \
  --out /tmp/slant-independent-report \
  --expect-count 300 \
  --timeout-seconds 60
```

The runner exits nonzero on any failed claim. It writes `report.json`, a solution-free `runtime-puzzles-only.json`, and an append-only `search-progress.jsonl`. The report includes input and verifier SHA-256 hashes, dimensions, chapter counts, all discovered solution witnesses, certificate checks, elapsed times, and search status.

## Rules checked

Every cell has exactly one diagonal. A numbered vertex has exactly its indicated number of incident diagonals. The graph of diagonal endpoints is a forest, so closed loops are disallowed. Multiple disconnected paths are permitted.

Input encoding: dimensions describe cells; clues have `(width + 1) * (height + 1)` row-major entries, with `-1` unclued and `0` an actual zero clue. Certificate `-1` is a NW–SE backslash and `+1` is a NE–SW slash.

## Why a uniqueness result is exhaustive

`solve` accepts only the immutable `Puzzle(rows, cols, clues)`, an enumeration limit, and a time limit. It has no certificate/solution argument.

Each undecided cell has two possible orientations. Exact-degree bounds remove an orientation only if it would force a clue too high or too low. Fixed diagonals are joined in a disjoint-set forest; an additional orientation joining vertices already connected is forbidden because it necessarily completes a cycle. All remaining branches are explored. At most two solution witnesses are required to establish multiplicity. Exactly one solution with an exhausted search establishes uniqueness; zero with exhausted search establishes unsatisfiability. Reaching a time limit is explicitly `timeout`, never a unique result.

The certificate verifier uses a separate undirected adjacency-list DFS for cycle detection and direct degree counts, rather than the solver's disjoint-set implementation. Each independently discovered witness is also checked by this validator.

## D4 equivalence

The verifier transforms vertex coordinates under four quarter-turns and an optional horizontal reflection. Odd quarter-turns exchange the height and width, including rectangular boards. Dimensions and every numbered or unnumbered vertex participate in the canonical key; supplied solutions do not. The eight transformed representations are minimized lexicographically. A second serialization, using the campaign's stated comma-separated `width x height` format, independently checks every declared normalized hash.

## Self-tests

Sixteen unittest methods cover:

- Every one-cell clue combination over `None, 0, 1, 2` (256 cases).
- 360 deterministic random 1×2, 2×2, 2×3, and 3×3 boards, comparing complete solution sets against a deliberately unpruned enumerator.
- Unique, multiple, unsatisfiable, impossible numeric clues, malformed types and shapes, explicit cyclic solutions, and incomplete boards.
- Timeout and one-witness cutoff never incorrectly reporting uniqueness.
- Rectangular D4 dimension changes, full eight-element orbit closure, independent matrix-rotation comparison, and solution-validity invariance under every transform.
- Strict non-executing TypeScript JSON extraction, raw-description run-length decoding, and certificate symbol encoding.

## Limits

This verifier establishes mathematical puzzle validity, uniqueness, certificate agreement, data counts, encoding consistency, and geometric non-duplication. It does not validate UI behavior, game completion logic, accessibility, mobile interactions, human difficulty ratings, tutorial quality, licensing/provenance, or generator reproducibility. Those require separate review. No dependencies, upstream C binaries, unknown executable code, or browser automation are used.
