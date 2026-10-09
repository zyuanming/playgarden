# 骨牌接龙

Original GPL-3.0-only code, eight pip multisets and authored SVG cover. No copied third-party code or assets. Generic double-ended domino chaining differs from one-stroke graph tracing: the player selects and orients physical tiles at either open endpoint around a fixed starting tile.

Select a rack tile then one end of the chain. The tile automatically reverses if necessary. Its touching half must match that endpoint. Invalid choices do not mutate anything. All tiles, including doubles, must be used exactly once, and every adjacent pair must match. The win predicate verifies these conditions independently of move count.

Eight finite lessons introduce a short path, both endpoints, doubles, cycles, branches, interacting cycles and mixed final chains. Tile sets come from distinct authored pip walks with a seed tile inside the walk, so every lesson has a constructive solution. Arrangement and orientation in the rack are separate from the solution.

The live-state hint search memoizes remaining tile identities and the two open endpoints, and suggests a step from a complete remaining chain. Undo restores the previous chain and rack; restart restores the fixed seed. Pause and win lock actions. All buttons are native keyboard/touch controls, pips have text alternatives, and the chain wraps without horizontal overflow.

The integration owner runs one targeted browser invocation using the supplied E2E. No contributor unit or browser runs.
