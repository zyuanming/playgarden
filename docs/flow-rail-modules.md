# Pipe Capacity and Railway Timetable

Two original GPL-3.0-only-licensed, dependency-free React game modules, each with twelve authored levels. Procedural SVG graphics are original and use no upstream artwork or puzzle datasets. Both use the existing `GameProps` shell interface and reset through the level/reset-token key.

## Pipe Capacity / 管道配流

Fill every directed pipe with an integer from zero through its capacity. A question mark means undecided; zero is an explicit, preserved assignment. At every station, outgoing minus incoming flow must equal the publicly displayed balance. Positive balance is supply, negative balance is demand, and zero is a transit station. Demand stations may also have outgoing pipes: they consume only their net demand. Some levels have a public pump-cost budget; each pipe charges flow × unit cost.

This is a capacitated flow/conservation game, not a connectivity or spanning-tree puzzle. All feasible distributions are accepted. The progression covers:

1. One source, two demands and conservation
2. A downstream bottleneck across parallel branches
3. Two sources merging before distribution
4. Cross-supply with unequal branch capacities
5. Explicit zero and a zero-cost budget
6. Multiple sources feeding multiple intermediate stations
7. Cost accumulating over successive pumps
8. A directed cross-branch transfer
9. Consumption at an intermediate station
10. Source-specific inexpensive routes
11. Two layers, eight stations and a shared final cut
12. Ten pipes combining capacities, demand and a tight budget

### Exact hints and bounds

The runtime copies only public nodes, edges and budget. Certificates are never consulted, including by validation, hints, rendering or victory checks. Hints subtract every assigned flow from the balance requirements and run integral minimum-cost flow over the remaining unknown pipes. Reverse residual edges permit rerouting; Bellman–Ford handles their negative costs. The computed completion preserves every assignment, including zero. If none exists, the hint says so and asks the player to undo or clear an assignment; it does not overwrite it. If only the budget fails, the minimum possible completion cost is reported.

Supported public domain: 2–8 nodes, 1–10 directed pipes, capacities 1–5, nonnegative unit costs 0–9, node balances −10 through 10, total positive supply at most 20, optional budget 0–450. No parallel duplicate directed edge or self-loop is accepted. Cycles are supported, although authored puzzles use acyclic networks. There are at most 10 residual vertices and 18 residual edge pairs. At most 70 augmentations are possible after fixed assignments; each augmentation makes positive integral progress. Thus hints are small, synchronous and exhaustively exact without a time cutoff or a misleading “no solution” timeout.

### Public integration interface

- Component: `PipeCapacity`
- Level export: `pipeCapacityLevels`
- Public model: `{ nodes: { label, balance, x, y }[], edges: { from, to, capacity, cost }[], budget? }`
- Test-only certificate: `{ flows: number[], cost: number }`, aligned with edge order
- `[data-pipe-game]`, `[data-pipe-won="true"]`
- Select a pipe with `[data-pipe-edge="i"]`; inspect `data-pipe-flow` (`?` or a number)
- Assign with `[data-pipe-value="0"]` through the selected capacity, or `[data-pipe-value="unknown"]`
- `[data-pipe-node="i"]` contains the target and current partial net balance
- `[data-pipe-hint]`, `[data-pipe-use-hint]`, `[data-pipe-dismiss-hint]`

## Railway Timetable / 列车时刻

A simplified abstract, turn-based railway puzzle. It is explicitly not real railway guidance. Before each tick, the player sets global directed switches and each available train hold signal. Both labeled trains move simultaneously by one directed edge. Entering the same station or exchanging two adjacent stations head-on is prohibited. Following into a just-vacated station is allowed. A train at its own goal is permanently parked and still occupies that station; the other train's goal does not stop it. Dead ends keep a train in place. Some levels remove β's hold signal. Optional deadlines count ticks, never wall-clock time.

The progression covers:

1. Taking turns at a shared junction
2. Following through a shared corridor
3. A siding instead of a head-on swap
4. Waiting before occupying an intermediate goal
5. Coordinating with a train that cannot wait
6. Revisiting switches on a loop
7. Crossing in opposite directions between two switches
8. Choosing between short and longer branches
9. Goal-blocking with a limited tick allowance
10. Using a siding to return to an earlier switch
11. A timed gap for a train without a hold signal
12. A five-tick shortest-route finale with goal-order constraints

### Actual-state shortest hints and bounds

