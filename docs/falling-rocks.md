# 落石矿洞

Original GPL-3.0-only implementation, eight authored maps and SVG. No external copied code, assets or dependencies.

Turn-based mining with separate walk and side-dig modes. Walking into soil excavates it and moves the miner; side-dig removes one orthogonally adjacent soil cell while the miner stays still. Rocks cannot be pushed. After each successful walk/dig or explicit wait, a bottom-up snapshot moves each rock at most one cell downward into empty space, crushing the miner if they occupy it. Soil, gems, rock stacks, walls and the exit provide support. Gems are stationary and collected on contact. An exit is successful only after collecting every gem and surviving the gravity phase.

This is not Sokoban: no crate-goal matching or pushing. The core changes the support structure, deliberately drops rocks and then traverses their former cells. Authored maps vary shallow supports, deep shafts, two-stage excavation, falling stacks, vertically separated gems, loops, branches and a final three-gem stacked-rock passage. No rotated/recolored duplicates.

All physics is synchronous per turn. Invalid movement/digging does not advance gravity. Loss still allows undo/restart; pause and victory freeze all game input. Undo restores the exact terrain, remaining gems, miner and rocks, while restart remounts the initial round.

An on-demand current-state BFS is capped at 12,000 expansions. A found hint provides an actual next safe action and total route length, and sets the matching input mode. Exhausted search and budget exhaustion are reported differently, without claiming an unproven dead end. No startup or campaign sweeps.

The unrun targeted E2E uses hand-authored first/final routes with real keyboard/touch controls, checks losing and undoing a dangerous direct excavation, pause, reset, nonmutating hints, post-win lock, browser errors, overflow, first/final starting screenshots and final victory. Release owner runs exactly one final invocation.
