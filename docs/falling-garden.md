# 落块花园
One independent endless falling-block score game. No finite levels or duplicated skins.

Source: Jake Gordon and contributors, javascript-tetris, e5c0c42f7dac0f3514a55eff656c6e22e95d68ed, MIT. Actual bit-mask shape constants and eachblock/occupied/move/lock/removeLines behavior adapted from index.html. Full MIT distributed. Original DOM/CSS/SVG; no texture or stats library reused.

The original removeLines started outside the board and missed row zero. This version checks all 20 rows and compacts simultaneously. Seeded seven-bag sampling replaces the upstream biased bag index; classic in-place rotation deliberately has no wall kicks. Ghost outline, hard drop, visible touch buttons and paused reload are added. Lock gives 10 points; 1/2/3/4 lines gives100/200/400/800. Collision at spawn ends the round; no fabricated finite victory.

Verification is limited to meaningful rule, controls, saved continuation and layout checks. Existing required CI stays unchanged. Independent review and exact public deployment verification are required before release claims.
