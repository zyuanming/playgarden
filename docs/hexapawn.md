# 小兵冲线

Original GPL-3.0-only pawn-only engine, exact local AI, eight authored tactical positions, UI and programmatic SVG. No imported chess engine, third-party puzzle corpus, external chess artwork, or added dependencies. This implements common Hexapawn rules independently. Unlike Solo Chess, this has alternating adversarial sides, quiet forward moves, directional captures, promotion and no-move victory; captures are not required on every move.

## Rules and finite scope

Green (the user) moves toward the top, brown toward the bottom. A pawn may move one square forward into an empty square or capture an opposing pawn one square diagonally forward. There are no initial double steps, backward/sideways steps, straight captures, en passant, kings or check. Reaching the opposite edge wins immediately. A side with no legal moves on its turn loses; removing its last pawn is a special case. No draws are possible because forward distance strictly decreases.

Eight original finite tactics use 3×3 or 4×4 boards. 4×4 positions have at most four pawns; the final 3×3 position has five. Lessons cover first-move racing, immediate promotion-threat interception, blocked fronts versus diagonal captures, blockade victory, paired recapture support, holding a reserve defender, front-line priorities and a three-pawn exchange relay. These are labeled tactical lessons, not eight starting-position full chess games or randomized matches.

## AI and hints

Memoized exact minimax evaluates every legal continuation for these tiny positions. There is no heuristic or hidden weaker opponent. A winning side picks the shortest forced win; a losing side maximizes resistance. Exact ties use ascending source indices, captures left/right first then forward. Strictly decreasing total forward distance guarantees termination, and the authored small pawn counts bound the state space. AI and hints do not run a campaign/proof sweep; they evaluate the current position when requested by actual play.

A user move plus the automatic AI response is one synchronous atomic round, eliminating queued AI timers, pause races or unmount callbacks. The UI marks the last brown destination and describes the actual response. One undo restores the state before both moves. Losing positions remain undoable; winning positions are locked. A hint computes from the current board, names a forced-win first move only if one exists, and honestly reports forced loss otherwise. It does not replay an author solution or move pieces.

## Accessibility and checks

All squares are native buttons, at least 44 px, supporting Tab/Enter/Space and touch. Pawn direction is conveyed by arrows as well as color. Names announce coordinate, occupant and selected legal targets. Illegal destinations explain the rule without changing the board. Covered actions are blocked by engine legality and UI locks. Pause locks all squares; reset reconstructs the selected lesson. Terminal success calls onComplete once, with all moves locked and shell undo disabled.

Worker authored without running browser/E2E, unit suites or exhaustive proof sweeps. Parent must run a clean typechecked build and the final targeted `e2e/hexapawn.spec.ts`. The authored journey includes actual first/final wins against exact replies, an illegal diagonal-to-empty move, an actual AI win after a bad sixth-lesson move, undo from defeat, pause/reset/hints, desktop keyboard and mobile taps, first/final starting and win screenshots, overflow, 44 px cells, progress and win lock. The final scripted route relies on the documented stable capture-first tie order, not a test-only hook.
