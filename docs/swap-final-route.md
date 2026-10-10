# Swap final puzzle: source-derived physical route

Status: **desktop earned the original final goal in the first physical-input CI run; corrected desktop/mobile journeys await rerun**. This is the source-derived route for original puzzle 24 (array index 23), followed by the authored credits record. The route was initially derived by reading the pinned source without executing an engine, simulation, solver, proof sweep, or upstream dependency. The real browser evidence and remaining validation limits are below.

The adaptation's extra starting pause must be dismissed before this route begins; dismissing that UI pause is not a puzzle phase advance or an earned completion. Use ordinary direction holds/releases and Swap. Observe position, stored autonomous direction, and gate contact instead of assuming fixed frame counts.

## Conventions and sources

- All `(column,row)` cells are **0-based**. A cell waypoint means its safe interior, usually near its center; actor coordinates remain continuous.
- **A** is the body initially controlled at `(9,3)`. **B** is the other body, initially `(10,3)`. These identities stay fixed across swaps.
- Both are left-turn bodies, initially eastbound. An autonomous wall collision turns **east → north → west → south → east**. Manual movement does not change the body's stored autonomous direction.
- Plate `10` opens gate `20`, plate `11` opens `21`, and so on. Repeated plate numbers refer to the same gate.
- Before an important swap, release movement and settle safely when time permits: controlled velocity is shared across swaps in the original source.

Pinned source: `nmoroze/swap` commit `a3cfb7d2d59d37dd3778d5de685a206cca4f1206`.

