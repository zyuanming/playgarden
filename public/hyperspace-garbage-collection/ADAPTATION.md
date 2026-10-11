# Playgarden adaptation of Hyperspace Garbage Collection

Pinned original: razh/game-off-2013 at f5b93cbb57f653be4455f9dd5c130463b11abe2a.
Original title is also listed as Hyperspace Garbage Collector in discovery lists.

The four authored maps are byte-for-byte unchanged. Their four scripts retain
all 102 wall polygons, 12 lasers, 7 emitters, 3 tractor beams, 6 capture triggers,
4 exit doors and original numerical settings. The original ending remains a
separate uncounted scene. No custom level, health, death or invented scoring is
added. Particles still expire, replenish, annihilate against opposite matter,
collide with like matter, respond to tractor beams and matching lasers, and
activate only matching capture triggers. The original Box2D and procedural
Canvas renderer are used directly. The original ending is shown only after
physically passing the final open-door condition.

The source publication boundary is the pre-cleared 64-file source subset. Its
SHA-256 allowlist is retained in vendor/hyperspace-garbage-collection-original/
input-publication-manifest.json. No excluded color-helper bytes, MP3, screenshot,
editor, external font or development dependency has been included. The prior
legal derivations are explained in PLAYGARDEN-CHANGES.md.

## GPL-3.0-only Playgarden additions and changes

- The React shell, responsive controls, procedural SVG cover, scheduler, source
  tooling, CI journey and standalone iframe adapter are authored additions.
- The iframe uses only allow-scripts, with an opaque origin. The bridge validates
  the source window, exact parent origin, source name and per-mount session.
  Retired frame messages cannot navigate or complete a replacement round.
- Game.update receives a fixed 1/60-second step. One adapter RAF accumulator
  advances physics, lifetimes, emitter cadence, animations and the game clock
  together. Catch-up is capped after a stalled frame. No upstream timer is
  globally replaced: RequireJS retains native bootstrap timers.
- All original gameplay timeout/interval sites are explicitly routed to the
  scheduler: emitter start/stop, material/movement instruction polling, the
  temporary hit face, and the original 200 ms exit delay. Pause, active-frame
  blur, hidden documents and disposal freeze or invalidate these callbacks.
- The unused title/settings views and old main entry are not executed. The
  title-only orientation listener and misspelled mousemove cleanup therefore
  do not exist in the live runtime. Their cleared sources remain in the archive.
- Keyboard and captured Pointer Events preserve the original analog joystick
  and add accessible hold-direction controls. Independent pointer IDs allow
  steering and the material button simultaneously. Inputs clear on blur,
  pointer/touch cancellation, hidden document, reset, pagehide and disposal.
  Canvas coordinates derive from getBoundingClientRect, not page offsets.
- Level/reset host boundaries are fresh keyed iframes. A local retry clears the
  scheduler, old entity references, removal queue, input, player velocity,
  angular velocity, emotion and material. Levels start in antimatter, as in the
  original title start and intended stage-2 setup. Stage 2's incorrect
  game.material assignment is corrected to game.player.material. Background
  settings and camera position reset; the final scene cannot leak into replay.
- The original Door capture/coordinate snap and delayed callback remain. Its
  next-stage invocation is routed through the host navigation boundary, with a
  visible earned-next button. The final callback still invokes original
  level-end.js. Only that original door callback can produce completion.
- Duplicate pending removals cannot destroy a body twice. A capture rejects a
  stale, already removed or expired body reference, preserving live-capture
  intent instead of crediting a destroyed particle.
- The four original JSON strings are wrapped as local AMD data modules, avoiding
  XHR from an opaque origin. No user map import or text execution is exposed.
  RequireJS's dormant eval hook throws explicitly. CSP has neither unsafe-eval
  nor remote resources; connect-src is none. Original text-plugin sources and
  grants remain in the corresponding-source archive but the plugin is not loaded.
- The old unguarded debug/localStorage jump is absent. Only the host persists
  verified completed-level numbers and final-ending history under
  playgarden.hyperspace-garbage-collection.v1.state. It does not claim a physics
  world resume. The read-only observation function returns JSON copies and
  exposes no body reference, stepping, key mutation or completion function.

Build/reproduction: run scripts/hyperspace-garbage-collection/adapt.py, then
package-source.py; verify-sources.py checks the resulting byte-level package.
The upstream game/build scripts and installers are not needed or executed.

Browser/E2E execution is pending normal CI. Static checks do not establish
playability or visual quality. The single targeted spec uses real keyboard,
pointer and touchscreen input, original wall observations for navigation, and
captured matching debris for first/middle/final objectives; it never writes
body positions, velocities, materials, trigger state or progress to win.
