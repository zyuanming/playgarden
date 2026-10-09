# 摆钟节拍 / Pendulum Push

Original GPL-3.0-only rules, nonlinear physics implementation, eight authored lesson settings, Chinese interface, and procedural SVG artwork. No third-party game code, asset, audio, new dependency, hidden win route, or test-only gameplay hook.

## Play

Explicitly start to release the pendulum from −12° with zero angular velocity. While the bob is within the marked bottom-angle window, click/tap the large left/right push buttons, or focus the game and use A/D or the arrow keys. A signed impulse changes angular velocity; it is not an unconditional energy bonus. Opposing the motion can brake, reverse the motion, or even increase kinetic energy if the impulse reverses it strongly enough. The feedback compares actual energy before and after the impulse.

Each passage through the bottom window permits one push. Leaving that window rearms it. If braking traps the whole oscillation within the window, a push is available again after 0.8 simulated seconds, avoiding a low-energy softlock. Modified shortcuts and key repeats are guarded. Native buttons also support Tab / Enter / Space.

The bob must actually cross each target angle while moving outward. Crossing back inward does not ring the bell. As pushes are only possible below every target, and unforced gravity turns the bob inward outside the window, one outward half-swing can only ring each side once. Counts are capped at that side's goal. Both goals win; reaching an actual angle of ±80° loses. Restarts are unlimited.

## Physics and display

- Angle θ and angular velocity ω are the actual state; gravity is 9.81 m/s².
- Equations: dθ/dt = ω; dω/dt = −(g/L) sin θ − damping × ω.
- Each push changes ω by direction × lesson impulse.
- RK4 uses substeps no larger than 1/240 second. A delayed animation frame advances no more than 50 ms.
- The SVG bob is at pivot + (sin θ, cos θ) × drawing length. It is not a canned animation.
- Energy per moment of inertia is ω²/2 + (g/L)(1 − cos θ).
- The live “能量折算摆幅” converts that energy to an undamped peak angle. Text explicitly warns that subsequent damping makes actual peaks lower. This is an estimate, never a promised exact crossing or guaranteed next peak.
- Hints read phase, present energy, and the legal push window. They never apply input.
- Read-only DOM attributes mirror the phase, angle, angular velocity, displayed estimate, time, push availability, and counters for accessibility/debugging and normal-control E2E observation. They do not control the engine.

## Eight lessons

| Lesson     | Target on both sides | Goal per side | Bottom window | Length (m) | Damping (s⁻¹) | Impulse (rad/s) |
| ---------- | -------------------: | ------------: | ------------: | ---------: | ------------: | --------------: |
| 第一声钟   |                  25° |             1 |          ±14° |        2.8 |         0.055 |            0.52 |
| 稍远的钟声 |                  30° |             1 |          ±14° |        3.0 |         0.055 |            0.53 |
| 借回程的力 |                  33° |             1 |          ±13° |        2.7 |         0.055 |            0.55 |
| 四声小曲   |                  35° |             2 |          ±12° |        2.9 |         0.056 |            0.56 |
| 收一点手   |                  38° |             2 |          ±11° |        2.6 |         0.055 |            0.58 |
| 窄窗节拍   |                  40° |             2 |          ±10° |        2.8 |         0.056 |            0.59 |
| 六声回响   |                  42° |             3 |          ±10° |        2.5 |         0.055 |            0.61 |
| 摆钟合奏   |                  45° |             3 |           ±9° |        2.7 |         0.055 |            0.62 |

Target angle, scoring duration, impulse magnitude, natural period, and timing window change across the lessons. The distinct rule is timed signed energy transfer into an autonomous damped oscillator, rather than static lever balance, editing wave coefficients, or controlling a falling craft.

## Lifecycle and verification boundary

Before explicit start, all physics and time remain still. Pause cancels the animation frame; resume creates a fresh timestamp, so paused time is never replayed. Win/loss locks input and freezes motion. Reset remounts clean state, internal loss-retry returns to ready, and unmount cancels the animation frame. `allowUndo: false` matches the real-time model. No persistent round data or storage is used.

One final targeted E2E file is authored for the existing desktop and touch-size projects. It uses actual mouse/tap buttons and ordinary keyboard controls; Playwright's browser clock advances real animation frames. Coverage includes ready freeze, explicit start, modifier/repeat guards, reverse-push braking, one-push gate, low-amplitude rearm, read-only hints, disabled undo, pause/resume with no catch-up, reset, first/final lesson real wins, a genuine over-pushed loss/retry, win lock, unmount, screenshots, minimum button sizes, page errors, and horizontal overflow.

The E2E controller reads the player's current direction and energy estimate, pushes with the observed direction when energy is insufficient, and waits otherwise. It neither imports the engine nor mutates game state or scores. The intentionally over-pushed loss case pushes on every legal passage.

Contributor status: game code and the E2E journey are authored; no unit tests, campaign/proof sweeps, browser session, E2E run, or deployment was performed here. The integration owner owns the one authorized final invocation: `npm run test:e2e -- e2e/pendulum-push.spec.ts`.
