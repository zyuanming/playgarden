# Independent Ataxx rules and campaign review

## Verdict

PASS for rules, rule-core storage/replay, campaign solvability and alternatives, current-position lesson hints, adversarial lesson replies, and finite search caps. Static UI lifecycle review found no blocking issue. A controlled-Worker React DOM suite with 14 cases was authored but could not run locally: package directories are empty and no Vitest executable is present. This report does not claim browser, actual-device, React DOM, screenshot, build, or whole-repository CI validation; those are separate release gates.

The reviewer did not author the product engine, search implementation, campaign, or UI. Product files were read-only throughout this review. Verification code is in `scripts/ataxx-independent/`; reports are in this directory. Product file SHA256 identities are in `independent-reviewed-files.json`.

## Independent method

A new Python oracle uses contiguous 49-bit integer sets and coordinate-generated neighborhoods. It does not import, call, or copy the product solver. Smaller boards are embedded into the 7×7 oracle with external cells blocked. The source of rules is the retained MIT `kz04px/libataxx` snapshot at `4226c26dd11a1f74be708882ece6fd9dc96c767b`. All eight retained source/license Git blob identities were independently recomputed against the supplied pinned manifest; SHA256 values are recorded in `independent-source.json`. Upstream software was not installed, built, or executed.

Rules explicitly covered:

- Clone retains its origin; every friendly adjacent source alias is equivalent for the same clone destination.
- Chebyshev distance two jumps remove the origin and can cross any intermediate cells, including gaps and pieces.
- The destination must be empty and playable; all eight adjacent opponent pieces convert without chain propagation.
- Passing is allowed only when the current side has no placement and the game remains live.
- Elimination or mutual immobility uses actual piece counts, before the 100-ply no-clone draw rule.
- Clone alone resets the clock; jumps and passes increment it, including jumps that capture.
- Game-over states reject all moves, including passes. The deliberately unchecked `apply` is tested only with validated actions; public `play` enforces legality.

## Executed checks

1. Seven hand-specified oracle tests passed, including opening branching counts, source retention, crossing gaps/pieces, eight-neighbor conversion, forced pass, all terminal precedences, and clock behavior.
2. `runtime.mjs` replayed 1,340 deterministic independent positions across sizes 3–7 against actual TypeScript via Node 24 type stripping:
   - 49,652 complete legal successors
   - 23,746 clone source aliases
   - 16,080 illegal/malformed move checks
   - 366,680 attempted post-terminal moves
   - Input immutability, action replay, wrong IDs, malformed JSON/history, impossible moves, oversized saves, and invalid position shapes
3. `campaign.py` independently proved all 30 lessons with complete finite-horizon minimax. All 30 initial boards are distinct under D4 symmetry. Chapters each have six lessons. There are 12 move/capture lessons, six defensive hold lessons, and 12 forced-win lessons. Sixteen lessons have multiple correct canonical opening choices; every lesson has at least one incorrect legal choice.
4. Levels 19–24 require exactly two green turns. Levels 25–30 require exactly three; none can force a win within two. This is independently checked against all opposing replies, rather than by replaying one cooperative line.
5. `campaign-runtime.mjs` checked all 5,827 unique reachable in-horizon campaign states, including 1,298 green hint decisions, 498 optimal purple reply decisions, and 4,031 terminal lesson states. Actual solver values and chosen actions matched the independent oracle. All root alternative sets exactly matched the authored certificate sets; all authored proof lines replayed legally. There were 3,624 additional clone-alias checks.
6. Budget regression includes a frozen clock and deliberately hard inputs. NaN, Infinity, and oversized node budgets reach at most the fixed 40,000-lesson / 18,000-AI cap, plus one stop-sentinel visit. Exhausted lesson search returns `budget`, not `none`; AI returns a legal bounded fallback from the latest completed depth.

Detailed counts are in `independent-runtime.json`, `independent-campaign.json`, and `independent-campaign-runtime.json`.

## Finding fixed during review

Initial search functions trusted externally supplied node/time parameters. Nonfinite parameters could bypass a cap. The author added finite hard clamps. Independent regression now uses malformed and oversized parameters on positions that actually reach the hard node limits, with wall-clock time frozen so a separate timeout cannot mask a missing cap.

## Static UI lifecycle review

The component keeps action-only saves, reconstructs positions by legal replay, and synchronously updates a state ref before React renders, preventing repeated confirmation from applying a stale move twice. Worker results require both an active effect and exact current-position identity. Worker, timer, and watchdog cleanup occurs on position changes, pause, document hide, unmount, and keyed restart/mode/level changes. Undo truncates the last human move and subsequent computer reply. Successful lessons lock further actions and report completion once. Legal clone-source aliases remain selectable rather than being restricted to the solver's representative source.

The parent confirmed these two behaviors are intentional and acceptable:

- Pausing during a green hint consumes that request; resuming restarts an AI reply but does not automatically reissue the cancelled hint. The player can ask for a fresh hint.
- Free-match terminal positions allow undo; successful campaign lessons do not. Core moves remain terminal-locked.

The independent `tests/ataxxIndependent.test.tsx` suite covers queued and active AI pause/resume, visibility change, undo before and after replies, restart/mode switch and legal-save restore, StrictMode/unmount, repeated confirmation/replies, preview cancellation, worker error/watchdog/constructor fallbacks, illegal worker moves, read-only budget hints, cancelled-hint semantics, successful lesson locking, malformed saves, and denied storage. Its local run was attempted and blocked by the absent `node_modules/.bin/vitest`; CI must execute it before the DOM gate can pass.

No browser was opened by this reviewer, leaving browser ownership with the parent task. Actual focus, CSS layout, input events, worker lifecycle races, pause/undo/restart interruption, save-denial messaging, and mobile rendering still require that independent browser gate.

## Reproduction

Run from the repository root, without installing or executing upstream software:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/ataxx-independent -p 'test_*.py'
PYTHONDONTWRITEBYTECODE=1 python3 scripts/ataxx-independent/campaign.py
node --experimental-strip-types scripts/ataxx-independent/runtime.mjs
node --experimental-strip-types scripts/ataxx-independent/campaign-runtime.mjs
# Requires the repository development dependencies in CI:
npx vitest run tests/ataxxIndependent.test.tsx --maxWorkers=1
```

The Node runners invoke Python with bytecode writes disabled. No npm package is needed for the Python/Node oracle checks; the DOM suite requires the existing Vitest/React test dependencies.
