# Fixed upstream audit

Reviewed source: lengyanyu258/xiangqi.js at f9019ac2303d4b80ef0b82fd0515bfb55a80a62b, BSD-2-Clause, using the existing source-evidence capture. Upstream source SHA-256: f2de592d3a81cf79cd36f0d09e6efbb4bdb357082c2d421bf76d2d8eb7c619fe. The original upstream program was not executed.

## Confirmed defects or unsuitable defaults

1. `perft` moves before checking `king_attacked(turn)`, but `turn` has already changed. It tests the opponent rather than the moving side, suppressing checking moves and admitting self-checking moves. It also gives a nonstandard result for depth 0. Product uses the legal generator and depth-0 leaf count 1; independent perft confirms the fix.
2. Pseudo generation admits capture of the enemy king. A played king capture can then leave the missing king sentinel in later attack logic; ordinary rules should end in checkmate rather than remove it. Product excludes king capture at move construction. Golden probes and mutation tests cover this.
3. `moves({opponent:true,legal:false})` exits before restoring `turn`, so a query mutates the game. Product restoration passes 10,475 positions for both legal and pseudo opponent query paths.
4. FEN counters use `isNaN` plus `parseInt`, accepting fractions, exponent strings or `Infinity`; the board accepts zero run-length characters. Product requires canonical decimal integer strings in the safe range and digits 1–9 for empty runs; malformed-input probes pass.
5. Failed constructor load does not signal failure and can leave its empty initial array as a game. Product `coreFor` constructs a normal engine and explicitly checks `load`; it also rejects positions where the side that just moved is under attack. The wrapper tests cover both safeguards.
6. Upstream repetition scans whether *any* historic position ever occurred three times. That is not a standalone current-position repetition query after continuing a game. The product's own keys count only the current board-plus-side key and prohibit moves after a declared result.
7. Upstream draw/game-over includes `insufficient_material` and a simplified repetition rule. These are unsuitable as an implicit release contract. Product does not use them, instead exposes the stated casual rule ID, and adjudicates zero legal moves as a loss before drawing conditions.

## Residual APIs outside the product boundary

The upstream public surface still has unused loose APIs: `put` does not fully normalize/validate piece type or colour; `validate_fen` itself expects a string; verbose opponent moves derive piece casing from the restored current turn rather than the move's colour; the old PGN/sloppy parser and mutable edit/redo helpers have not been accepted as product features. The narrow TypeScript declaration hides many of these. Do not expose board editing, arbitrary raw constructor loading, PGN import or full upstream draw claims without separate review.

FEN structural validation establishes permitted square geometry and counts, not historical reachability. For example it does not prove that multiple uncrossed soldiers on a single file could arise from a real game. This is acceptable for the current fixed authored positions and replay-validated saves; it should be revisited before arbitrary end-user FEN editing/import.

Counters near JavaScript's maximum safe integer could overflow on subsequent fullmove increments. This is unreachable in any realistic game and in the shipped authored positions, but a future arbitrary FEN import should cap fullmove numbers to a sensible operational range or guard the increment.

## Boundary conclusion

No release-blocking ordinary move-generation or stated casual-adjudication defect was found in the tested core/wrapper. Passing perft alone is insufficient; the independent geometry fixtures, 9,245 source-square/blocker positions, deterministic games, state tests and 10 mutation witnesses are essential parts of this result. Browser presentation, AI quality/performance, worker races, campaign solution claims, legal attribution and build/release pipelines remain separate checks.
