# 13-puzzle independent completeness audit

Status: PASS. No product files were modified.

- Exact corpus SHA-256: 74ca908e334f035d780446119f1b19374fbf184b16fbfde9194eb233ff392ff9
- 13 puzzles; chapter sizes 6 / 3 / 4.
- Exhaustively enumerated 168 legal first moves and 585 legal opponent reply edges.
- Complete objective-satisfying solution sets total 21 moves; all exactly match the declared solutions.
- Capture requires the specified moving piece type and target with an actual opposing victim.
- Evasion requires an initially checked mover and includes every legal safe reply.
- Mate requires the opponent in check with zero legal replies; stalemate requires zero legal replies without check.
- Runtime core/logic/practice/levels were compared against every independent transition, reply set, goal result and success/retry state.
- 10 campaign corruption mutations are all detected, including mate/stalemate confusion and a missing alternate check evasion.

## Complete solution sets

- rook-road: a0a6 (13 candidates examined)
- cannon-screen: b2b6 (19 candidates examined)
- horse-leg: c3e4 (4 candidates examined)
- elephant-eye: c0e2 (4 candidates examined)
- advisor-palace: d0e1 (3 candidates examined)
- pawn-river: c5d5 (7 candidates examined)
- evade-rook: d0e1, e0f0 (2 candidates examined)
- evade-cannon: c0e2, e0d0, e0f0 (3 candidates examined)
- evade-horse: c0c1, e0d0, e0e1, e0f0 (4 candidates examined)
- mate-rooks: d8d9, d8e8 (26 candidates examined)
- mate-cannon: a7e7 (34 candidates examined)
- mate-horse: h6f7, h6g8 (27 candidates examined)
- stalemate-net: d7d8 (22 candidates examined)

## Reuse in CI

Copy the contents of `ci-bundle/` into `scripts/xiangqi-independent/`; its README has the three commands. The portable bundle was smoke-tested from `/tmp`, independently of this directory and without modifying the product checkout. Oracle unit tests finish in roughly 8 seconds on this environment.

`campaign-certificates.json` records every first move, resulting FEN, exact opposing reply set, check flag and whether the objective is satisfied. `campaign-runtime-report.json` records the production bridge result. Certificates embed corpus and oracle hashes; the bridge refuses stale versions.
