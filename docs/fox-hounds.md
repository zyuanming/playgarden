# 林间追逐 · Fox and Hounds

Original GPL-3.0-only asymmetric movement engine, six-ply minimax computer, eight starting exercises, UI, Chinese teaching text and SVG artwork. Traditional Fox and Hounds rules are implemented independently; no third-party source or position collection copied.

The human fox moves one unoccupied diagonal square forward or backward. Four computer hounds share one move per round and move upward only. No captures or jumps. The fox must physically reach row eight to win; having passed the hounds does not silently award success. A blocked fox loses. Hounds with no moves pass. After forty rounds the session ends without awarding a win.

Current-position hints and the opponent both use a documented bounded six-ply search. Undo restores both participants' last round; pause blocks all controls and shortcuts; restart restores the exercise; victories lock permanently until restart. The visual board has a full accessible state description and the actual four diagonal controls are large touch buttons. Q/E/Z/C are additional keyboard controls.

Targeted browser spec e2e/fox-hounds.spec.ts covers first/final real escapes, local AI, touch and keyboard, pause, whole-round undo/reset, terminal lock, screenshots, console errors and overflow. Contributor did not run browser or unit suites.
