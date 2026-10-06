# Function Factory and Compression Post

Two original GPL-3.0-only-licensed Playgarden modules, with 12 authored levels each. All messages, traces, lesson progression, rules, SVG geometry, CSS shapes and tests were created for this project. They use existing React dependencies and require no assets, installation, service, account or network request.

## Integration

- `FunctionFactory` is the default export of `src/games/FunctionFactory.tsx`; levels: `functionFactoryLevels` from `functionFactoryLevels.ts`.
- `CompressionPost` is the default export of `src/games/CompressionPost.tsx`; levels: `compressionPostLevels` from `compressionPostLevels.ts`.
- Both accept the existing `GameProps`: zero-based `level`, `paused`, `resetToken`, `hintToken`, `undoToken`, `onComplete`, `onStatus`.
- A changed level or reset token creates a fresh session. Before completion, undo restores actual prior state, including recovery from over-budget packet plans. Completion is emitted once per session; completed rounds remain immutable until reset or level change, matching the shared shell’s latched success state. Pause and completion consume incoming hint/undo tokens without replaying them later.
- Catalog, shell, shared styles and dependencies are deliberately unchanged by these modules.

## Function Factory: reusable definitions, not a destination maze

The player defines one or two short functions from `F` (draw a unit stroke), `L` (turn left) and `R` (turn right). The main program contains only named calls. Functions cannot call functions, so there is no recursion or hidden loop execution.

Each function has a fixed two-to-four-command budget. Main has two-to-six fixed call slots; authored levels use three-to-six calls. Every enabled function must be called at least twice. When both are enabled, their definitions must be different. This makes the central task reusable abstraction and composition. The player does not steer a robot toward an endpoint, copy a single flat route, or set a repetition count.

Public goals are independently authored absolute directed stroke strings plus final heading, starting at `(0,0)` facing east. Retraced segments remain in the ordered trace. An alternative program is accepted whenever its real execution produces the same ordered strokes and final heading and satisfies the reuse constraints. The endpoint alone is insufficient. Function-name swaps and equivalent turns may be valid.

The goal verifier independently streams commands against the public stroke specification instead of trusting the preview interpreter. The target graphic is generated from public directions, never from the certificate. Every stroke has an always-present numbered text equivalent with distance and direction. Start position, start heading and required final heading are explicitly stated. The run preview has the same complete text equivalent.

### Progression

1. Reuse a right-turn corner.
2. Reuse a left-turn corner and close a shape.
3. Increase definition length to control edge length.
4. Compose a motif that restores its entry heading.
5. Introduce two different reused functions and call ordering.
6. Mix unequal definition lengths.
7. Reason about a function beginning with a turn.
8. Insert short calls between long calls.
9. Group two motifs and retain ordered retracing.
10. Encode a half-turn and repeated reverse strokes.
11. Arrange six calls with unequal definitions.
12. Compose six calls from eight command slots, matching fifteen ordered strokes.

### Hint search and bounds

`factorySearchSteps` enumerates assignments only to blank slots in the actual editor state. Existing commands and calls are fixed constraints. The largest validated domain is `3^8 × 2^6 = 419904` complete candidate programs. The configurable cap is clamped at 450000. A capped result says that the search is inconclusive; an exhausted domain says that the current filled slots need undoing or clearing.

`searchFactoryAsync` yields after at most 128 candidates, supports an `AbortSignal`, and reports progress. The UI cancels searches on explicit cancellation, editing, pause, reset, navigation and unmount. Stale results cannot replace current hints. Only one suggested blank slot and its value are displayed. No solution is inserted or replayed automatically.

The certificate schema is `{ A: string, B: string, main: string }`, using `F/L/R` in definitions and `A/B` in main. Certificates are separate audit fixtures. Production validation, execution, goals, drawing and hints do not access them.

## Compression Post: lossless segmentation under a real prefix budget

The player covers a public symbolic message from left to right using actual packets. Packets serialize their content, symbol/count, or dictionary index. The decoder reconstructs the message from those packets. Victory requires exact decoded equality and a total cost at or below the public budget.

The deliberately fictional token-unit model is:

- Literal packet: 1 unit header plus 1 per literal symbol, maximum 6 symbols.
- Repeated-run packet: 3 units total, covering 2–9 identical consecutive symbols.
- Dictionary reference: 2 units total, expanding a complete publicly shared entry.

The recipient is assumed to already possess the visible dictionary, so its distribution is outside this puzzle's cost. The player cannot create new entries. These are invented symbolic messages; the game does not upload user data or perform network delivery.

