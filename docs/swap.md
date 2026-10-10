# Swap: complete original campaign adaptation

Noah Moroze and Michael Yang's Swap, fixed commit a3cfb7d2d59d37dd3778d5de685a206cca4f1206. Upstream code, maps, tips and Canvas primitives remain CC-BY-SA-4.0. Full untouched preferred-form source and 20,132-byte original license are included in vendor/swap-original/upstream. Host adapter contributions are GPL-3.0-only, with attribution and change marking retained under the official one-way GPLv3 compatibility.

## Scope and exact count

All 24 active authored puzzle layouts appear in their original order. Every start coordinate, tile value, dimension and original tip is preserved byte-for-byte inside the exported source literal. The 25th active record is a 21×10 SWAP credits scene with no goal. It renders after the actual final-level win and does not increase the level count. An experimental map commented out upstream stays commented out.

The original first-party engine is embedded in a per-mount lexical scope, rather than replacing it with a grid-move game. Retained behavior includes:

- 30 ticks/second with continuous acceleration, friction, capped velocity and trails at the original 640 logical canvas scale.
- Cyclic possession, preserving the controlled velocity across swaps and the autonomous body's own direction when released.
- All six authored autonomous behaviors: stationary, right-moving, wall-bouncing, velocity-following, left-turning, upward-moving.
- All four collision corners and original wall rollback behavior.
- Any character reaching green wins; any character touching red ends the attempt.
- Pressure plates, matching orange gates, gate occupancy latch, original duplicate-plate scan order.
- Blue barriers block only the controlled character; autonomous characters can pass through.

The host adds a responsive CSS display, Chinese readable controls and translated tips, touch direction holds, stable character markers and plate/gate numbers. It replaces Keypress, canvas dialogue UI and upstream hash navigation. No audio is included because the separately credited track's permission was not established. No old dependency, web font, image, icon pack, external script or telemetry is present.

## Lifecycle and persistence

Every mount owns its original singleton objects inside an instance. Only the React host owns a 30Hz interval. It stops on pause, blur/hidden state, terminal collision or unmount. Window blur requires an explicit resume; all inputs are cancelled on interruption, pointer cancel, focus loss, reset, swap or disposal. Canvas size is 640 logical pixels independent of device width, preserving the original pixel-based hitbox and velocity constants.

Each selected level uses only playgarden.swap.v1.<level> in localStorage. Saves contain the fixed source/version, full actor queue/direction, player inertia/trail, gates/plate latches, tick count and per-level deaths. Restore checks level/version, exact actor type and cyclic queue identities, finite in-bounds positions, bounded motion, original gate and plate coordinates, boolean latches and a real corresponding goal/lava contact for terminal records. Values are copied onto existing constructors; there is no dynamic code deserialization. Inputs always restore released, and the user must explicitly resume. Invalid or unavailable storage safely starts from the original map. Restart preserves this level's death count and resets its original arrangement. The original global death tally is now a clearly labeled per-level tally.

__swapRead is the only test observer. It returns newly allocated data with copied trail arrays; it has no engine reference, movement/reset/win setter, or test-only state injection. The shipped gameplay API is not exported to window.

## Documented code seams and fixes

source-map.json identifies the source sections and changes. The static assembly script wraps original files, introduces stable actor identities, exposes lifecycle/serialization seams, replaces DOM text writing, declares the accidental tile factory global and resets switch arrays at level restart. Out-of-range tile lookups return a blocking wall instead of throwing. The first actual terminal collision stops the rest of that simulation tick. Original movement, switching, gate grouping and scan-order behavior are preserved; the host does not introduce extra goal paths, disabled hazards, extra levels, or fake skip wins.

## Verification boundaries

Author checks: exact original bytes verified against recorded SHA-256, Git blob SHA-1 and sizes; static literal extraction confirms 24 goal maps plus the exact no-goal ending; adapted map suffix equals the original literal apart from export/name; Node syntax-only checks on TS runtime/state/data and E2E source. No engine, unit/proof sweep, upstream install or browser run was performed by this author lane.

The integration owner runs the normal build and the single targeted e2e/swap.spec.ts invocation covering desktop/mobile. Tests use real keyboard/CDP touch input and a detached read-only observer. Browser or final-campaign success must not be claimed until that run and screenshot review pass.
