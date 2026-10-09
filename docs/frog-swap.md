# 青蛙换岸

Original GPL-3.0-only logic, nine lesson configurations, frog drawings and cover SVG. No external assets or source. Implements the generic Toads and Frogs interchange puzzle, distinct from the existing action-based Frog Crossing and peg-removal solitaire: jumps never remove another frog.

Green frogs move toward increasing stone numbers; gold frogs move toward decreasing numbers. A frog can step into an adjacent empty stone, or jump exactly one opposite-color frog into the empty stone beyond. It cannot reverse, jump a same-color frog, cross an empty stone or remove pieces. The exact goal puts all gold frogs at the beginning, every empty space centrally, and every green frog at the end.

Nine distinct populations progress through 1/1, 2/1, 2/2, 3/2, 3/3 with two empty spaces, 3/3 with one space, 4/3, 4/4, and 5/4. The extra-space lesson teaches different branching, followed by a tighter six-frog crossing. Counts and asymmetry change the state graph; no rotated copies are counted.

Stones wrap in groups of five with explicit continuous numbering; this keeps all touch targets visible without horizontal page overflow. Two-stage selection highlights legal landing sites. Current-state memoized search supplies hints and detects dead ends. Undo restores one move, restart restores the opening, and pause/victory lock controls. Every frog remains visible and counted after jumping.

The supplied independent BFS browser journey genuinely solves first and final lessons on both configured desktop and touch projects, with pause, restart, undo, hint and screenshots. Contributor ran no browser or unit suite; integration owns the single final targeted invocation.