- [`levels.js:485–506`](https://github.com/nmoroze/swap/blob/a3cfb7d2d59d37dd3778d5de685a206cca4f1206/js/levels.js#L485-L506): final puzzle layout; lines 507–525 contain credits.
- [`ai.js:84–113`](https://github.com/nmoroze/swap/blob/a3cfb7d2d59d37dd3778d5de685a206cca4f1206/js/ai.js#L84-L113): autonomous movement, rollback, and left turns.
- [`player.js:21–32`](https://github.com/nmoroze/swap/blob/a3cfb7d2d59d37dd3778d5de685a206cca4f1206/js/player.js#L21-L32), [`world.js:159–162`](https://github.com/nmoroze/swap/blob/a3cfb7d2d59d37dd3778d5de685a206cca4f1206/js/world.js#L159-L162): swaps preserve body direction and replace controlled position.
- [`tile.js:50–89`](https://github.com/nmoroze/swap/blob/a3cfb7d2d59d37dd3778d5de685a206cca4f1206/js/tile.js#L50-L89): pressure plates and occupied-gate hold-open behavior.
- [`world.js:105–150`](https://github.com/nmoroze/swap/blob/a3cfb7d2d59d37dd3778d5de685a206cca4f1206/js/world.js#L105-L150), [`tile.js:91–97`](https://github.com/nmoroze/swap/blob/a3cfb7d2d59d37dd3778d5de685a206cca4f1206/js/tile.js#L91-L97): player-first updates, collision footprint, and blue barriers that do not block autonomous bodies.

## Route

1. **Control A; admit B across the top.** Move A from `(9,3)` up onto upper plate `10` at `(9,2)` and hold it. B moves east, turns north at the right wall, then west at the top wall. Let B pass gate `20` at `(8,1)` and the blue cells. Swap to B only after its west→south turn against the wall left of `(4,1)`.

2. **Control B; prepare the downward exit.** Center B safely within column 4 if necessary, then guide it down to `(4,3)` and right to `(7,3)`. Its stored direction must remain south. Do not cut diagonally through the red row-2 cells. A, released from `(9,2)` facing east, turns north at `(10,2)`, west at the top, south against closed gate `20`, and eventually east along row 3. If timing does not line up, keep B safely at `(7,3)` and wait for A's next pass over upper plate `11` at `(11,3)`.

3. **Control A; admit B through the right blue area.** Swap to A while it overlaps upper `11`, preferably while still eastbound before its right-wall turn. Hold `11` until B has cleared gate `21` at `(7,4)`. Then guide A up column 11 onto upper plate `12` at `(11,1)`. Keep within column 11: `(12,1)` is lava. Hold `12` until B crosses gate `22` at `(11,8)` and leaves it northward.

4. **Let B enter the lower plate room.** B's autonomous route is east along row 8 → north along column 11 to row 6 → west to column 9 → south to row 11 → east to column 11 → north until blocked by the row-9 wall → west along row 10. It crosses plate `13` at `(5,10)`, which opens gate `23` at `(4,10)`, and enters the lower-left room. Meanwhile move controlled A safely back down to `(11,3)` and settle there. A should still have stored east direction if captured as specified in step 3; stored north also safely reaches the same top route from this position.

5. **Control B on lower `10`; bring A across the top.** Allow B to follow the room perimeter until it is westbound over lower plate `10` at `(2,9)`, then swap to it and hold that plate. Released A turns north at the right wall if needed, then west at the top. Lower `10` opens gate `20` for A. Wait until A crosses the blue top passage and makes its west→south turn at `(4,1)`.

6. **Control A; repeat the exit setup.** Swap to A, retaining its stored south direction. Center it safely in column 4 before moving down; a wall-turn pose may be offset, for example near `x/gridSize = 4.357`, rather than exactly the cell center `4.5`. Guide A via `(4,3)` to `(7,3)`. Released B, westbound from `(2,9)`, safely loops around the lower room: `(1,9)` → `(1,11)` → `(3,11)` → `(3,9)` → `(1,9)`. Wait for a later loop if needed; do not race the first pass.

7. **Control B; send A through the right blue area.** Swap to B while it overlaps lower plate `11` at `(3,11)`, preferably during its eastbound approach. Hold `11` until A clears gate `21`. Move B left along row 11 onto lower plate `12` at `(1,11)` and hold it until A crosses `22` and leaves that gate northward. A follows the same right-blue route described in step 4.

8. **Control A before it enters the lower room.** Swap to A while it is westbound on plate `13` at `(5,10)`, before it crosses gate `23`. Guide A straight down into the safe dead-end floor cell `(5,11)` and settle near its center. Its stored direction remains west. Released B follows the lower room perimeter; an eastbound capture in step 7 makes that loop immediate.

9. **Control B on `15`; launch A toward the final corridor.** When B overlaps plate `15` at `(1,10)`, swap to it, settle on the plate, and hold it. A, released westbound at `(5,11)`, turns south against wall `(4,11)`, east against wall `(5,12)`, then north against wall `(6,11)`. It travels north along column 5 through the blue cells, turns west against wall `(5,4)`, and traverses row 5 toward gate `25` at `(2,5)`.

10. **Release `25` while opening `24`.** As soon as A's collision footprint first overlaps open gate `25`, move controlled B upward from plate `15` onto plate `14` at `(1,9)`. Do not wait for A to reach the left boundary. Gate `25` remains open while A occupies it and recloses after A has fully cleared into `(1,5)`. A turns south at wall `(0,5)`, east at wall `(1,6)`, and then **north against reclosed gate `25`**. Hold B on `14` so gate `24` at `(1,2)` stays open. A travels up the blue column 1 corridor and reaches the goal at `(1,1)`.

## Final timing and validation limits

The essential final move is closing gate `25` behind A; leaving it open sends A east again instead of north. The gate occupancy latch supplies a useful release window. For grid size `G`, A first overlaps `25` on its westward approach when its center is below approximately `3.5G − 5` on the x axis, near normalized x `3.4` at the original scale. Use actual observed overlap as the predicate. Begin B's upward move at this first overlap. A must then travel almost two cells before fully clearing the gate, giving B time to leave `15`. A gate-center-only predicate starts that move unnecessarily late.

The lower room has no lava along the described perimeter, so waiting another orbit is valid. The route does not require swapping into a blue tile, steering a controlled body through a blue barrier, exploiting the commented-out experimental map, skipping a level, or mutating game state.

The [first CI run](https://github.com/zyuanming/playgarden/actions/runs/38051994852) reached `won` on desktop at tick 982 with zero deaths and gate `25` closed. A's center was `(1.4913, 2.3839)` in grid units: its upper collision corners already occupied goal cell `(1,1)`. The original collision box extends `gridSize/2 - 5` pixels from the center. Therefore the ending assertion must check actual corner contact with the goal, rather than require the center to enter row 1. The first run stopped at that overstrict assertion, before finishing the credits/persistence checks.

Mobile failed during the first move onto upper `10`. The touch helper repeatedly scrolled and re-located controls between directional holds, adding 0.2–0.5 seconds to reversals while the puzzle kept ticking. Its braking corrections never settled before B's first southbound capture window; B continued to `(7,3)`, turned north, and hit lava `(7,2)` at tick 111. The touch helper reads visible coordinates before a gesture and sends immediate physical touch transitions. No game timing, movement, AI, gate, lava, or goal rules were changed.

The [second CI run](https://github.com/zyuanming/playgarden/actions/runs/38053155650) exposed two further test problems. Both final journeys received position feedback 3–8 real ticks apart while four traced browsers ran concurrently; the newly introduced settle-first braking prolonged their corrections and both missed B's capture window. That braking experiment has been removed: the helper again uses the exact feedback/friction loop that earned the desktop goal in the first run, including its unchanged 3-pixel settled-position requirement. Tests now run sequentially within each project while retaining all desktop and mobile journeys. The mobile middle trace also showed a full-page screenshot changing `scrollTop` from 594 to 652. The cached left-button coordinate was then 58 pixels too low, so subsequent touches missed the D-pad. Screenshot capture now invalidates the geometry cache before the next gesture.

These trace findings do not establish a passing corrected journey. The affected desktop/mobile E2E must be rerun to verify the input repair, credits rendering, and earned-state persistence. Continuous offsets, acceleration, braking, duplicate-plate update order, and the preserved original gate scan order remain covered by the intended physical-input journey; direction predicates and safe pose checks gate its swaps.
