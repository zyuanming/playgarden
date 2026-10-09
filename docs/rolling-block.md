# 翻滚石桥

Original GPL-3.0-only TypeScript logic, React/CSS UI, eight route-authored bridge layouts, Chinese text and original SVG artwork. No third-party code or levels were copied. The public cuboid-rolling puzzle concept is implemented independently.

A 1×1×2 cuboid has upright, horizontally lying and vertically lying poses. Every occupied tile must be supported; thin tiles reject upright poses; only an upright pose on the goal wins. Invalid rolls explain the obstruction without moving. Eight distinct bridge footprints introduce straight bridges, corners, sideways movement, fragile surfaces, switchbacks and long compound routes; layouts are not rotations of one another.

Hints perform BFS from the actual current pose over all legal orientation-aware states. Undo returns one legal step, restart restores the initial pose, pause blocks buttons and keys, and victory locks the game. The board is decorative, with four accessible 56-pixel direction controls and keyboard arrows/WASD.

Browser spec: e2e/rolling-block.spec.ts, actual first/final solutions, pause, undo, reset, keyboard play, locked victory, screenshots, errors and overflow. Written but not executed by the contributor; integration runs the required single targeted invocation.
