# Magnets campaign provenance and verification

The 36 PlayGarden Magnets puzzles are original, deterministically generated
content. No upstream puzzle strings, saved games, seed lists, or answer tables
were copied. The upstream game supplies the rules; this campaign has its own
authoring program, data, and offline solution certificates.

## Reproduce

```sh
python3 scripts/magnets/generate.py
python3 scripts/magnets/generate.py --check
```

Only Python's standard library is required. Seed `930202610` is fixed in the
generator. `--check` regenerates the whole campaign in memory, proves uniqueness
again, and compares both output files byte for byte without rewriting them.
Generation is bounded: no more than 2,000 candidates per level and 30,000 search
nodes per solver invocation. Exceeding the authoring cap fails loudly. A solver
budget exhaustion rejects a candidate; it is never considered proof of uniqueness.

## Campaign shape

| Chapter | Board | Levels | Visible clues | Author proof nodes |
|---|---|---:|---:|---:|
| 磁极初识 | 4 columns × 4 rows | 9 | 6–14 | 1–5 |
| 交错磁场 | 4 columns × 6 rows | 9 | 7–14 | 3–9 |
| 隐去线索 | 6 columns × 6 rows | 9 | 8–15 | 3–17 |
| 磁场大师 | 6 columns × 8 rows | 9 | 9–17 | 7–608 |

Every level uses both horizontal and vertical dominoes, with at least two of each.
Every answer uses neutral dominoes and both endpoint-polarity states. Larger
boards and increasingly omitted counts broaden the deduction space. Within a
chapter, puzzles are ordered by measured exhaustive-proof effort, then clue
count. These solver metrics are transparent engineering measurements, not a
claim of calibrated human difficulty; displayed clue counts need not decrease
monotonically. The first puzzle is completely resolved by constraint propagation.

## Authoring method

1. Start with a complete horizontal domino tiling, then make seeded random 2×2
   flips. Flips preserve coverage and adjacency while producing mixed tilings.
2. Pack a randomly ordered subset with locally compatible positive/negative
   magnet pairs. Other dominoes remain explicitly neutral.
3. Compute all row and column pole counts, then reject any board without exactly
   one answer.
4. Remove individual clues in a seeded order, retaining a removal only if a new
   exhaustive count still proves exactly one answer. Each level comes from a
   separately generated board, rather than a padded family of clue variants.
5. Canonicalize each problem under the eight rectangle rotations/reflections,
   including dimension-swapping rotations, and global positive/negative
   inversion. Canonicalization ignores domino array order and endpoint order.
   Reject an already-seen canonical tiling-and-clue problem.
6. Validate the certificate against the rules independently of the propagation
   engine and write the offline and public outputs.

The author solver assigns a three-valued domain to each domino. Orthogonal
adjacency enforces pairwise arc consistency. Each visible pole count constrains a
sum of per-domino zero/one contributions; exact minimum/maximum bounds remove
unsupported assignments. Exhaustive, deterministic smallest-domain branching
counts up to two answers. A certificate is accepted only if the search finishes
within its cap with exactly one answer, and that answer equals the constructed
state. This is separate from the interactive TypeScript assistance solver.

## Artifact contract

- `src/games/magnetsLevels.ts` exports `magnetsLevels: MagnetsLevel[]` with only
  IDs, titles, chapter indexes, dimensions, domino endpoints, and clues. It has no
  answers, generation metrics, or runtime dependency on the offline JSON.
- `docs/magnets/campaign.json` holds the seed, format version, author-solver
  description, and 36 public puzzle definitions with `solution` and `metrics`.
  It is an offline review artifact, not gameplay input.
- Cell indexes are row-major. Every domino is an orthogonally adjacent pair.
  States are `0` neutral, `1` first endpoint positive, and `2` first endpoint
  negative. An absent clue is `-1`; an exact zero remains `0`.
- A recorded `authorSolutionCount: 1` means completed exhaustive uniqueness
  proof. `canonicalSha256` hashes the canonical problem, not its answer.

In addition to the deterministic check, all nine 4×4 opening levels were checked
with a separate direct enumeration of all `3^8` states. Canonical signatures were
also checked for invariance under reflection, transpose, endpoint reordering,
and sign inversion. The campaign has 36 distinct canonical signatures.
