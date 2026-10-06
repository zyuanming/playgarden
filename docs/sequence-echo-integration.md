# Sequence & Echo integration notes

Original GPL-3.0-only games with locally authored levels and CSS visuals. Both use the existing game-shell contract and require no external assets, audio, or extra dependencies.

## Entry points

- `src/games/MemoryRoutes.tsx` default `MemoryRoutes`, 12 levels in `memoryRoutesLevels.ts`.
- `src/games/RhythmEcho.tsx` default `RhythmEcho`, 12 levels in `rhythmEchoLevels.ts`.
- Both accept the existing `GameProps`; key by `level:resetToken` to cancel old rounds. Both issue `onComplete` once and lock every mutation after winning. A Shell reset/new level opens a fresh round.
- Hint and undo tokens are consumed while paused without applying on resume. Hints identify the next step or first mismatch; undo removes the last entry. Neither game registers document key listeners. A stable labeled host receives focus with `preventScroll` only when the focused internal control is removed, hidden, or disabled by a round transition. Keyed reset/level changes and paused/completed/full-input states are covered. Focused Shell controls remain untouched.

## Suggested catalog copy

MemoryRoutes / 路线记忆: “看一段花园路线，藏起后按顺序重走。记住转弯，也记住回访。” Theme: observation/memory. Distinct from pair-matching MemoryGarden.

RhythmEcho / 节奏回声: “读懂小节的重复与变换，用不计时的间隔卡或可选敲击回应。” Theme: patterns/rhythm. Both modes are equally valid. Sound is never required or emitted.

## Public E2E controls

Memory:

- `[data-memory-routes-game]`: attributes `data-memory-routes-phase` (`observe`, `recall`, `complete`), `data-memory-routes-won`, `data-memory-routes-entered` (comma-separated cell indices).
- `[data-memory-routes-ready]`: explicit observation-to-recall transition.
- `[data-memory-routes-cell="0"]`: select row-major cell. During observation/completion, `data-memory-routes-steps` shows its 1-based visit indices. In recall/paused it is empty; hidden answers are not rendered.
- `[data-memory-routes-replay]`: return to observation, preserving selected entries.
- `memoryRoutesSolutions.ts` exports independent `memoryRoutesSolutions` arrays only for test/E2E consumers; runtime never imports them. Public source-of-truth is start + authored compass walk.
- Smoke: open, assert observed station labels, Ready, enter first station, undo, replay, Ready, finish known certificate; assert won and immutability. Mobile late level 12 checks multiple visit labels fit.

Rhythm:

- `[data-rhythm-echo-game]`: `data-rhythm-echo-phase`, `data-rhythm-echo-mode` (`tokens`/`live`), `data-rhythm-echo-won`, `data-rhythm-echo-entered`, `data-rhythm-echo-playhead` (`idle` or 0-based beat number).
- `[data-rhythm-echo-ready]`, `[data-rhythm-echo-replay]`: hide/show full phrase; replay preserves entered intervals. Public motif/transform task card remains visible in both phases.
- `[data-rhythm-echo-score="0"]`: visible-only interval tile, `data-rhythm-echo-interval` gives its 1/2/3 cell duration.
- `[data-rhythm-echo-token="1"]`: default untimed input; exact values 1/2/3. There is no response deadline.
- `[data-rhythm-echo-mode-button="live"]` / `tokens`: switch mode, visibly documented to clear current response.
- `[data-rhythm-echo-tap]`: first tap anchors time; each following tap records one interval in milliseconds. 1 cell = 1000 ms; inclusive tolerances are ±450/700/1050 ms. Pause/tab visibility loss/undo/replay cancels the unfinished interval, keeping earlier intervals. After returning, first tap is a new anchor.
- `[data-rhythm-echo-play]`: optional no-audio visual preview; tap again stops. One timeout at a time; pause or tab visibility loss retains remaining interval; Ready/reset/level/unmount clear it. Reduced motion has no animation; beat changes are static highlights/text.
- `rhythmEchoSolutions.ts` exports independent `rhythmEchoSolutions` arrays only for test/E2E. Runtime target derives solely from public motif + transformation list.
- Smoke: default tokens, optional preview start/pause/resume/stop, Ready, first token, undo, replay, Ready, finish known certificate; verify completion locks modes/hints/undo. Separate live smoke may use clock mocking but never require wall-time precision in browser CI.

## Focused verification

`NODE_OPTIONS=--max-old-space-size=384 npx vitest run tests/memoryRoutes.test.tsx tests/rhythmEcho.test.tsx --maxWorkers=1`

`NODE_OPTIONS=--max-old-space-size=768 npx tsc -b`

Tests include independently interpreted coordinate/grammar oracles, separately authored certificate corruption resistance, exact wrong-answer rejection, inclusive live timing boundaries, every authored level completed through DOM, paused token consumption, completed immutability, Shell focus preservation, modified-key passthrough, and wrong-live-tap undo/recovery, and fake-clock pause/tab-visibility/reset/unmount cancellation.
