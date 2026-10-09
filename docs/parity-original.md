# 步步同数 / Parity: complete original campaign

This is one game with 100 original levels, not two games or a generated sample.
The original ordinary levels 1–50 and black/white levels 51–100 appear in their
original order. Every original value, start coordinate, tile color and optional
solution record is retained. `vendor/parity-original/upstream/story.json` is
byte-identical to Abe Fehr's MIT source at commit
`730ecbd24d4cd821bd236f2a441f4e5e2b22654f`.

## Rules preserved

The 3×3 grid uses row-major indexing, `y * 3 + x`. The initial selected cell is
placed without incrementing it. The selection moves one orthogonal cell per
input, with no wrap, diagonal step, skip or stay-in-place increment. Only the
arrival cell changes: ordinary/white adds one, black subtracts one. Black and
white colors remain fixed. All nine values equal is the only winning condition.
Negative values are supported unchanged. Neither hints nor level selection award
completion.

`src/vendor/parityCore.ts` is a typed native port of upstream `Board.js`
`render`, directional movement, `select` and `isWin`. It has MIT attribution.
`src/games/parityLevels.ts` converts coordinates and supplies all-white colors
for the ordinary mode, matching upstream ordinary behavior. The original data
is extracted by `scripts/parity/extract-levels.py`; its output must compare equal
to the exact 100 original level records. It does not generate or solve levels.

## Complete campaign and presentation

The original 8 instruction/end records remain in the editable source. Chinese
instructions in the UI cover their gameplay content: equality goal, continuous
cursor, arrival increment, the transition to black and white, white +1, black
−1, and completion. The final Facebook promotion is removed. The last-board
message says the final board is complete; it does not claim the user solved
every earlier board when they chose it directly from the shell.

The existing Playgarden shell provides all 100 choices, completion marks,
next-level actions and earned completion persistence. This replaces the old
cookie/story overlay navigation. As with other Playgarden games, users may
practice any original level directly. There is no automatic next-level jump;
the completed board remains visible until the user continues.

The visual layout is new Playgarden work, with the original charcoal/teal
numeric-grid idea translated to responsive scoped CSS. All typography uses
system fonts. `public/parity-art.svg` is new editable vector artwork based on
the exact original level 51 numbers. No upstream binary artwork is deployed.

## Controls, lifecycle and save contract

- Click/tap a cell adjacent to the current selection; illegal cells only explain
  the rule and do not mutate state.
- Use on-screen direction buttons, or focus the board and press arrows / WASD.
  Direction-key repeats and modified keys do not execute moves.
- Swipe at least 24 pixels across the board to execute one dominant-axis step.
  A swipe moves the current selector, regardless of its physical start cell;
  its generated click is consumed. The threshold is an intentional input
  usability adaptation from upstream TouchSwipe's zero threshold.
- Pause blocks board, keyboard and direction inputs. Restart remounts with exact
  original data, even if browser storage removal is unavailable.
- Undo reverses exactly the last arrival value and selection, before completion.
  This is a Playgarden convenience absent from the original.
- Hints explain monotonic white/black bounds and a neighboring cell's arithmetic.
  If white maximum already exceeds black minimum, they explain why undo or
  restart is needed. Hints never move, solve, write progress or claim an optimal
  route.
- No global event listeners, animation loops, timers, network requests, external
  scripts, sound dependencies or service workers are added. Pointer state is
  local and discarded on pause, cancel or unmount.

Registry must set `resumeKey: "playgarden.parity.v1"`. Saves use
`playgarden.parity.v1.round.<zero-based-level>` with `{version:1,id,history}`.
Only legal witnessed arrival indices are saved. Restore replays from the exact
original start; it rejects malformed, oversized, nonadjacent or post-win
histories, and never trusts a saved board or win flag. The completion callback
runs only for a board reached through legal moves/replay and whose nine values
are equal; shell completion storage is its existing `playgarden.progress.v2`.
The save guard supports 20,000 moves; longer live games can still continue and
undo, but display that the current route cannot be saved. Storage failure is
nonfatal and visibly disclosed. There is no arbitrary gameplay move limit.

## Verification boundary

The artifact was typechecked in isolation against the existing GameProps,
Playwright helper and installed dependency versions. Static verification covers
first-party Git blobs, exact level extraction, license copies and absence of
remote runtime dependencies. A local production bundle checks compilation only.
It does not claim successful integrated build, browser gameplay or visuals.

`e2e/parity.spec.ts` contains one journey for both existing desktop and mobile
projects. It plays original levels 1, 50, 51 and 100 with real controls and checks
ordinary +1, black −1, white +1, illegal movement, boundary guards, pause,
hint non-mutation, reset, undo, reload, genuine wins, persistent earned progress,
clean exit/remount and mobile 320-pixel layout. Only those four bounded routes
were planned independently; no 100-level solver/proof sweep or unit suite ran.
No game state, score, progress, storage or saved wins are injected by the test.

Required integration-owner steps: merge the manifest-listed files; add the
catalog/registry item and level count; append the notice and runtime-source-map
addenda; regenerate public notices; run the ordinary build; run exactly the
targeted desktop/mobile E2E; inspect its actual screenshots; then follow the
existing CI/merge/deployment process. Browser, visual and production status are
pending. This package performs no remote or Library writes.