The solver reads only the current train positions and public graph, goals, hold permissions and deadline. Every control setting is editable without consuming a tick, so earlier arrival at a given ordered position pair dominates later arrival. Breadth-first search therefore needs at most 12 × 11 = 132 non-overlapping position pairs, at most 16 actions per pair and at most 2,112 transitions. There are exactly two labeled trains, at most twelve nodes, at most two binary switches, and at most two outgoing edges per node. Optional deadlines range from 1 to 24 ticks. Hints are synchronously bounded; there is no background job or uncancellable expensive search.

The hint proposes settings for a shortest remaining route, but does not automatically advance. Parked goal occupancy and the current tick count are included. Unreachable configurations and missed deadlines produce honest messages. Undo restores the entire previous tick snapshot, including both positions, tick count, switches and holds. Editing controls alone does not add an undo turn. Accepted alternate schedules are not compared with a certificate.

### Public integration interface

- Component: `RailwayTimetable`
- Level export: `railwayTimetableLevels`
- Public model: `{ nodes: { label, x, y, next: number[] }[], starts: [number, number], goals: [number, number], holdAllowed: [boolean, boolean], deadline? }`
- Action: `{ switches: number[], holds: [boolean, boolean] }`
- Switch order: ascending node index of nodes having two outgoing edges; each choice indexes that node's public `next` array
- Test-only certificate: `{ actions: RailAction[], ticks: number }`
- `[data-rail-game]`, `data-rail-tick`, `[data-rail-won="true"]`
- `[data-rail-switch="switchIndex:choiceIndex"]` selects a direction
- `[data-rail-hold="0"]` / `"1"` toggle α / β hold; inspect `aria-pressed` before replaying a desired boolean
- `[data-rail-commit]` advances one tick; `aria-disabled` reports whether its current preview is valid
- `[data-rail-train="0"]` / `"1"`, `data-rail-position`, `[data-rail-track="nodeIndex"]`
- `[data-rail-preview]`, `[data-rail-history]`, `[data-rail-hint]`, `[data-rail-use-hint]`, `[data-rail-dismiss-hint]`

## Interaction and accessibility

Visible first-time instructions and worked opening-level examples are provided. Every capacity, direction, target and occupied goal has an equivalent visible text representation outside the SVG; trains never cover their goal labels. Controls are at least 44 pixels. Native buttons support keyboard, pointer and touch. Pipe flow entry also supports digits, Delete/Backspace and list arrow navigation; railway supports N to advance and arrow selection between train-follow buttons. Ctrl, Meta and Alt modified shortcuts are ignored by custom handlers without cancelling browser defaults.

Hints and undo tokens received while paused are consumed without mutating the game. Completion is notified once per reset, including under React Strict Mode; subsequent undo/hint tokens cannot reopen a completed board. Hint acceptance/cancellation restores a stable game control, and controls disabled on pause/win transfer an existing in-game focus to the status line. Numbered orthogonal routes avoid unrelated station cards and their labels. Distinct edge lanes and the written convention “crossings are not connections” keep graph semantics explicit; the railway model does not simulate collisions at unmarked geometric crossings. Both diagrams preserve fixed-size SVG labels in focusable scroll viewports. Pipe selection and train-follow motion adjust only their scroll viewport, with visible scroll cues; they do not use page-jumping `scrollIntoView`. Colors and background colors are explicitly paired for ordinary, hovered, pressed and disabled states.

## Verification

Presentation-only route labels are placed by `flowRailGeometry.ts`; orthogonal routes and badges do not participate in puzzle rules. Route tests independently check every segment against unrelated station and goal-label rectangles in all 24 authored graphs, while badge tests reject station/target coverage or badge overlap.

Focused suites live in `tests/pipeCapacity.test.tsx` and `tests/railwayTimetable.test.tsx`. Pipe minimum-cost feasibility is checked against independent exhaustive assignment enumeration, including cyclic rerouting and fixed assignments. Railway transitions are checked against a separate simultaneous-move verifier for every position pair and action in all twelve graphs; minimum remaining distances are checked using a separately constructed reverse graph. Both suites verify certificate getter isolation, corrupted witnesses, alternate valid solutions, immutable history, bounds, actual-state hints, pause/reset/undo and one-shot completion. Every one of the 24 authored levels is replayed through DOM controls.

These are jsdom interaction checks, not real-browser visual, touch-device or layout verification. Focused verification: 160/160 tests passed across both suites (24 complete DOM level replays, 24 route-clearance regressions, 24 numbered-label clearance checks and completed-state immutability included), with one Vitest worker and a 384 MiB heap; elapsed test-run duration was 4.95 seconds. Serial `tsc -b` also passed with a 512 MiB heap. No package, shared catalog or dependency changes are included.
