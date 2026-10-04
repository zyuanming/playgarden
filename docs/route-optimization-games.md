# Route optimization games: original design and validation

Two original MIT-licensed Playgarden games, authored for this repository. All rules code, level graphs, cost assignments, text, SVG road maps, and CSS are new. No external game source, photographs, sprites, copied puzzle data, or third-party assets are used.

## Integration contract

- `TownTour.tsx`: default React component accepting the existing `GameProps`; 12 levels in `townTourLevels`.
- `PostmanRoutes.tsx`: default React component accepting the existing `GameProps`; 12 levels in `postmanRoutesLevels`.
- `RouteOptimizationRound.tsx`: internal accessible walking UI shared only by these games.
- `routeOptimizationLogic.ts`: bounded exact solvers, immutable moves, prefix-aware hints, independent postman lower bound, certificate validation.
- `routeOptimizationLevels.ts`: authored geometry, explicit shuffled road order, difficulty rationale, and literal certificates.
- `routeOptimization.css`: scoped styles; minimum 44 px controls, large map labels, distinct town-passport and postal-coverage feedback.
- `tests/routeOptimizationGames.test.tsx`: independent mathematical oracles and every-level rendered replay.

The parent integration owns catalog, registry, shell, package, and end-to-end test changes. These files do not alter those surfaces.

## Different mathematical goals

### 巡回探访 / TownTour

Walk from town A, visit every town exactly once, and return to A. Minimize the sum of actual road weights, including the final return. Intermediate repeat visits and an early return home are illegal. Roads need not all be used. Every level has multiple feasible tour costs; level 5 has six optimal oriented tours, including genuinely different tours beyond simple reversal. Every optimal tour is accepted.

The UI emphasizes a passport of visited towns and the one-time visit rule. A completed but expensive tour is not success; it remains undoable.

### 邮差路线 / PostmanRoutes

Walk from depot A, traverse every undirected road at least once, and return to A with minimum total weight. Both towns and roads may be revisited, paying the road's weight each time. Every authored level requires positive repeated-road cost in every optimum. The UI emphasizes road coverage, each road's traversal count, double-line repeat markings, and a separate repeated-cost total.

This is neither an Euler-trail game (edges exactly once) nor a minimum-spanning-tree game (choose infrastructure without walking). Expensive roads cannot be omitted merely because cheaper alternatives exist: delivery is required on every road.

## Certificate schema

Each level includes the literal object:

- `schema`: `"playgarden.route.v1"`
- `walk`: node-index array including the depot at both ends
- `minimumCost`: positive integer total cost

Road indices are not certificate IDs. `walk` is reconstructed against endpoint pairs, so the road presentation can be interleaved without changing the proof. Certificates are never read by the move controller, hints, or goal check. They are used only by validation and tests.

`verifyRouteCertificate` requires a valid connected graph, a legal goal-completing walk, the declared cost, and an exact-solver agreement. Postman validation additionally compares the state-space optimum with an independently derived odd-vertex pairing optimum.

Bounds: 3–8 towns, at most 13 roads, integer road costs 1–99, no duplicate or self-loop edges, connected graph. Player history is capped at 128 moves with a visible undo/reset explanation. Authored optimal walks are much shorter.

## Exact algorithms and independent checks

TownTour uses Held–Karp tail dynamic programming over `(visited-town mask, current town)`. At most `8 × 2^8` states; every state examines at most 13 roads. Reconstructing a completion retains the player's actual prefix. Tests independently enumerate every town permutation; the oracle does not reuse the production DP or analyzer.

PostmanRoutes uses reverse Dijkstra over `(covered-road mask, current town)`, ending at `(all roads covered, depot)`. At most `8 × 2^13 = 65,536` states. A reverse transition can keep the covered mask or remove the traversed road's bit, corresponding to a repeat traversal or its first traversal in the forward direction. A binary heap and typed arrays bound storage. Static-level tables are cached by level identity.

A second production proof uses road-weight sum plus minimum shortest-path pairing of odd-degree vertices. The graph is undirected and connected with strictly positive weights, satisfying the Chinese-postman theorem assumptions. Tests independently compute shortest paths by repeated edge relaxation and enumerate all perfect pairings. They also compare reverse-state results with an independent forward shortest-walk oracle for every connected four-town simple graph and every possible initial move.

## Hints, interruptions, input, and accessibility

