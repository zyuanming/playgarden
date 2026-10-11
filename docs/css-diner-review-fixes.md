# Lifecycle review corrections — revision 2

Prepared 2026-10-10 after independent static review. These are source corrections and future E2E assertions, not executed browser evidence. Source identity remains CSS Diner `566aaa01314caddc7a9034d793250cf2b8f12a4e`, exactly 32 original puzzles, with the same covered-source licensing and exact original matching core.

## R1: restored ending retains initialized native UI

Restoring the saved final ending now calls the original `loadLevel()` before rendering `ending()`. The loader cancels the initial 50 ms startup task and initializes the final `level`, menu/current/ARIA markers, progress bar, heading, objective, HTML and Chinese/original English help. The subsequent ending cancels the loader's 200 ms highlight task. Restoration emits no `complete` event. The E2E now checks every named UI region and captures the restored native ending/help on both existing projects.

## R2: preserve validated work crossing a host pause

A bounded host mailbox stores at most one earned completion and one native destination for its keyed iframe session/current level. It is populated only after the existing source-window/opaque-origin/session checks. Completion additionally requires the real checker's saved correct mark; navigation additionally carries and checks `fromLevel`. Paused deliveries remain queued.

Resume flushes completion first, using the original level's callback and the existing single-award guard, then requests navigation. Sending a destination is guarded against duplicates. The queue is retained during synchronous React effect replay and cleared on real unmount by the existing epoch-guarded disposal microtask; inactive or different-level/session work cannot flush. Native navigation with no host callback receives an explicit denial and can return to normal controls.

The E2E now operates the actual shell pause/resume controls immediately around real selector submission, numeric/menu navigation and native next-level delay. It repeats pause/resume, asserts earned shared history plus an operable destination, and exits while paused with a real pending transition before reopening an unearned different puzzle. It never fabricates a completion/message, changes clocks, or writes engine/progress flags. Browser message interleavings remain browser-scheduled; static review establishes mailbox ordering, while the future targeted run supplies real interaction evidence.

## R3: distinguish earned history from the final puzzle's current view

`earnedEnding` remains the durable historical milestone. A separately validated `finalEnding` retains whether the final puzzle was last left at its ending or in an active retry. The current iframe's `ending` flag continues to describe only the currently displayed screen. Loading/retrying puzzle 32 clears `finalEnding`; solving it sets both final flags; visiting other puzzles preserves that final-puzzle view. Full reset clears both. Older states migrate a saved actual final ending only when the saved current level is 31 and its ending flag is true.

Restoration uses `finalEnding`, not the historical milestone alone. A saved final retry therefore reopens the original board/editor and draft, even after the ending was previously earned. The E2E earns the ending normally, retries, types a new selector draft, exits and reenters, checks the playing screen/draft and retained earned history, then returns to the ending by another real correct submission.

The host/bridge resource revision is now `css-diner-566aaa0-playgarden-2`. The independent reviewer must re-review these changes and refreshed artifact hashes before parent integration/runtime validation.
