# Graph optimization games: implementation and certificate notes

All implementation, level layouts, graph weights and explanations in this module are original Playgarden work covered by the repository MIT license. No external source code, assets, services or packages were added.

## UntangleGarden

- Default component: `src/games/UntangleGarden.tsx`.
- Engine and twelve levels: `src/games/untangleLogic.ts`.
- A move selects one labeled flower and relocates it to an empty discrete grid spot. Intermediate crossings are legal. A solved board has neither intersections between nonincident edges nor another vertex on any edge, including collinear overlaps.
- All level coordinates are integer grid coordinates. Orientation and segment-intersection arithmetic uses exact integer operations. Supported grid sizes are 2–8; the twelve authored boards use a 5×5 grid, 4–9 flowers and 3–16 edges.
- Every level contains an explicit planar `solution` placement. `verifyUntangleLevel` checks its validity, graph connectivity, a conflicting initial layout and unique/legal edges. The initial layout is a deterministic bounded scramble, without random runtime input.
- `untangleHint` works from the actual current placement. It fills a free certified destination or temporarily parks a blocking flower outside the destination set. Each direct move permanently fixes a flower, and each occupancy cycle requires one temporary move. At most 2n moves suffice. It does not claim each move decreases crossings or is a shortest solution.
- Any valid planar placement wins, even if it differs from the certificate.

## MinimumNetwork

- Default component: `src/games/MinimumNetwork.tsx`.
- Engine and twelve levels: `src/games/minimumNetworkLogic.ts`.
- A move toggles a weighted undirected edge. A solved network is connected, acyclic and has globally minimum total cost. Any optimal tree is accepted, including tied alternatives.
- Supported graphs have 2–12 vertices, unique undirected edges, and integer edge costs 1–99. The authored progression has 4–9 stations and 5–17 edges.
- Each level includes an explicit spanning-tree `certificate` and authored `minimumCost`. Independent certificate validation uses the cycle property: every non-tree edge costs at least the maximum edge on the certificate's unique tree path. This validator does not use Kruskal.
- Gameplay computes the actual optimum with deterministic Kruskal. Hints prefer the maximum possible number of already selected edges among all optimal trees, via cost-first/selected-second edge ordering. Each hint removes an edge outside this tree or adds a missing edge. The polynomial algorithm has no search cutoff or budget-based impossibility claim.
- Lines crossing in the diagram do not create new stations. Full station names and weights are available on the separate large edge buttons.

## Interaction and selectors

Both components implement `GameProps`, reset/level-keyed state, pause locking, immutable move history, undo, hint tokens consumed without mutation while paused, and one completion callback per round. Native buttons support touch, Tab, Enter and Space. Arrow/Home/End keys move focus; Escape cancels flower selection.

- Untangle root: `[data-graph-game="untangle"]`
- Untangle cells: `[data-garden-spot="N"]`
- Current flower: `[data-garden-node="N"]`
- Hint destination: `[data-hint-destination="true"]`
- Untangle completion: `[data-untangle-solved="true"]`
- Network root: `[data-graph-game="minimum-network"]`
- Toggle edge: `[data-network-edge="N"]`
- Hint action: `[data-hint-action="add"]` / `[data-hint-action="remove"]`
- Network completion: `[data-network-solved="true"]`
- Noninteractive drawn edges: `[data-garden-edge="N"]` / `[data-network-line="N"]`

## Verification coverage

`tests/graphOptimizationGames.test.tsx` contains:

- All 24 independently checked certificates.
- An independently implemented parametric geometry oracle over every 3-node placement on a 3×3 grid and every nonempty simple 4-node graph on all 2×2 placements.
- Independent subset/reachability enumeration of every authored network's optimal trees and all 729 four-node graphs with absent/1/2-cost edges.
- Acceptance of every enumerated optimal tree, plus verification of maximum-preservation tie handling.
- Hint completion from arbitrary valid current placements and every selection of a small weighted graph.
- All-level completion using the actual rendered flower/empty-cell or edge controls, plus pause, undo, reset, keyboard, alternate optima, malformed input and idempotent completion tests.

This file describes the verification suite, not its execution status. The delivering worker reports the actual commands and results separately. No browser-based screenshot QA is performed by this module worker.

## Independent playability review corrections

- Seeded edge ordering is shuffled independently of the authored tree; certificates are remapped. A regression rejects a winning first-(n−1)-button prefix in every level.
- Weight labels are placed along their own edges with separation from stations and other labels. The coordinate regression checks all pairs; rendered screenshots still need visual review.
- A flower hint remains visible while the hinted flower is selected, until its destination is chosen or the player cancels.
- Flower accessible names list their connected neighbors. A text conflict list identifies crossing paths and paths passing through flowers, so the drawn SVG is not the sole source of graph structure.
