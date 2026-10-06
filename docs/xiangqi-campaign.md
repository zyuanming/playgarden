# 中国象棋 · 河畔棋局

This is one game, not a collection of separately counted modes: a complete local two-player or offline beginner-computer match, plus 13 original one-move lessons in three chapters (6 / 3 / 4). Match mode, player colour, board orientation and board zoom do not add games or levels.

## Actual source reuse and license

The rule generator is an actual adaptation of `lengyanyu258/xiangqi.js` at `f9019ac2303d4b80ef0b82fd0515bfb55a80a62b`, licensed BSD-2-Clause. The complete original file and license are in `docs/upstream/xiangqi.js/`, with byte counts and SHA-256 in `sources.json`. The shipped copy is `src/vendor/xiangqi/xiangqiCore.js`, behind a narrow TypeScript declaration and application wrapper. `public/xiangqi-LICENSE.txt`, THIRD_PARTY_NOTICES and the game shell preserve both copyright holders, conditions and disclaimer. It is not relabeled as MIT. No upstream UI, media, fonts, trackers, accounts or online engines are used.

Reviewed changes: ES module export; strict integer and digit FEN validation; no capturing generals; restore turn after the opponent pseudo-move query; correct perft to use legal moves and make depth 0 equal one; expose a read-only attacked-side query. Upstream PGN/editor/redo APIs are not used by the application. The wrapper validates every starting position and every saved history; it does not rely on constructor load failure or upstream draw adjudication.

## Declared casual rules

Ordinary Xiangqi rules apply: 9 files by 10 ranks, red first, palace/river restrictions, blocked horse legs and elephant eyes, exactly one screen for cannon captures, no backwards soldiers, no exposed or facing generals, and a legal response to check. No legal move means a loss, whether checked (checkmate) or not (stalemate). Generals are never captured.

The same position **with the same side to move** appearing three times ends the match as a draw. Also, 120 consecutive non-capturing plies end it as a draw; captures reset the count, and a non-capturing soldier advance does not. No-legal-move losses take precedence over drawing thresholds. These are explicitly labeled casual agreements on the game screen, not complete WXF tournament long-check/long-chase responsibility arbitration. No extra insufficient-material shortcut is applied. See `docs/xiangqi/rule-sources.json` for official WXF movement and tournament-rule context; the rule ID is `xiangqi-casual-threefold-120-v1`.

## Lessons and proof

`docs/xiangqi/corpus.json` mirrors the typed runtime corpus. Lessons separately teach the rook, cannon, horse, elephant, adviser and crossed-river soldier; three check evasions; three checkmates; and one stalemate. Capture goals name the required piece type and target, check evasions accept all legal safe responses, and the endgame goals distinguish checkmate from stalemate. The runtime checks the actual board outcome rather than consulting its supplied answer list.

An independently written geometric Python oracle enumerates every legal candidate for every lesson. The full successor FENs and opponent replies are retained in the campaign certificates. All 168 candidates yield exactly 21 goal moves, matching the declared sets. The verifier also checks deliberate corruptions of targets, piece types, goal types and answer sets.

## State, input and lifecycle

- Pick a piece, preview a legal destination, then confirm. Keyboard users have a single roving board focus, arrows, Enter/Space selection, and Escape to cancel before a second Escape pauses. Canonical coordinates remain fixed under board rotation.
- Compact phone cells are not claimed to be 44px targets. An optional 440px scrollable board enlarges them, and the separate confirmation control is at least 44px. Tests check 320px, desktop and simulated touch layouts; this is not a physical-device or full accessibility certification.
- Versioned saves contain the exact initial position and complete committed move history, plus match settings. They are replayed, never trusted as serialized boards. Invalid, mismatched, illegal, post-terminal and oversized data are rejected. Storage refusal keeps play available with an honest warning.
- Two-player undo removes one ply. Computer undo returns to the previous human decision and keeps the computer's opening when the human chose black. Free matches never award teaching progress.
- The original beginner alpha-beta search uses legal moves from the reused rule core, iterative deepening, a bounded node/time budget and an actual module Worker. Pause, document hiding, undo, restart and unmount terminate the worker. Request IDs and complete history signatures additionally reject stale/duplicate messages. Every returned move is revalidated. Failure/timeout uses an explicitly labeled one-ply legal compatibility fallback; no strength or Elo is claimed.

## Verification scope

- Independently derived opening perft depth 0–3: 1 / 44 / 1,920 / 79,666, with every one of the 44 root divides compared. No inherited western-chess perft tests are treated as Xiangqi evidence.
- Independent oracle: 10,475 ordinary/synthetic positions, complete legal-move/check/mate/stalemate agreement, and 186,120 move/undo transitions against separately derived FENs. Synthetic local-blocker cases are geometric probes, not all claimed game-reachable positions. Ten rule-mutation faults are detected.
- Application wrapper tests separately cover legal initialization, third repetition, 120-ply boundary, capture reset, terminal precedence, undo/history and corrupt saves. Two independently authored React test sets cover lifecycle and teaching controls.
- The repository's existing complete unit/type/build pipeline and conservative browser selector are retained. The new browser tests use real pointer/touch/keyboard input, real Workers and original full-page screenshots, plus explicit mock-based stale-response stress tests. Pages tests verify actual production assets, license, artwork, MIME, same-origin requests, refresh/resume and the exact published commit marker.
- CI/public deployment and screenshot results belong to the corresponding workflow SHA; implementation alone is not a claim that those stages passed.
