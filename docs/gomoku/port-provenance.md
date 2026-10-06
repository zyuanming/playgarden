# Freestyle Gomoku TypeScript adaptation

## Upstream source and license

This is an actual source adaptation of [tombelieber/gomoku](https://github.com/tombelieber/gomoku), pinned to commit [`0d8f81e687a04c729b1dfe5b0ce028295528cc17`](https://github.com/tombelieber/gomoku/tree/0d8f81e687a04c729b1dfe5b0ce028295528cc17), rather than an independent engine merely mentioning that project.

The supplied `board.rs`, `ai.rs`, and `eval.rs` source content was read statically before translation. No upstream Rust source, build script, binary, or WASM module was executed. The source copies in `vendor/open-gomoku/` are reference material only; the runtime uses the new TypeScript files.

Upstream license: MIT. Copyright (c) 2026 open-gomoku Contributors. The complete, unchanged upstream license is retained in `public/gomoku-LICENSE.txt` and `vendor/open-gomoku/LICENSE`. Carry the complete notice into the integrating application and retain attribution when redistributing the adapted files.

## Identifiable source mapping

| Upstream function | TypeScript adaptation | Preserved behavior and changes |
| --- | --- | --- |
| `board.rs`: `check_winner_at`, `count_line_through` | `gomokuLogic.ts`: `winningLinesAt` | Four axes, both-direction contiguous runs, five-or-more win. Extended the upstream four-step-per-side counting to the entire contiguous segment, and returns every winning axis for highlighting. |
| `board.rs`: `get_candidates` | `gomokuAi.ts`: `neighborCandidates` | Clipped square neighborhoods around stones, de-duplicated empty points, center on a genuinely empty board. Corrected the upstream fallback so a full board yields no candidate. |
| `ai.rs`: `quick_score`, `count_consecutive` | `gomokuAi.ts`: `quickScore`; `gomokuLogic.ts`: `countConsecutive` | Preserved four-axis offense/defense scores (10,000/1,000/100/10 and 9,000/900/80/5), contiguous counting, and center tiebreak. Added deterministic index ties and a zero-direction guard. |
| `eval.rs`: `pattern_score`, `count_line`, `evaluate` | `gomokuLogic.ts`: `patternScore`, `evaluate` | Preserved maximal-run de-duplication, open-end counting, pattern weights (1,000,000 / 50,000 / 5,000 / 500 / 200 / 50), own-minus-opponent scoring, and center bonus. |
| `ai.rs`: `best_move`, `minimax` | `gomokuAi.ts`: `chooseMove`, `minimax` | Preserved heuristic ordering and explicit maximizing/minimizing alpha-beta recursion. Reworked resource control, terminal scores, tactical safety, and root iteration handling as described below. |

## Independent additions and deliberate modifications

- Flat 225-cell TypeScript board with `0` empty, `1` black, and `2` white.
- Immutable public game state. Chronological move indices are the only authoritative history; turn, board, result, and winning segments are rebuilt from that history.
- Strict replay rejects non-integers, out-of-range points, duplicate/occupied points, sparse histories, and any move after a win or draw. `isValidPosition` compares every derived field with that replay and rejects stale or fabricated state.
- Black moves first. There are no forbidden moves, Renju restrictions, opening restrictions, or exact-five-only rule. Any contiguous five-or-more wins.
- Winner resolution happens before board-full draw resolution, including the 225th move.
- `playMove` returns the exact original object for illegal actions. `undoMoves` rebuilds a shortened history. Neither mutates its input.
- Whole-board `immediateWins` checks every empty point without writing to the supplied board.
- Every nonterminal search node, including leaves, scans all own immediate wins and all opposing immediate threats before heuristic candidate truncation. Own wins take priority; forced block candidates are never truncated. A quiet-move cap therefore cannot hide a one-move win or required block.
- Deterministic search replaces the upstream random score noise. Names are conservative practice settings: gentle (depth 1) and steady (iterative depths 1–3). These names are not Elo or professional-strength claims.
- Root iterations only replace the answer after all root candidates for that iteration complete. A partial deeper iteration is discarded.
- Search uses one private board copy. Every tentative placement is restored in `finally`, including budget aborts.
- Terminal wins use explicit mate scores. Tactical leaf checks recognize immediate wins and unavoidable two-point threats; this is a narrow tactical extension, not an unrestricted extra search depth.
- The default budgets are gentle: 1,000 visited nodes / 100 ms; steady: 12,000 nodes / 450 ms. Requested options are capped at 60,000 nodes and 2,000 ms. Invalid/nonfinite budget values yield zero search budget. Root validation and tactical prepasses are fixed-size work outside the node count.
- Time checks are cooperative between finite scans, not hard real-time deadlines. The UI should run this code in a terminable Worker, as planned by the integration. Zero/exhausted budgets and failed injected clocks retain a legal tactical/ordered fallback.
- No UI, persistence, Worker, network, publishing, or external side effects are included in this engine deliverable.

## API integration notes

`gomokuLogic.ts` exports the requested `SIZE`, `Stone`, `Cell`, `Position`, `emptyPosition`, `replayMoves`, `playMove`, `undoMoves`, `winningLinesAt`, `immediateWins`, `opponent`, `pointName`, and `evaluate` APIs. It also exports small runtime/search helpers (`isValidPosition`, `isBoard`, `AXES`, `inBounds`, `countConsecutive`).

`gomokuAi.ts` exports `Difficulty`, `chooseMove`, `SearchOptions`, and `MoveChoice`; `neighborCandidates` and `quickScore` are exposed for focused testing. `chooseMove` returns `{ move, nodes, depth, budgetHit }`. A terminal, full, or invalid state returns `move: null`. `depth` is the last completed root iteration; zero means a fallback, and one is also used for a directly proven immediate win. `nodes` excludes root preflight/tactical work. `pointName` uses A1 at top-left, H8 at center, and O15 at bottom-right; invalid indices return the empty string.

## Verification

The following checks were run against these TypeScript files using the integrating repository's already-installed, known dependencies:

- Strict TypeScript check of both engine modules and the focused test file.
- Vitest: 35 tests passed. Coverage includes all four axes and boundaries, complete overlines, four-axis crossing highlights, no coordinate wrap, actual full-board draws, 225th-move win-before-draw priority, invalid state/history, immutable play/replay/undo, candidate generation/evaluation, own win before defense, unique defense, legal fallback, deterministic node budgets, clock failure, full boards, and preserving the last completed search iteration.
- `review-verification.mjs`: 10,432 assertions passed across 30 deterministic randomized games and 3,133 positions, plus tactical/budget/immutability regressions. This is an additional invariant check, not an independent formal proof or a playing-strength measurement.
- `benchmark.mjs`: fourteen setting/position combinations, one warmup and five measured repetitions each, with legal-choice, mutation, and node-budget assertions. Results are saved to `benchmark-results.json`.

Reproduce from the repository root (Node 24):

```sh
npm run typecheck
npx vitest run tests/gomokuLogic.test.ts
node scripts/gomoku/review-verification.mjs
node scripts/gomoku/benchmark.mjs /tmp/gomoku-benchmark.json
node scripts/gomoku/verify-runtime.mjs
python3 -m unittest discover -s scripts/gomoku-independent -p 'test_*.py'
```

These scripts load only the reviewed TypeScript adaptation with Node 24's type stripping. Neither runs upstream Rust. Benchmark smoke results in this repository are saved as `docs/gomoku/engine-benchmark.json`; regenerating timings writes to the explicitly selected report path.

Local benchmark measurements are smoke/performance checks for this machine only; they are not browser/mobile latency guarantees. The integrated cancellable Worker and UI checks are documented in `docs/gomoku-campaign.md`.
