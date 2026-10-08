# Signpost source and adaptation

Fresh base: main 6c7161fe42efbd69728c739b072dcd76c9079698, tree 4c3de16589d2de064f8bdf5f3e1e64ff37d2128c. All93 registered games inspected; no existing arrow-ray numeric-chain module. No AGENTS.md or repository-local skills are present in this tree.

Fixed upstream: https://github.com/chrisboyle/sgtpuzzles/blob/d1e10eb57dd80af4999e698a9ab31f546e9a0b9d/app/src/main/jni/signpost.c

The full unchanged MIT C source and repository LICENCE are vendored with SHA256 and Git blob identities. No upstream code is executed at generation or build time.

- `whichdir` / `ispointing`: eight-direction geometry, self-exclusion, terminal exclusion and unbounded ray traversal, ported into `pointsTo`.
- `isvalidmove` and connected-number rules: no cycles, one predecessor/successor and consecutive numeric values. Our array-chain traversal replaces the upstream DSF representation. Numeric anchor offsets and duplicate-number checks enforce the same underlying sequence constraints.
- `check_completion`: require all numbers exactly once with correct ray successors. This adaptation requires all n−1 links explicitly entered; it does not silently create upstream auto-links between already numbered cells.
- Deliberate UI difference: replacing an occupied link requires an explicit disconnect; never silently erase the player's previous edge.

Original additions: deterministic finite campaign, current-state bounded DFS hints, validated browser history, accessible DOM interaction, relative-chain presentation and original SVG navigation artwork. No upstream Android UI/media, sounds, fonts, network code or level generator is included. These are original Playgarden levels, not an upstream level collection.
