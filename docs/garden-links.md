# 花径连连看

Original GPL-3.0-only two-turn matching game, eight authored boards and SVG artwork. No upstream game code, commercial assets or copied level collection.

Two equal tiles may be removed only if a path joins their centers using orthogonal empty cells and at most two direction changes. One empty cell of margin surrounds the board and is available for routing. Remaining tiles stay fixed. This differs from layered Mahjong solitaire: freedom is determined by an actual bounded-turn route, not exposed sides or upper covers.

The path finder tracks direction and turn count, refuses occupied intermediate squares and renders the actual route. Current-state hints use bounded search for a complete removal plan, distinguish an exhausted search budget from impossible states and never remove tiles. Eight different layouts progress from eight tiles to a framed thirty-six-tile garden. No rotated board copies are counted.

Pause/win lock all tile controls. Undo returns the last pair; reset restores the exact layout. Keyboard Tab/Enter and native taps select endpoints. The targeted final E2E follows visible hints through real controls but independently checks route adjacency, empty intermediate squares, equal endpoint symbols and no more than two turns before each removal. No unit or exhaustive campaign suite is run.
