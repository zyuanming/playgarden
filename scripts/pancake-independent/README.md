# Independent pancake-sorting verification

This Python-standard-library verifier was written independently of the JavaScript
generator and TypeScript game. It does not import or execute either implementation.
It reads JSON and static JSON literals in the production TypeScript data modules.

Run from the repository root:

```
python3 -m unittest discover -s scripts/pancake-independent -p 'test_*.py'
python3 scripts/pancake-independent/verify.py --repo . \
  --expect-count 120 --expect-chapter-counts 8,12,18,24,26,32 \
  --self-test --output /tmp/pancake-independent-report.json
```

The report contains:

- Complete, fresh reverse-BFS enumeration of all 46,230 permutations for sizes
  3 through 8, including the 40,320 eight-pancake arrangements.
- Checks of all 316,644 directed legal prefix-reversal edges, using a second
  index-based construction, exact factorial state/edge counts, involution,
  unique non-self successors, and descending shortest-path successors.
- Independent exact graph diameters 3, 4, 5, 7, 8, and 9.
- Every published distance-table character compared with the independent graph.
  Lexicographic permutation enumeration provides rank positions without using
  the production Lehmer-rank implementation.
- Corpus schema, chapter references/counts, globally unique level IDs and stacks,
  valid size permutations, exact minimum move counts, and replay of every move
  in every shortest solution. Equal-length alternate shortest paths are allowed.
- Independent optimal-opening, largest-first greedy move count, and breakpoint
  evidence checks. A breakpoint is an absolute adjacent difference other than
  one, including a final virtual plate of size `n+1`.
- Exact runtime/archive ordering and core-data equality. The runtime intentionally
  omits archival solution certificates and feature evidence.
- Optional self-test and mutation results plus SHA-256 hashes of audited data.

Negative tests deliberately corrupt IDs, stacks, schema, chapter references,
chapter counts, minimum distances, solution lengths and moves, feature evidence,
runtime metadata/order, and distance-table entries/shape. Numeric booleans,
floats, duplicate JSON keys, nonfinite JSON constants, and computed TypeScript
export expressions are rejected.

The test suite also independently enumerates every move word of length at most
four for the four-pancake graph, as a small second shortest-distance oracle.

This mathematical/data check is separate from source review and from browser QA.
It does not claim to verify visual rendering, touch devices, screen readers, or
browser interactions. Runtime state/history and completion behavior need their
own source/DOM/browser checks.

`source-review.json` records a separate human-readable source audit. The verifier
includes that review in the report, but marks it stale if any reviewed source
hash changes. A mathematical/data pass does not silently turn an open source
finding into a passed review.