Choices are not a longest-run recipe. Short internal repetitions can be cheaper inside one literal packet. Dictionary phrases can overlap. In the final level, choosing the longest available initial run destroys a useful phrase boundary and makes the budget impossible. The player can deliberately choose costly legal packets and inspect the result; undo remains available.

### Progression

1. Discover literal-header overhead.
2. Introduce profitable long runs.
3. Resist splitting a short internal run.
4. Split between a long run and a literal tail.
5. Weigh run savings against two literal headers.
6. Avoid over-packing tiny repeated pairs.
7. Introduce public shared phrases.
8. Choose between short and long phrases.
9. Preserve a phrase boundary beside a run.
10. Coordinate repeated phrases and a central run.
11. Avoid a locally matching but costly short phrase.
12. Integrate overlapping phrases, run length and tight end-to-end budget.

### Exact hints

`planPostSuffix` computes an exact optimal suffix plan over every legal next boundary. The validated message domain is at most 36 symbols, requiring at most 37 suffix states; authored messages have at most 21 symbols. It never needs a certificate.

`compressionHint` decodes the actual packet prefix, adds its already-paid cost to the optimal remaining suffix cost, and suggests one next packet only when the total can fit the budget. Otherwise it explicitly recommends undoing the last packet. It does not pretend an expensive prefix can be repaired by ignoring previously paid headers.

The certificate schema is an array of `{ kind: "literal", text: string }`, `{ kind: "run", symbol: string, count: number }`, or `{ kind: "dict", index: number }`. Indices are zero-based. Certificates are audit fixtures, independent of the public message, dictionary and cost rules.

## Accessibility and controls

Both modules support click/touch and native Tab/Enter/Space operation. Buttons have a minimum 44-pixel target. Function slots also accept the corresponding command letter, with Escape to cancel and Delete/Backspace to clear. Its custom keyboard handler ignores Ctrl, Meta, Alt and repeats. Conditional-control removal restores focus without scrolling the page. Packet selection and pre-completion undo focus the persistent workbench rather than leaving focus on a removed option. Pausing moves an existing in-game focus to that stable workbench; focus on the external shell is preserved.

Controls retain readable foreground/background combinations in hover, selected, disabled and focus states. No clue is hidden behind hover, clipping or collapsed content. Stroke sequences, exact symbolic messages, dictionary entries, costs, decoded output and progress are visible as text. Content wraps on narrow screens, and explicit scrolling cues explain where the packet history appears. No automatic page-scroll or `scrollIntoView` is used.

## Verification

Focused Vitest coverage: 68 passing tests across `functionCompressionLogic.test.ts` and `functionCompressionUI.test.tsx`. Final post-review project TypeScript validation also passed.

Coverage includes:

- All 24 authored levels played through their rendered controls, in Strict Mode, with throwing certificate getters.
- Independent unit-vector turtle interpreter; semantic alternatives; wrong-order, same-endpoint and wrong-final-heading rejection.
- Production finite search on all 12 function levels with poisoned certificates; independent exhaustive comparison on 27 actual partial states.
- Search cap reporting, pre-start/mid-chunk cancellation, one-slot hints, stale-result interruption and immutable edit history.
- Independent packet decoder and shortest-path cost graph; all 122 suffixes of the 12 compression levels; all first-packet prefix decisions; exact budgets and alternate optimal boundaries.
- Over-budget complete decoding, wrong-prefix/corrupt packets, longest-run traps and immutable undo history.
- Native keyboard, modified-key exclusion, focus restoration, pause/resume, undo, reset, navigation, single completion notifications and immutable completed rounds (both local and external undo paths).

These are logic and jsdom DOM checks. They do not claim real-browser, screenshot, touch-device or assistive-technology verification. Hub integration and browser validation remain separate integration work.

## Stable integration selectors

Function Factory:

- Root: `[data-function-factory]`; completion: `data-factory-won`.
- Slots: `[data-factory-slot="A:0"]`, `B:0`, `main:0`, and subsequent zero-based indices.
- Palette command: `[data-factory-command="F"]` (also L/R/A/B).
- Clear/cancel: `[data-factory-clear]`, `[data-factory-cancel]`.
- Run: `[data-factory-run]`; cancel asynchronous hint: `[data-factory-search-cancel]`.

Compression Post:

- Root: `[data-compression-post]`; attributes: `data-post-cursor`, `data-post-cost`, `data-post-won`.
- Packet choice: `[data-post-packet="literal:3"]`, `run:5`, or `dict:0` (literal/run lengths and dictionary index).
- Undo: `[data-post-undo]`; exact decoded string: `[data-post-decoded]`.
