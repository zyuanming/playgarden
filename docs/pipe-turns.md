# 水管转转

Original GPL-3.0-only implementation, ten independently composed networks and SVG artwork. No upstream source or assets copied.

Rotate existing pieces clockwise. A port must face a reciprocal neighboring port. Every nonempty pipe and every marked flower outlet must connect to the fixed source; any open port blocks victory, including disconnected closed cycles. Rotation never changes the pipe type. Source and rotationally invariant four-way pieces are fixed.

Ten levels teach elbows, detours, tees, four-way joints, longer corridors, multiple branches, cycles, multiple outlets, double loops and a final mixed network. Unlike Pipe Capacity, this is a discrete orientation/connectivity puzzle with no cost, capacity or numeric flow assignment.

Completion validates live reciprocal edges and a flood fill, not equality with the authored solution. Hints calculate the required rotations from the current board toward one valid construction, explicitly described as a possible solution rather than a forced deduction. Reset remounts a clean round; undo restores one entire rotation; pause and victory lock all changes.

Integration: default export `PipeTurns`, level export `pipeTurnsLevels` in `src/games/pipeTurnsLogic.ts`, 10 levels. Targeted browser spec `e2e/pipe-turns.spec.ts` is authored for desktop and mobile; integration owner runs it once. No unit/campaign sweep was run.
