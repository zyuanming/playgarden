# CarryLetters and BinaryBalance

Original Playgarden implementations and problem sets, licensed GPL-3.0-only. No copied game source, famous alphametic, external asset, network call, package, or runtime level generation is used. Registry/catalog integration follows the shared module contract.

## Delivered modules

- `CarryLetters.tsx`, `carryLettersLogic.ts`, `carryLettersLevels.ts`, `carryLetters.css`
- `BinaryBalance.tsx`, `binaryBalanceLogic.ts`, `binaryBalanceLevels.ts`, `binaryBalance.css`
- `tests/carryBinaryLogic.test.ts`, `tests/carryBinaryGames.test.tsx`

Both default components accept the existing `GameProps` interface. Level indexes are zero-based. Suggested catalog names: **进位字母** and **双符平衡**. Each exports twelve levels from its own levels module.

## CarryLetters: 12 levels

Literal source problem: `{ addends: string[], result: string, givens: Record<string, number> }`.

Each letter is one digit, all different. A multi-digit number cannot start with zero. The full integer sum must equal the result. Two or three addends, at most five columns, at most seven letters; all twelve authored puzzles have at least two unknown letters and a unique completion. Progression covers aligned short addends, repeated letters, a new leading column, shared result letters, carry 2 with three addends, chained carries, interior zero, and five-column addition.

Certificate schema: `{ mapping: Record<string, number>, carries: number[] }`. `carries[0]` is the outgoing units-column carry, followed by tens, hundreds, etc. The highest included column has outgoing carry zero. Certificates are stored as literal verification fixtures, never derived at runtime. `publicCarry` copies only addends, result, and givens. Goal validation evaluates the public integer equation and digit rules; it never compares against the certificate. Tests also pass an object whose certificate getter throws.

The production solver is a column-wise constraint solver. Every partial node yields; a UI chunk is 1,024 generator steps, with a timer yield between chunks. The global cap is 800,000 partial nodes. Search records counts, the first completion, and per-letter candidate sets, not an unbounded list of solutions. A capped search returns `complete: false`; neither contradiction nor a forced digit can be asserted from that result. Cancellation invalidates pending work on edit, undo, pause, reset, level change, explicit cancellation, and unmount. Hints use the actual player mapping and public problem, explain at most one forced letter or remaining choices, and never fill it automatically.

Independent oracle: test-only enumeration of digit permutations, leading-zero rejection, and whole-integer addition. It does not use column arithmetic or certificates to find solutions. Every authored equation's unique solution is compared with its separately stored certificate.

### Carry selectors

- `[data-carry-letters-game]`
- `[data-carry-letters-won="true"]`
- `select[data-carry-letter="A"]` (one per actual symbol; empty string clears)
- `[data-carry-column="0"]` (units column; next indexes move left)
- `[data-carry-letters-hint]` plus `data-hint-kind`
- `[data-carry-letters-cancel]`

Editable accessible names are `字母 A 的数字`. Given accessible names are `字母 C，已知数字`. The visible equation retains both the source letter and chosen digit, and each occupied place has a matching accessible label. Column records identify place, incoming carry, sum, result digit, and outgoing carry as text.

## BinaryBalance: 12 levels

Literal source problem: `{ size: number, givens: BinaryCell[] }`, row-major. `0 = empty`, `1 = A`, `2 = B`. Four 4×4 puzzles and eight 6×6 puzzles. Clue counts are `8, 6, 5, 5, 16, 14, 12, 11, 10, 9, 8, 8`, respectively. Each contains at least eight editable cells and has a unique completion.

All rows and columns must contain equal numbers of A/B, have no three identical consecutive symbols, and be pairwise distinct once complete. Fixed clues are literal and immutable. Progression covers counting, adjacent pairs, sandwich patterns, row/column propagation, larger grids, and comparing similar completed lines.

Certificate schema: `{ cells: BinaryCell[] }`, a complete row-major board. `publicBinary` copies only size and givens. Goal validation checks the actual board against all public rules and clues; it never reads certificate cells. Tests also use throwing certificate getters.

The production solver enumerates valid balanced row patterns, then performs a row-pattern CSP with vertical prefix pruning and final column-distinctness checks. There are six possible 4-cell row patterns and fourteen possible 6-cell row patterns. Each attempted row is one partial node; the cap is 200,000. UI search is chunked at 1,024 steps with cancellation and honest budget-unknown results, matching CarryLetters. Hints consider actual player entries, including incorrect choices, and never auto-fill.

Independent uniqueness verifier: test-only cell-by-cell backtracking, scanning full/partial rows and columns directly. It never calls the row-pattern solver. All twelve levels have exactly one completion, matching the independent certificate; the empty 4×4 board independently enumerates all 72 legal boards.

### Binary selectors and keyboard

- `[data-binary-balance-game]`
- `[data-binary-balance-won="true"]`
- `[data-binary-cell="0"]` (zero-based, row-major)
- Cell attributes `data-value="0|1|2"` and `data-given="true|false"`
- `[data-binary-input="1"]` fills A; `"2"` fills B; `"0"` clears
- `[data-binary-balance-hint]` plus `data-hint-kind`
- `[data-binary-balance-cancel]`

Click a cell, then use A/B/clear. Roving keyboard focus includes fixed clues so they can be inspected: arrows move, A/1 or B/2 writes, Delete/Backspace/0 clears. Letter keys are case-insensitive. Fixed clues have `aria-disabled`, descriptive labels and a visible dot. Board cells always show A/B text as well as different colors. Accessible cell names specify row, column, current letter or blank, fixed/editable state, and conflict when present. Selection and input do not remount the focused cell; hints do not steal focus. A visible narrow-screen scroll cue accompanies the board, and focus explicitly reveals clipped cells within the board viewport. The regression uses synthetic geometry and is not a substitute for browser layout QA.

## Lifecycle, verification, and integration limits

- Reset or level change remounts the isolated round; paused hint/undo tokens are consumed and do not replay on resume.
- Explicit cancellation returns focus to the previous field/cell only when the Cancel button itself held focus. Implicit cancellation never takes focus. Binary modifier shortcuts (Ctrl/Meta/Alt) remain untouched.
- Pause cancels active hint work and locks inputs. Completion is signalled once per round, including StrictMode. Completed inputs and undo remain locked until reset/new level.
- Immutable edit histories include clearing, preserve literal clues, and allow undo before completion. No automatic solution action exists.
- CSS declares at least 44×44 px interactive targets, explicit disabled/select colors with full opacity, visible focus outlines, and text alongside color.
- **Focused verification passed: 59 tests in 2 files**, including all 24 rendered certificate journeys, both independent oracles, ambiguous/contradictory states, caps/cancellation, certificate non-access, immutable history, pause/reset/undo/end, and user-event keyboard focus continuity.
- Full isolated-checkout `tsc -b` passed after the final source changes. Required limits used: Vitest `--maxWorkers=1` with a 384 MB heap; tsc with a 512 MB heap, serially.
- The tests use **jsdom**, plus CSS contract checks. They do not establish real-browser layout, actual target geometry, native select rendering, touch behavior, or visual acceptance. Real desktop/mobile browser QA is still required after catalog integration.
- No registry, catalog, package, shared component, deployment, publication, or integration branch file was changed by this implementation task.
