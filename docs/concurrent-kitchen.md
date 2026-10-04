# 并发厨房 / Concurrent Kitchen

Original Playgarden game and artwork, MIT licensed. No external assets or new dependencies.

## Learning and rules

A finite scheduling puzzle with 12 handcrafted levels. Tasks have a fixed duration, one single-capacity station, and zero or more predecessors. Assign every task an integer start time at or after zero. A task occupies its station over the half-open interval `[start, start + duration)`. All predecessors must finish by its start. Different stations may run in parallel. Tasks cannot be interrupted. Every task must finish at or before the displayed deadline. Idle slots are allowed. Any legal complete schedule wins; the authored certificate is not part of the acceptance rule.

All time is abstract. The kitchen imagery is fictional and is not cooking or food-safety guidance. There is no clock, animation race, score pressure, or external state.

The progression introduces a chain, independent parallel work, station competition, filling idle time, downstream chain priority, cross-station returns, joins, and tight eight-task schedules. Late lessons give planning strategies without listing placements.

## Module contract

- Component: `src/games/ConcurrentKitchen.tsx`, default export, standard `GameProps`.
- Levels: `src/games/concurrentKitchenLevels.ts`, `concurrentKitchenLevels` (12 entries).
- Logic: `src/games/concurrentKitchenLogic.ts`.
- Styling: `src/games/concurrentKitchen.css`, scoped under `.concurrent-kitchen`.
- Tests: `tests/concurrentKitchen.test.tsx`.

No registry, shared shell, catalog, package, or e2e files are changed by this module.

A certificate is `level.solution: { task: string; start: number }[]`. A live schedule is `Record<string, number>`; absent keys mean unassigned. Editing uses `{ task, start: number | null }`, with null removing just that task. Dependencies do not force users to enter placements in topological order.

Conflicting bounded placements remain on the board and get textual explanations. This enables independent editing without cascading removal. The player can move or remove any task, or use shell undo/reset. An assignment outside the time domain or with an unknown ID is rejected. A no-op does not consume undo history.

Pause freezes all mutations and consumes hint/undo tokens without deferring them until resume. Winning locks schedule edits and undo in both logic and UI until the shell resets. Task selection remains available for inspection. Focused placement buttons use guarded `aria-disabled`, not native disabling, so keyboard focus stays on the initiating button after pause or victory. Teaching text stays fully legible.

## Exact bounded hints

`searchKitchen` uses finite-domain CSP search, independently of `level.solution`. Fixed player placements become singleton domains. Arc consistency removes start values without compatible partners; MRV branching exhaustively explores remaining possibilities. Pair constraints cover station non-overlap and predecessor finish-before-start. Hard limits are 6,000 search nodes and 240,000 compatibility checks. Smaller caller budgets are supported.

Statuses are deliberately distinct:

- `invalid`: malformed task graph or out-of-domain schedule.
- `conflict`: a direct overlap or predecessor violation among assigned tasks.
- `solved`: a complete extension that preserves all currently assigned starts.
- `impossible`: exhaustive proof that the fixed partial schedule has no extension.
- `limit`: either budget exhausted; no impossibility claim is made.

A successful hint picks one currently unassigned task with assigned predecessors and proposes its start in a verified extension. A conflict points to a named task and offers change/remove/undo. A proven dead end recommends removing a named current placement and rechecking, explicitly noting that several tasks may need adjustment. It does not claim that one removal alone solves the puzzle. Hints never move the player's placements automatically.

## Stable DOM selectors

- `[data-kitchen-game]`: attributes `data-kitchen-schedule` (JSON), `data-kitchen-won`, `data-kitchen-selected`, `data-kitchen-conflicts`.
- `[data-kitchen-task="A"]`: task selection and dependency/status card, `aria-pressed` reflects selection.
- `[data-kitchen-start="0"]`: place selected task at this integer start, `aria-pressed` reflects assignment.
- `[data-kitchen-remove]`: remove only the selected task.
- `[data-kitchen-timeline]`: semantic read-only station/time table.
- `[data-kitchen-cell="prep:0"]`: station slot with full textual occupancy label.
- `[data-kitchen-issues]`: current explicit conflict explanations.
- `[data-kitchen-hint="solved|conflict|impossible|limit|invalid"]`: hint status and text.

Touch targets are at least 44 px. Keyboard uses native Tab, Enter, and Space. Timeline can scroll horizontally with keyboard focus on narrow screens; cards and editing controls remain within the responsive panel. The selected task is identified by border, label, and `aria-pressed`, not color alone. Conflict markers include text and punctuation.

## Verification design

The independent test oracle enumerates all permutations of task order at each station, adds those orders as DAG edges, and computes earliest starts topologically. Every legal non-preemptive schedule induces one enumerated station order, so this proves minimum makespan without reusing production CSP logic. A separate slot-expansion checker verifies resource occupancy and dependencies.

Tests certify all 12 hand-authored schedules and tight optimal deadlines, solve all levels without certificates, preserve partial player assignments, compare every partial schedule of an independent three-task fixture, distinguish conflict/impossible/budget results, accept alternate schedules, replay all certificates through rendered controls, and exercise pause, undo, reset, level changes, Strict Mode, keyboard, retained focus, and completed-state locking.

No browser-based visual or real-device checks are included in this module's authoring task; those remain integration review work.

## Author verification (2026-10-04)

- Focused Vitest: **50 tests passed** (`--maxWorkers=1`, 384 MB heap).
- Full workspace TypeScript: **passed** (`--noEmit --incremental false`, 512 MB heap).
- All six module files formatted with the existing Prettier dependency.
- Browser visual, production build, and shared registry/catalog integration are not claimed by this isolated module check.
