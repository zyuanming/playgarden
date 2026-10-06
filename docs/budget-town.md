# 预算小镇 / BudgetTown

Original GPL-3.0-only game, handcrafted maps, Chinese teaching copy, and procedural SVG town art. No new dependencies, external assets, network calls, demographic scoring, randomness, or real-money advice.

## Integration

- Suggested id: `budget-town`
- Default component: `src/games/BudgetTown.tsx`
- Levels: `budgetTownLevels` from `src/games/budgetTownLevels.ts` (12)
- Logic: `src/games/budgetTownLogic.ts`
- Isolated styles: `src/games/budgetTown.css`
- Suggested description: 用有限游戏币组合空间设施，让每个住区的服务都被覆盖。
- Category suggestion: 逻辑推理 / 规划; the integration owner chooses the existing category vocabulary.
- Supports the existing `GameProps`. No catalog, registry, shell, package, e2e or other game files are changed.

## Mechanic and progression

This is a weighted spatial set-cover puzzle. Fixed candidate plots propose facilities with distinct service bundles, costs and Manhattan radii. The player selects a plot, inspects its preview, then builds or removes it. Each home has one, two or three explicit service requirements: green space, reading and water. These are abstract puzzle labels. A facility covers a requirement only when its service matches and horizontal distance plus vertical distance is within its inclusive radius. No terrain blocks distance. Each facility can serve multiple homes without capacity depletion; overlapping service is allowed but counts once.

The complete plan must satisfy every home/service requirement and stay at or below the budget. The game accepts every valid solution and does not compare layouts to the stored certificate. Overspending is deliberately allowed while editing so the player can inspect a full but unaffordable plan. The ledger and feedback explicitly identify overspending, and completion is blocked until both conditions hold. Removal refunds the full fictional cost. Undo restores an exact snapshot.

The 12 authored maps progress from shared-radius coverage, to multiple equivalent positions, to multi-service cost comparison, then asymmetric mixed-service layouts with up to 8 homes and 15 candidates. Minimum-cost budgets are 3, 6, 5, 15, 15, 21, 21, 29, 24, 29, 31, and 38. The third level deliberately introduces two-service bundles on a smaller map before expanding again. The last map requires six facilities and has 16 optimum layouts. All candidates cover at least one real requirement; buying every proposal exceeds every budget. Each budget equals the independently proven minimum cost, so no spare budget can hide an inefficient choice.

Candidates are lettered in row-major map order, independent of certificate order. The open first-level tutorial provides a worked sharing example and concrete first-board guidance. Later level descriptions discuss a planning idea rather than disclosing an ordered solution. Completed teaching and the player's final plan remain readable in the component.

## Certificate schema

Each `BudgetTownLevel` contains:

- `width`, `height`, `budget`
- `homes: { id, x, y, needs: ('g' | 'r' | 'w')[] }[]`
- `proposals: { id, x, y, kind }[]`
- `certificate: { built: string[], cost: number, minimumCost: number, optimalPlans: number }`
- `title`, `lesson`, `discovery`

Coordinates are zero-based. The certificate's `built` array is a set of proposal IDs, not an action-order requirement. For a rendered replay, click `[data-budget-town-proposal="ID"]` to inspect a plot and then `[data-budget-town-toggle="ID"]` to toggle it. Every certificate entry can be built in any order. Goal recognition, action logic and hint search do not read the certificate. Tests poison certificate values and still validate independently discovered alternatives.

## Bounded hints

`searchBudgetTown(level, built, maxStates)` independently enumerates the at-most 2^15 candidate subsets using coverage masks and accumulated cost. Its hard limit is 32,768 visits. The objective is the fewest toggle edits from the actual current plan, then the least cost. It can retain valid off-certificate choices, recover from overspending, or replace an unhelpful facility. Suggestions remove surplus facilities before suggesting additions. The hint highlights one plot and describes the next edit; it never executes the edit.

Return statuses are `found`, `solved`, `invalid`, `unsolvable`, and `limit`. Reaching a cap never claims no solution or reports an unproven optimal edit count. Map validation bounds dimensions, home and proposal counts, checks unique IDs/coordinates, kinds and needs, and rejects invalid plans before allocation. Requirements are capped at 30 bits.

## Stable selectors

- Root `[data-budget-town-game]`
- Root attributes: `data-budget-town-level`, `data-budget-town-built` (comma-separated proposal IDs), `data-budget-town-spent`, `data-budget-town-covered`, `data-budget-town-won`
- `[data-budget-town-map]` keyboard planning group
- `[data-budget-town-proposal="A"]` candidate-selection button, `data-built` boolean
- `[data-budget-town-selection="A"]` selected proposal card
- `[data-budget-town-toggle="A"]` build/refund action
- `[data-budget-town-home="H1"]`, `data-missing` service codes
- `[data-budget-town-requirement="H1"]` service checklist
- `[data-budget-town-preview]`, `[data-budget-town-budget]`, `[data-budget-town-remaining]`
- `[data-budget-town-feedback]`, `[data-budget-town-hint]`, `[data-budget-town-complete]`
- `[data-budget-town-undo]` local undo button

Only player state and feedback are exposed in rendered selectors. Certificates are not serialized into the DOM.

## Lifecycle and accessibility

The component remounts on level/reset-token changes. Pause freezes selecting, building, refunding, keyboard actions, hints and undo; token changes during pause are consumed and never replayed after resume. Per-round completion is guarded against StrictMode and repeated input. After a win, local and shell undo stay locked so the completed banner and board cannot disagree; reset permits a fresh award.

Candidate buttons and action buttons have minimum 44px targets. Native controls support Tab, Enter and Space. The focused map supports arrows to cycle plots and Enter/Space to build or remove. Repeated or modified keys and keys bubbled from native controls do not cause extra actions. A narrow viewport can scroll the map horizontally rather than shrinking targets. Text labels, check marks and missing-service counts accompany colors. The selected radius is shown geometrically and the textual preview lists exact affected home/service pairs.

## Verification

`tests/budgetTown.test.tsx` includes a separate facility specification, separate coverage interpreter and recursive exhaustive subset oracle. It independently certifies all budgets, all optimum counts, certificate feasibility, candidate usefulness, alternative solutions, and runtime coverage/budget agreement across sampled subsets. It compares current-state search edit distances with every oracle solution. It also renders and completes all 12 certificates, an alternate final-level layout, an over-budget repair, pause/resume token consumption, undo/reset/level transitions, StrictMode completion, keyboard use and repeated-input guards.

Commands are run serially in the integration owner's resource slot:

```
NODE_OPTIONS=--max-old-space-size=384 ./node_modules/.bin/vitest run tests/budgetTown.test.tsx --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=512 ./node_modules/.bin/tsc --noEmit --incremental false
```

Browser rendering, screenshots, a production build and shell/catalog integration are not performed by this isolated work unit. No browser was used, per assigned scope.

Final isolated verification: all 27 focused tests passed, including all 12 rendered certificates, and the full available-checkout TypeScript check passed. Browser/screenshots remain an integration-owner check.
