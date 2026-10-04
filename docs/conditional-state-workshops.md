# 条件分拣 / 状态机门锁

Original MIT games, levels, procedural SVG graphics and Chinese instructional copy. No third-party assets, packages, network services or randomness. Both components use the existing `GameProps`; catalog, shell, artwork and browser integration belong to the integration owner.

## Integration

- `conditional-sorter`: `ConditionalSorter.tsx` default export; `conditionalSorterLevels` from `conditionalSorterLevels.ts`. 12 levels; suggested category 编程启蒙. Description: 编写有优先级的条件规则，让每一种包裹都去对的箱子。
- `state-machine-locks`: `StateMachineLocks.tsx` default export; `stateMachineLocksLevels` from `stateMachineLocksLogic.ts`. 12 levels; suggested category 编程启蒙. Description: 读取状态转移表，用有限输入同时控制状态和多扇门锁。

Each component imports its own fully scoped CSS. No shared registry, catalog, shell, package or e2e changes are included.

## ConditionalSorter

This is first-match decision-list synthesis. The player edits ordered IF / ELSE IF conditions and destination bins, swaps adjacent rules, and chooses an ELSE destination. An empty condition skips a rule. Predicates combine shape, material and number properties; there is no per-parcel manual routing. The first matching rule stops execution. The editor accepts all correct programs, including equivalent alternatives, rather than matching a stored answer.

Each level's domain is the complete Cartesian product of explicitly displayed shapes, materials and numbers. The full 8–54-row test table remains available and scrollable; there are no hidden or sampled tests. Every edit checks the entire domain. Selecting a parcel or the first counterexample shows the conditions checked, the first matching rule, actual bin and target bin. More-specific exceptions compete with broad rules, so order genuinely matters.

Progression: 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4 necessary rules. The test suite independently proves these minimum lengths; higher levels combine exceptions, conjunction, reused output bins and prime-number predicates. Conditions are presented in a fixed structural order independent of certificates. An initially open explanation illustrates first-match semantics with a worked example; it is clearly distinguished from the current shipping brief.

Certificate schema: `SortLevel.solution` is `{ rules: [{ condition: string | null, bin: number }], otherwise: number }`. `targets` are generated from independent shipping-brief functions, never by evaluating this certificate. Acceptance reads the target array, checks valid input, and interprets the player's program over the entire domain. Tests use separate predicates, a separate interpreter, independently encoded shipping briefs, and a separate minimum-decision-list solver.

`searchSort` deterministically synthesizes a correct decision list using only the domain, target bins and allowed predicates. It never reads `solution`. Each candidate rule may capture only one target class among still-unclassified parcels. Search prefers the current row's predicate but does not claim minimum edits or that a suggested edit immediately improves the correct count. Failed states are memoized by remaining-domain mask and row. The fixed cap is 20,000 visits; outcomes distinguish `found`, `solved`, `unsolvable`, `limit`, and `invalid`. Hints show one editable field and explain that later rules may also need repair.

Selectors:

- Root `[data-sorter-game]`, `data-sorter-won`, `data-sorter-program` (player program only)
- `[data-sorter-condition="0"]`, `[data-sorter-bin="0"]`, `[data-sorter-otherwise]`
- `[data-sorter-up="0"]`, `[data-sorter-down="0"]`
- `[data-sorter-parcel="0"]`, `[data-sorter-counterexample]`
- `[data-sorter-test="0"]`, `data-target`, `data-actual`

## StateMachineLocks

This is a finite-state controller with persistent door outputs and consumable input stock. Sending an input immediately spends one occurrence and follows the cell at the current state and input column. That transition chooses the next state and optionally opens, closes or toggles one named door. Other doors retain their values. The same input can do different things in different states; input names are not fixed operations. Success requires both the target state and every target door state. Reaching only the target state, or only opening all doors, is insufficient.

All states and input transitions are visible in a complete table. The current row is marked with text as well as styling. Input buttons preview the next state and output. Forbidden-state transitions are visible and may be tried; they stop the machine and are fully reversible through undo. Resources force planning rather than unlimited trial sequences. The machine is not a spatial route board or numeric bit-register transformer.

The 12 hand-authored transition matrices progress from a two-input handshake to three persistent locks, three finite input types, safe-return planning, destructive outputs and an initially open lock that must be closed before the final reopening. Shortest-length progression is 2, 3, 4, 4, 4, 4, 5, 6, 6, 7, 8, 9. Each level's certificate is an explicit `solution: number[]` of input indices; `par` is the independently verified shortest length. Input display order is always A, B, C, not certificate order.

`searchMachineLocks` is deterministic bounded breadth-first search keyed by machine state, all door states and all remaining input counts. It uses no certificate and returns the shortest valid continuation from the actual current board, including off-certificate play. At 30,000 states it reports uncertainty rather than impossibility. `found`, `solved`, `unsolvable`, `limit`, and `invalid` are distinct. Hints highlight only the next input and never execute it.

Tests use a second machine interpreter storing named open-door sets and a bag of input labels, with separate goal recognition and reverse-order BFS. They verify every state/input/door combination, certificate resources, forbidden-state avoidance, true shortest distances, all certificate prefixes and every possible first input.

Selectors:

- Root `[data-machine-lock-game]`, `data-machine-lock-state`, `data-machine-lock-doors` (0/1 in declared door order), `data-machine-lock-remaining` (comma-separated), `data-machine-lock-won`
- `[data-machine-lock-input="0"]`, `data-remaining`
- `[data-machine-lock-door="0"]`, `data-open`
- `[data-machine-lock-rule-state="0"]`, `[data-machine-lock-history="0"]`

## Lifecycle and accessibility

Both modules remount on level/reset changes, consume hint and undo token changes while paused without replaying them after resume, and guard completion with a per-round ref. Undo after success does not produce a second completion callback when re-winning the same round. New reset tokens permit a new completion. Undo restores complete snapshots; hints clear after edits and undo.

Native buttons and selects support Tab, Enter, Space and arrow-key selection; StateMachineLocks additionally accepts 1–3 when its workbench is focused, with repeated and modified keys ignored. Every actionable touch target is at least 44px tall. Parcel shapes and materials have labels; lock states have text plus distinct open/closed geometry. Success and failure use words/symbols rather than color alone. Both games expose Chinese worked explanations, full rules, current-state feedback and accessible control names.

## Verification

Focused test files: `tests/conditionalSorter.test.tsx` and `tests/stateMachineLocks.test.tsx`. Their rendered jsdom replays drive actual selects/buttons through all 24 complete certificates, with additional alternative-solution, pause, reset, undo, off-path hint, exhaustion, keyboard, repeated-input and StrictMode regressions.

Commands, run serially under the integration owner's resource slot:

```
NODE_OPTIONS=--max-old-space-size=384 ./node_modules/.bin/vitest run tests/conditionalSorter.test.tsx tests/stateMachineLocks.test.tsx --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=512 ./node_modules/.bin/tsc --noEmit --incremental false
```

Browser rendering, screenshot review, full application build and shell/catalog/e2e integration are not performed by this isolated work unit. No browser was used, per assigned scope.

Final isolated validation: 47 focused tests passed across both files, and the full available-checkout TypeScript check passed. No browser/screenshot claims are made.
