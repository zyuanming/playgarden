# 重力回廊

Original GPL-3.0-only implementation, eight hand-authored corridor maps, and programmatic SVG. No external copied code, assets, or added packages.

A single token is controlled only by clockwise/counterclockwise 90-degree gravity changes. It falls until supported by a wall or still-locked gate. Passing over a key permanently unlocks all matching gates in that attempt; opening a gate removes a former stopping surface, so key order can matter. All keys are required, and the unlocked exit catches the token immediately. Thorn contact loses the attempt but supports undo. Turning into an adjacent wall still changes orientation. Maps start with downward gravity and a supported token; no invisible startup simulation.

Eight separate layouts vary loops, branch keys, gate ordering, thorns, routes and three-key dependencies. This is distinct from Ice Stops: no selection of multiple sliding pieces, no pieces used as movable brakes, and the action is relative rotation with persistent gravity/key/gate state.

Hints run a bounded current-state BFS (6,000 expanded stable states, larger than the full position/orientation/three-key state bound on these maps). It excludes thorn outcomes and returns a real next rotation or explicitly says the current position has no winning route. No prerecorded hint trace or automatic mutation. All game controls freeze on pause/win; failed attempts allow shell undo. Restart remounts clean state. Win requires current position at exit, all key bits and no loss.

Targeted E2E is authored, not executed by worker. It uses hand-written first/final control routes, not an exhaustive level solver. Coverage includes desktop board arrow keys, actual mobile taps, pause, undo, restart, hint nonmutation, lock after win, error/overflow checks, and screenshots of first/final initial positions plus victory. Release owner runs the one final invocation.
