# 故事排序

Original GPL-3.0-only implementation, Chinese prose, eight stories, feedback, and SVG. No copied stories, external assets, or dependencies.

Eight authored causal/temporal narratives contain four to seven sentences each. The player selects a strip and moves it one position, using touch controls or native buttons and keyboard arrows. Every story supplies a total chain of explicit prerequisites and a separate explanation for each. Review reports the current satisfied relationship count and an actual violated dependency; it does not mark only a vague wrong answer. Victory checks a valid, complete exact ordering, equivalent to all declared chain links holding.

Hints inspect the current permutation, find the first displaced sentence, and explain its correct position. They do not mutate state or use a stale startup route. Pause and win lock selection, moves, review, hint, and undo. Restart is a fresh keyed round; undo restores the previous permutation.

Stories concern planting, rain preparation, returning a library book, kite repair, paper-bridge experiments, a postcard, shadow theatre, and a waterwheel. They are separate original narrative puzzles, never rotations of a board or duplicate levels.

Targeted E2E authored, not run by worker: first and final genuine wins; desktop keyboard/mobile tap controls; meaningful review; nonmutating current-state hint; pause, undo, restart; disabled win controls; starting and victory screenshots, page errors, and overflow. Final invocation belongs to release owner.
