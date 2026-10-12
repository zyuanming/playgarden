# Ghosted targeted E2E preparation

Status: prepared from static source. No browser, adapter, game engine, upstream converter, upstream build script, or upstream package code was executed. No runtime PASS is claimed. All 13 traces are candidate inputs, and the E2E must independently earn the result.

## Integration artifacts

- Copy `ghosted.spec.ts` to the integration repository's `e2e/ghosted.spec.ts`.
- Copy `fixtures/ghosted-input-traces.json` to `e2e/fixtures/ghosted-input-traces.json`.
- Existing `e2e/helpers.ts` supplies only `captureErrors`; it has not been changed.
- Keep `INPUT-TRACE-SOURCES.md`, `plan-inputs.py`, and `planned-traces/*.json` as preparation/provenance evidence if desired. None is needed by the live app.
- The integration owner must typecheck/review these files before the single authorized targeted invocation: `npm run test:e2e -- e2e/ghosted.spec.ts`.

The current test additionally simulates one blocked local bridge request and throws only on native-key storage writes after the genuine stage-1 save/reload. It never injects completion, board or clock state. The test reads `window.__ghostedSnapshot()` inside the same-origin iframe titled `Ghosted 原版游戏`. It never invokes game-state mutators, writes completed flags, injects progress, changes game time, or dispatches completion events. The permitted environment fault changes only Storage.setItem failure behavior for the isolated native key. Desktop uses the original keyboard handler after a real iframe click. Mobile uses actual CDP touchStart/touchEnd/touchCancel input on the visible host controls. Every candidate directional input is checked against copied live player, turn count, remaining coins, bottom tiles, rock locations, and the read-only ready/cleared state.

The fresh Playwright context must begin with no existing progress. The catalog's searchable title/category/subtitle must contain `Ghosted`. The host contract is `.ghosted-host [data-ghosted-key="ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Enter|Escape|KeyR|KeyZ"]`. The inherited shell uses the existing Chinese pause/resume/lobby labels. No hash route is assumed.

## Required journey

One test, run by the existing desktop and mobile projects, covers:

1. The native initial key gate, animated title, START GAME, visible control guide and native 4×3 menu. A host level-13 selection is used only for a negative check: all flags stay false and it returns to the original menu rather than entering nightmare.
2. A genuine move, native and host undo/retry, native pause menu, and host frame freeze/resume. During the original intro's scheduled sound, host mute must leave zero active samples and zero master gain; unmute restores the gain. Audio context state is recorded separately because browser output can be suspended, and this test does not measure acoustic audibility.
3. Mobile touch cancellation with no continuing held move, a fresh input afterward, 320px screenshot and overflow check.
4. Leaving an active board, iframe detachment, stable saved progress after leaving and a clean re-entry.
5. The 12 distinct original prerequisites through physical moves and native menu selection. The host selector is never used to finish campaign stages. Each actual clear must add exactly its own zero-based index to `playgarden.progress.v2` → `completed.ghosted`; stage 13 receives platform credit only at the real ending. There is no level-13 link or state injection.
6. Reload during level 2 after earning level 1: earned completion remains, while the unfinished board restarts at its original state, matching upstream persistence.
7. The original automatic level-13 transition only after all 12 flags were earned, the real zero-coin final clear, and the native THANK YOU FOR PLAYING ending.
8. Ending-to-title with all 13 actually earned in-memory flags, then real exit/re-entry recovering only the genuinely persisted stage-1 flag, final iframe cleanup, console and external-origin request checks.

Screenshots are produced for title, guide, menu, original pause, the first board, each earned clear, nightmare entry, ending, and the narrow mobile view. The integration owner must actually inspect the mobile images before acceptance. The test attaches the completed live journeys even when a later step fails.

## Bounded offline preparation

`plan-inputs.py` is newly authored independent planning code. It only reads the literal JSON array in `original/src/leveldata.ts`. It does not import, transpile, evaluate or run either the original or adapted engine. Search stopped at the first candidate solution; no shortest-path or exhaustive-solvability claim is made.

The first three boards had bounds of 100,000 expanded states / 12 seconds each. Boards 4–13 had initial bounds of 250,000 / 20 seconds each. Only board 10 needed one extension, to 600,000 / 20 seconds; it produced a candidate at 432,797 expanded states in 10.673 seconds. The 13 final candidate paths contain 428 directional inputs. All paths are statically planned, not gameplay evidence.

The model follows the visible source rules for manual movement, one human turn per non-conveyor move, ghost slime trails, breakaway tiles, rock/hole interactions, gates, conveyor direction changes, apples and ghost-only coin collection. It collapses animation into settled movement batches and rejects ambiguous simultaneous target collisions rather than guessing object ordering. Real frame ordering and input delivery are deliberately validated by the future E2E. Any candidate/runtime mismatch is a genuine unresolved discrepancy and must be investigated; it must not be covered by changing live state or relaxing earned-progression assertions.
