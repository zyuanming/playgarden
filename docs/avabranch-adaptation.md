# Avabranch complete original adaptation

Game 174 proposal: `avabranch`, 四线分流, `levelCount: 0`, `endless: true`.
Original: Zolmeister/avabranch at
`4ab326b4a24d796328963da35c0d8d193d728496`, MIT (2013 Zolmeister).

## Source-list chain

The permitted primary list
https://github.com/bobeff/open-source-games/blob/3a9ab8fc892a2cdadf8989a72ba7624a11e39cec/README.md
links the two allowed secondary lists. Both independently list this game:

- https://github.com/leereilly/games/blob/c67976ddcf6f7aef26dc3884116205ab9ef40f74/README.md
- https://github.com/michelpereira/awesome-open-source-games/blob/411c9aeb75c869b7c6f37059018e5f053feb2855/README.md

Source: https://github.com/Zolmeister/avabranch/tree/4ab326b4a24d796328963da35c0d8d193d728496

The handoff's approved silent baseline was 12 files / 26,844 bytes, source ZIP
11,231 bytes, SHA-256
`5120e30ffcf38efc9e2e09053d4eafb6990744e89d13d20d4254e2efde3fc171`.
Only that runtime and explicitly permitted first-party upstream files were
used. None of the private reference tree was copied into runtime, vendor or
corresponding source.

## Exact core boundary and changes

The silent baseline had eight byte-identical game scripts and a main.js edited
only to remove third-party audio. Final integration has these explicit deltas:

| File | Final relationship | Rules preserved |
| --- | --- | --- |
| js/player.js | Byte-identical original | Four lives, initial red/yellow, grouping, independent keys, mean merge, 20-frame target animation |
| js/line.js | Byte-identical original | Trail renderer, motion, square/round overlap, boundary death, color revival |
| js/blocks.js | Byte-identical original | Original random rectangles, level-based spawn threshold and scroll speed |
| js/util.js | Byte-identical original | Original collision helpers, including original bounding-box approximation |
| js/powerups.js | Only MIT attribution comment and four setTimeout calls replaced with game.after | Exact four color effects, revival priority, particles and 10,000ms durations |
| js/game.js | Replaces internal RAF with adapter-owned clock; adds game-time deferred effects | Original speed, 10-second difficulty/pickup progression, object order, draw/physics loop |
| js/hud.js | Chinese text, host-owned best, remove duplicated keyboard/visibility bindings | Exact living-line multiplier, branch multiplier and Math.ceil frame scoring; game-over condition and Canvas rendering |
| js/main.js | Retains init/start object construction; removes global handlers/old RAF; declares globals | Same Canvas 800×600, same object graph and startup order; adapter starts it after handshake |
| js/controls.js | New GPL safe DOM form instead of stored innerHTML | Original A/F group and A/S D/F J/K L/; independent defaults, eight distinct editable keys |

The original nine JavaScript sources are kept verbatim in
`vendor/avabranch-original/upstream/docs/js/`. The approved silent entry/style
and all twelve input files are also retained verbatim in `silent-base/`.
`source-manifest.json` pins byte counts, SHA-256 and original Git-blob SHA-1.
`scripts/avabranch/adapt.py` reproduces all original-derived runtime changes;
`DERIVATION.patch` records them. New control/host/adapter files are standalone
GPL-3.0-only additions, not represented as unchanged upstream.

The original timing was RAF-driven with frame-rounded scoring and per-frame
spawns. This remains so. Newly added lifecycle bounds a stalled single-frame
delta to 100ms; suspended time is discarded. It does not change authored speed,
spawn odds, score formula, effects, difficulty interval or winning conditions.
Effect callbacks now advance only with active game time, keep their original
independent expiry order and target, and are discarded on reset, loss or exit.
No attempt is made to rewrite the original overlapping-effect behavior.

## Lifecycle, storage, input and security

- One RAF belongs to the adapter. Title, pause, hidden state and loss have no
  running simulation. There are no runtime setTimeout/interval game callbacks.
- Host pause and local pause are independent. Local continue cannot overrule
  host pause. Clicking the host pause button may first blur the iframe; that
  incidental blur joins the host pause rather than requiring a second resume.
- Blur, hidden document, reset, pointer cancellation and disposal release held
  input. A direction pointer dragged outside its button releases. Mode toggles
  clear old direction state; keyboard auto-repeat cannot recreate it.
- Each live touch pointer has an independent color/direction. Physical keyboard
  keys are combined with touch holds. Color rows remain at least 44px high and
  show inactive lives; merged touch rows use the same A/F controls as keyboard.
- An opaque sandbox uses allow-scripts only. Both bridge directions authenticate
  WindowProxy, exact per-instance session, origin and source. CSP denies network,
  frames, objects, external fonts/media and form submissions.
- Only `playgarden.avabranch.v1.records` stores `{best,keyMaps}` in the host.
  Scores are nonnegative safe integers; mappings are exactly four two-key rows
  with unique permitted characters, excluding P and global shortcut keys.
  Corrupt/unavailable storage falls back safely. No stored text enters HTML.
- A removed frame may drain already-posted records but cannot update visible
  status or award completion. The next keyed frame waits for this message queue
  to drain. StrictMode cleanup cannot dispose a reclaimed live frame.
- Endless mode never calls onComplete or fabricates campaign results. Returning
  to the lobby removes the frame and its realm. Restart returns to the title;
  the internal restart begins a fresh run while retaining validated records.

## Verification boundary

Exactly one E2E file is supplied: `e2e/avabranch.spec.ts`. Its single desktop/
mobile journey uses ordinary Playwright input and browser-level CDP multi-touch.
The test seed 174 is solely an init-script LCG; runtime randomness is unchanged.
It never assigns game state, scores, lives, positions, pickups, time or loss.
After real group/independent motion and pause checks, the remaining lines wait
for original obstacles to cause natural loss. Screenshots cover title, visible
mobile controls, loss and restored records.

The test asserts two simultaneous touches, pointer move-out, actual touchCancel,
mode-change input clearing, frame-rounded scoring increase, internal and host
pause, frozen full snapshots, loss/restart, safe customized key persistence,
reset, iframe teardown, reload/reentry and no external runtime requests/errors.
It checks mobile canvas plus all four control rows fit within the actual viewport
and that touch targets are at least 44px. Expected snapshots are read-only.

Source preservation verifies four pickup/revival rules and escalating difficulty
are present. The E2E does not guarantee a pickup of every color or observe every
temporary effect/revival interaction; those are not claimed as gameplay passes.
This isolated deliverable has not run a browser, E2E, deployment or screenshots.
Local browser sockets were explicitly unavailable; no bypass was attempted.
The integrator must run the existing build/license checks and exactly one
targeted invocation: `npm run test:e2e -- e2e/avabranch.spec.ts`, then review actual
desktop/mobile screenshots. Full platform build/CI/registry/publication remain
the sole integrator's responsibility.

## Storage write failure

The host loads validated disk records once, then treats accepted current-page memory as authoritative. If a later disk write fails, remounting or entering another level retains the new session record instead of reading stale disk data. A full page reload reads the last successful disk record; no persistence is claimed for rejected writes. The targeted E2E includes a namespace-only quota fault after real saved progress, without injecting gameplay results. Runtime verification remains pending.
