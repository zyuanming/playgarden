# 抛物线靶场 and 电流实验室

Original MIT-licensed educational games with procedural diagrams and no additional dependencies or downloaded assets.

## Integration entry points

- `src/games/ParabolicTargets.tsx`: default `GameProps` component; 12 levels from `parabolicTargetsLevels` in `parabolicTargetsLevels.ts`.
- `src/games/CurrentCircuitLab.tsx`: default `GameProps` component; 12 levels from `currentCircuitLevels` in `currentCircuitLevels.ts`.
- Both use their own `ballisticsCircuitLabs.css` and exact fraction helper `ballisticsCircuitExact.ts`.
- Logic is in `parabolicTargetsLogic.ts` and `currentCircuitLogic.ts`.
- Stable authored replay exports: `parabolicTargetsSolutions` and `currentCircuitSolutions`.
- Each level contains an explicit authored target/goal and a separate `certificate`. Targets are never generated from certificates.
- Catalog metadata, lazy-loading registration and end-to-end checks are maintained separately from these modules.

## Physics model and exactness

### ParabolicTargets

A dimensionless point projectile uses distances in metres and velocities in metres/second on a clearly labelled small-planet model with constant gravity `g = 2 m/s²`:

- `x(t) = vx × t`
- `y(t) = startHeight + vy × t − t²`
- `t_at_target = targetX / vx`
- `verticalSpeed_at_target = vy − 2 × t_at_target`

There is no drag or bouncing. The trajectory ends upon first contact with ground or an obstacle. The visible dashed curve is explicitly labelled as the collision-free mathematical prediction, including any continuation beyond a would-be collision. It is a quadratic SVG Bézier curve, not a set of sampled physics points.

Every obstacle is a closed rectangle. For each full horizontal interval, the exact minimum of the concave quadratic is the smaller endpoint value, and the exact maximum is the larger endpoint or the vertex when inside the interval. The continuous curve intersects the rectangle exactly when its closed vertical range overlaps the rectangle's vertical interval. This prevents tunnelling through thin obstacles and catches tangency/vertex contact. No collision test uses approximate sampling.

Positive launch height and positive target height, together with concavity, prove the ground is not touched before a valid target crossing. A nonpositive target prediction fails. Obstacle messages identify intersected geometry without claiming an uncomputed first collision time. The target window includes its endpoints; obstacles and ground forbid contact. Rising/falling require a strictly positive/negative vertical velocity, so a vertex is neither.

All comparisons and arithmetic use normalized BigInt fractions. Conversion to JavaScript numbers is only for SVG coordinates. The first worked example uses different values from the current puzzle.

Progression: one velocity (levels 1–2), wall and roof clearance (3–5), elevated launch and thin obstacles (6–8), exact fractional/rising target and descending target (9–10), three-part clearance and independent final design (11–12). The final level has 64 velocity combinations and one full solution; a second velocity pair reaches the target with the right direction but collides with the roof, proving the obstacles matter to the answer.

### CurrentCircuitLab

This is an explicitly scoped physical ideal-DC resistor model, not a Boolean/truth-table puzzle and not a claimed arbitrary nodal-network editor. An ideal source of at most 12 V supplies a common series resistor R₀ and one of:

1. A single branch: R₁ + lamp A.
2. Series: R₁ + lamp A + R₂ + lamp B.
3. Parallel: (R₁ + lamp A) in parallel with (R₂ + lamp B).

Each lamp is a strictly positive constant resistor. Ballast resistors are nonnegative; 0 Ω means a wire. Wires have no resistance. Heating, changing lamp resistance, nonlinear LEDs, and source internal resistance are explicitly excluded. The simulator is not a hardware construction guide; its UI warns that real circuits can overheat even at low voltage. Lamp fill indicates measurement, not a fake quantitative brightness meter.

The evaluator performs exact series/parallel reduction and uses Ohm's law to calculate equivalent total resistance, source current, lamp-branch voltage, both lamp currents and voltages, ballast/common voltage drops, and source power. All acceptance comparisons are exact fractions, including 4/3 A and 8/9 A targets. The schematic visibly changes between the actual topologies and numeric readings are produced by the same physical settings shown in the diagram.

A nonzero common resistor deliberately couples the parallel branches: increasing one branch's resistance can raise the other branch's current by reducing shared voltage drop. This is independently tested. With R₀ = 0, the other branch's current remains fixed.

