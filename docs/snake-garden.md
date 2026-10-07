# 贪吃蛇花园

One independent score game, with zero finite levels. The existing level total remains 2071; the game count becomes 88. Move continuously, eat fruit, grow by one cell, and avoid walls or the occupied body. Entering the just-vacated tail cell is legal. Filling the board is a genuine internal terminal success; no fake level-completion counter is created.

Actual adaptation: Patrick Gillespie's MIT JavaScript-Snake at 7c80eddde2de6af669e6ae5133ba8ae60a8d7fb9, `src/js/snake.js` setDirection/go/eatFood. Preserves clockwise direction numbers and tail-vacancy/growth semantics. Replaces mutable DOM-linked segments with immutable cell arrays, validates a two-turn queue against its last queued direction, and chooses fruit from a finite list of empty cells instead of retrying random coordinates. Full original notice retained; no upstream artwork, third-party z-index code or global DOM runtime imported.

Arrow/WASD keys, swipe, and visible direction buttons are supported. Pause, visibility loss and window blur stop movement; returning to a saved active board requires explicit continue. Clearing queued input on pause avoids surprise turns. Restart keeps the separate best score. Invalid saves are rejected; a storage error leaves gameplay usable with a visible warning. Reduced motion disables segment interpolation; short landscape uses a side-by-side court and controls.

Verification is intentionally focused: direction queue/reversal, tail/body/wall/food terminal rules, malformed saves and best-score preservation, lifecycle interruption, and two genuine browser journeys for eating/reload/loss/restart and touch/landscape. Existing required repository CI remains intact; no large randomized oracle or new framework is added.