- A hint computes the cheapest continuation from the *actual current path*. It suggests only one real road and never moves for the player.
- If current spent cost plus the best continuation exceeds the global optimum, the hint finds the shortest suffix that must be undone before an optimal result is attainable. It does not promise that an over-budget prefix is recoverable by walking onward.
- Town prefixes with no legal completion explicitly request undo as well.
- Undo removes exactly one edge traversal and refunds that edge's cost. Repeated-road coverage falls only when its last traversal is removed.
- Reset and level change remount the round, clearing path and hints. Hint/undo token changes received while paused are consumed without changing state and are not replayed on resume.
- Completion is emitted once, including under React Strict Mode. Won boards are frozen until reset or level change.
- Native buttons support tap, click, Enter, and Space. Arrow keys and Home/End move focus among currently actionable roads only; focus navigation does not take a step.
- Every road button names both endpoints, weight, number of traversals, and its current action or unavailable reason. A plain-text path exposes the entire walk. There is no color-only rule or feedback.
- The map places only large A–H labels at separated coordinates, avoiding crossing-edge cost-label collisions. Weights and endpoints are in the road cards. The map explicitly explains that crossing lines are not junctions and drawn length is not price.
- Worked numerical examples are initially expanded in each game's first level. They are separate from that level's actual answer.
- Road data is intentionally shuffled independently of the certificate; button order does not encode a solution.

## Level progression and decisions

### TownTour

| # | Level | Towns / roads | Optimum | Decision focus |
|---|---|---|---|---|
| 1 | 街角第一次拜访 | 4 / 6 | 12 | Three different tour costs; count the return leg |
| 2 | 近路之后 | 4 / 6 | 10 | A cheap start does not settle the later choice |
| 3 | 五镇集市 | 5 / 8 | 14 | Preserve an entry and exit for every remaining town |
| 4 | 山路的回程 | 5 / 9 | 11 | Coordinate the cheap middle segment and return endpoint |
| 5 | 两种好计划 | 5 / 10 | 12 | Multiple genuinely different equal optima |
| 6 | 六镇连廊 | 6 / 9 | 18 | Sparse cross-region roads must form a coherent itinerary |
| 7 | 河湾绕行 | 6 / 10 | 16 | Coordinate two attractive bridge connections |
| 8 | 折返要付费 | 6 / 11 | 17 | Eight tour costs; avoid locally cheap commitments |
| 9 | 七镇日程 | 7 / 11 | 17 | Join short visit segments while tracking more towns |
| 10 | 山谷的两端 | 7 / 12 | 19 | Avoid closing a small loop or exhausting an exit |
| 11 | 环湖商务行 | 7 / 12 | 20 | Compare outer-ring travel with central exchanges |
| 12 | 旅行规划师 | 7 / 13 | 16 | Nine distinct costs; joint start, bridge, and return planning |

### PostmanRoutes

| # | Level | Towns / roads | Optimum | Necessary repeat cost | Decision focus |
|---|---|---|---|---|---|
| 1 | 邮局外的小岔路 | 4 / 4 | 13 | 2 | A dead-end spur forces a return traversal |
| 2 | 昂贵路也要送到 | 4 / 5 | 22 | 4 | Deliver on the expensive edge, repeat cheaper alternatives |
| 3 | 两个投递支线 | 5 / 5 | 19 | 5 | Two compulsory excursions with a main-loop choice |
| 4 | 对角线的选择 | 4 / 6 | 27 | 4 | Compare three ways to repair four odd junctions |
| 5 | 集市的五个路口 | 5 / 7 | 24 | 4 | Pairing choices and coverage order interact |
| 6 | 先跨桥再绕圈 | 6 / 7 | 22 | 2 | Repeat the joining bridge, avoid duplicating both circles |
| 7 | 三条平行长街 | 6 / 8 | 27 | 4 | Multiple returns between common endpoints |
| 8 | 一条近路两个用途 | 6 / 9 | 34 | 7 | Six odd junctions require a global pairing plan |
| 9 | 桥边的投递顺序 | 7 / 9 | 32 | 5 | Separate forced bridge cost from internal repair choice |
| 10 | 六个奇数路口 | 7 / 10 | 36 | 6 | Six odd junctions and fifteen possible pairings |
| 11 | 湖区邮件网 | 7 / 11 | 41 | 8 | Compare direct and indirect paths for six odd junctions |
| 12 | 总邮差的最省一天 | 8 / 13 | 46 | 8 | Eight-town, thirteen-road combined coverage and cost planning |

## Verification commands

Run checks serially to fit the shared workspace's memory budget:

- `NODE_OPTIONS=--max-old-space-size=384 ./node_modules/.bin/vitest run tests/routeOptimizationGames.test.tsx --maxWorkers=1`
- `NODE_OPTIONS=--max-old-space-size=512 ./node_modules/.bin/tsc -b`

Focused validation on 2026-10-04: 90 tests passed, including all 24 rendered level replays; TypeScript build-mode checking passed. Parent integration performs full-suite/build/browser checks; focused checks alone do not establish a complete repository pass.
