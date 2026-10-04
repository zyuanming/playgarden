# Motion and buoyancy laboratories

Original Playgarden implementation, MIT. No imported game source, remote models, assets, fonts, packages, persistent storage, network calls, timers, animation loops, or WebGL dependency.

## Files and integration exports

- `src/games/InclineLab.tsx`: default `InclineLab(GameProps)`.
- `src/games/BuoyancyDock.tsx`: default `BuoyancyDock(GameProps)`.
- `src/games/inclineLogic.ts`: `inclineLevels`, `inclineSolutions`, `verifyInclineLevel`, `createInclineState`, `validInclineSettings`, `evaluateIncline`, `moveIncline`, `undoIncline`, `isInclineSolved`, `solveIncline`, `inclineNextMove`, `inclineHint`, `describeInclineResult`, `inclineParts`, `inclinePartNames`, `INCLINE_SEARCH_LIMIT` and typed level/state/move/result structures.
- `src/games/buoyancyLogic.ts`: `buoyancyLevels`, `buoyancySolutions`, `verifyBuoyancyLevel`, `createBuoyancyState`, `validBuoyancyBoard`, `evaluateBuoyancy`, `moveBuoyancy`, `undoBuoyancy`, `isBuoyancySolved`, `solveBuoyancy`, `buoyancyNextMove`, `buoyancyHint`, `describeBuoyancyResult`, `BUOYANCY_SEARCH_LIMIT` and typed level/state/move/result structures.
- `src/games/motionPhysicsRational.ts`: exact `PhysicsRatio`, normalization/formatting/comparison helpers. Comparison uses BigInt cross-products; display conversion never decides wins.
- `src/games/motionPhysicsGames.css`: scoped `.mp-game` styling, imported by both games.
- `tests/motionPhysicsGames.test.tsx`: independent certificates, physics, immutable engines, bounded current-state hints and semantic component interaction tests.

Both games have 12 zero-indexed levels, use the existing `GameProps` contract and remount only on level/reset-token changes. Completion requires an explicit test launch and notifies once per level/reset even with StrictMode, undo/replay and repeated tokens. Paused tokens are consumed without replay. Changing the plan returns it to the workbench; undo restores both settings and prior test state.

## InclineLab model and certificates

The cart is explicitly an ideal sliding block released from rest. It has no wheel rotation, impact loss, drag or spring. A smooth ramp-to-floor transition is assumed. Static and kinetic friction coefficients are equal and constant.

For height `h` and ramp horizontal projection `L` in cm, coefficients stored as integer hundredths `r` and `b`:

- Starts only if `100h > rL`.
- Remaining kinetic energy divided by `mg`, in cm: `(100h − rL)/100`.
- Stop position past the ramp foot, in cm: `(100h − rL)/b`.
- Target interval is inclusive, compared exactly. Final four levels require exact fractional/integer positions.

Each level contains `certificate: {height, rampFriction, brakeFriction}`. `inclineSolutions` is an executable sequence of legal choices plus release. The independent test oracle recomputes friction work and cross-multiplies the target bounds, then checks energy conservation. Early lessons isolate one parameter, intermediate lessons combine two, and later lessons combine all three with non-starting configurations and exact targets.

Search enumerates complete allowed configurations, preferring fewest changes from the actual current plan. Hard supported domain is at most 8 choices per variable (512 configurations); published levels have at most 216. Default cap is 512; smaller caller budgets return `exhausted: true` rather than claiming impossibility. Geometry and coefficient bounds keep all integer products safe.

## BuoyancyDock model and certificates

Rigidly joined sealed rectangular pontoons have a common height, upright orientation and horizontal waterline. Waterplane areas and hull masses add. Every selected cargo item contributes mass. Static vertical equilibrium only: no waves, tilt, leakage, hydrodynamics or stability simulation. Chinese UI explicitly says this is unsuitable for real vessel design.

With total mass `M` grams, liquid density `rho` kg/m³ and area `A` dm²:

- Required displaced volume, liters: `M/rho`.
- Equilibrium draft, mm: `100M/(rho A)`.
- Effective average density based on hull volume: `100M/(A H)` kg/m³.
- Draft greater than hull height means insufficient displacement and sinking. Equal draft means fully submerged with zero freeboard, a separately explained failure. Success requires draft strictly less than height, all mandatory cargo, legal hull count and exact target draft.

`displacedL` is REQUIRED displacement. When sunk, the UI clarifies the vessel cannot supply it; it never calls an impossible displacement an attained state.

Each level has `certificate: {hulls: boolean[], cargo: boolean[]}`. `buoyancySolutions` gives reversible assembly moves and final launch. Independent tests calculate loaded mass, displaced-volume equality and positive freeboard directly. The progression grows from two alternative hulls and one shipment to six hulls, six cargo/ballast items, variable liquid densities, finite slots and fractional draft targets.

Search enumerates at most `2^(6+6) = 4096` complete boards, preferring fewest differences from the current board. The next hint removes unwanted hulls before adding replacements, so a full dock remains recoverable. Lower search caps honestly distinguish incomplete search from no solution.

## Accessible DOM/SVG and selectors

All controls are native buttons, usable with click/touch/Tab/Enter/Space. Selection is expressed with `aria-pressed`; observations use a live status region. There is no drag precision requirement, timed challenge, canvas control or animation. SVG remains the same DOM element across input changes, needs no renderer recreation or GPU cleanup, and reduced-motion styling explicitly suppresses inherited effects.

- Incline choices: `[data-incline-part="height|rampFriction|brakeFriction"][data-value="NUMBER"]`.
- Incline launch/readout: `[data-testid="incline-release"]`, `incline-distance`, `incline-target`.
- Dock choices: `[data-dock-kind="hull|cargo"][data-index="ZERO_BASED_INDEX"]`.
- Dock launch/readout: `[data-testid="buoyancy-launch"]`, `buoyancy-draft`, `buoyancy-target`, `buoyancy-mass`.
- Workbench accessible regions: `斜坡停车实验台`, `浮力配载码头`.

The component suite replays all 24 certificates through DOM buttons and also covers pause, consumed tokens, reset, level change, hints without auto-solving, full slots, keyboard-only completion, idempotent completion, undo/replay and a persistent SVG without WebGL. Browser screenshot/visual QA is intentionally left to integration; this worker did not use a browser or modify registry/App/shared types/global CSS/package files.