Progression: direct Ohm's law and voltage division (1–2), series current and physical wiring choice (3–4), unequal branches and common resistance (5–7), voltage accounting and coupled branches (8–9), fractional current and topology inference (10–11), combined unique network design (12). The final puzzle has 1,200 configurations, with one exact solution.

## Interaction and accessibility

- No countdown, automatic animation, asynchronous physics loop, or timing-sensitive input.
- Variable controls start unselected. Fixed teaching parameters are readable text chips, not disabled teaching buttons.
- Choosing the first available value for every control fails all 24 puzzles.
- Selecting values does not complete a puzzle: explicit launch/measurement is required.
- Changes clear old measurements. Undo restores the complete prior settings/measurement snapshot.
- Pause blocks changes and consumes hint/undo tokens without applying deferred actions after resume.
- Victory is reported once per mounted level/reset, including StrictMode and undo/re-complete.
- Reset and level changes remount the experiment and reset all state.
- Hints remain visible after edits, measurement, undo, and pause, and recompute from current settings.
- Complete-setting hints include a one-step counterfactual with current and changed physical readings and the mechanism behind the change. Incomplete-setting hints teach what the missing control does without choosing it for the player.
- Native buttons support keyboard Tab, Enter and Space. Action controls are at least 46 px high and 44 px wide; disclosure summaries are at least 44 px high.
- Selected and paused controls retain readable contrast. Reduced-motion CSS disables transitions/animations, although the games have no automatic motion in the first place.
- SVGs include meaningful accessible descriptions. Exact obstacle coordinates are available in a keyboard-accessible disclosure.

## Stable automation selectors

ParabolicTargets:

- `[data-parabolic-game]`, `[data-parabolic-won="true"]`
- `[data-parabolic-part="vx"|"vy"][data-value="<number>"]`
- `[data-parabolic-fixed="vx"|"vy"]`
- `[data-parabolic-obstacle="<zero-based-index>"]`
- Test IDs: `parabolic-launch`, `parabolic-height`, `parabolic-flight-time`, `parabolic-curve`, `parabolic-hint`, `parabolic-worked`

CurrentCircuitLab:

- `[data-current-game]`, `[data-current-won="true"]`
- `[data-current-part="topology"|"voltage"|"common"|"ballastA"|"ballastB"][data-value="<value>"]`
- Topology values: `single`, `series`, `parallel`; fixed parameters do not create interactive buttons.
- `[data-current-fixed="<part>"]`
- `[data-current-topology="series"|"parallel"|"single"]`
- `[data-current-goal="ia"|"ib"|"va"|"vb"|"sourceI"|"busV"][data-matched="true"]`
- `[data-current-reading="<quantity>"]`
- Test IDs: `current-measure`, `current-hint`, `current-worked`, `current-unwired`

## Verification

File: `tests/ballisticsCircuitLabs.test.tsx`.

65 tests pass:

- Exact arithmetic, normalization, large integer comparisons and malformed fractions.
- Independent unsimplified-integer ballistic oracle classifies all 255 authored velocity pairs.
- Closed-boundary contact, thin rectangles, interior-vertex collision, tiny clearances, exact target inclusion, ground, and strict target direction.
- Independent conductance-matrix nodal solver, with ideal-wire node collapse and Gaussian elimination, matches all 1,884 authored circuit configurations. This is algorithmically distinct from the production series/parallel solver.
- Source power equals total resistor dissipation, KCL at parallel branches, KVL across source/common/load, and equal series currents.
- Shared-resistor coupling, ideal independent-branch limit, and rejection of rounded target approximations.
- All 24 independent authored certificates, all 24 rendered certificate replays, and complete reversible state histories.
- Unique final designs and proof that final ballistics obstacles reject an otherwise-valid candidate.
- Bounded finite search (128 ballistic / 2,048 circuit nodes) with honest capped-search results.
- Invalid moves/configurations, victory locks, snapshot immutability, stale-reading clearing/restoration.
- StrictMode, once-only completion, pause/resume, consumed paused tokens, reset, level change, persistent hints, native keyboard Enter/Space.

Commands for sequential focused checks:

```
NODE_OPTIONS=--max-old-space-size=384 ./node_modules/.bin/vitest run tests/ballisticsCircuitLabs.test.tsx --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=512 ./node_modules/.bin/tsc --noEmit
```

The original focused suite passed 65 tests and TypeScript checks. Later integration adds teaching/readability regressions; current aggregate results and browser evidence are recorded in CI. Rendered component checks use jsdom and do not replace browser layout review.
