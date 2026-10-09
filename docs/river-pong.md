# 河畔乒乓

Original GPL-3.0-only paddle-and-ball implementation, eight finite rally lessons, UI and procedural SVG. No copied game engine, commercial game artwork or audio.

The player controls the lower paddle by horizontal pointer position, touch or arrow keys. Collision offset determines the outgoing angle. Side walls reflect horizontal motion; crossing a goal line awards a real point. The upper paddle follows the current ball position at a visible level-defined maximum speed. It has no teleportation, input-reading or scripted misses. The target score decides wins/losses. Every point is followed by a player-controlled new serve.

Pause cancels animation and resumes with a fresh timestamp. Pointer changes and keyboard moves are blocked while paused or terminal. Reset clears score and rally; real-time moves cannot be undone. Modifier shortcuts are ignored, arrow repeats intentionally support continuous keyboard travel, and Space repeat cannot issue extra serves. Frame steps are capped to avoid catch-up jumps.

One final targeted E2E journey uses actual mouse/touch control and reads live ball motion to intercept legal returns. It checks first/final real score wins, pause freeze, restart, keyboard, disabled undo, no runtime errors, screenshots and overflow; it never sets scores or game state. No unit suite or exhaustive sweep is run.
