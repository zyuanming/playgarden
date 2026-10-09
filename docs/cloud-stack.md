# 云端叠楼

Original GPL-3.0-only real-time overlap stacking game, eight original finite settings, interface and procedural SVG graphics. No third-party game code, assets or audio are included.

A moving slab oscillates above the current top floor. The player explicitly drops it. Only the mathematical horizontal intersection remains; less than eight world units of support fails the attempt. Subsequent slabs have exactly that remaining width. There is no center snapping, auto-correction or perfect-drop bonus. Building the requested number of actual supported floors wins.

Eight lessons vary target height, foundation width and speed, introducing cumulative precision and alternating entry direction. Pause cancels animation and resumes with a fresh timestamp, so no hidden catch-up occurs. Restart remounts the whole attempt. Real-time moves cannot be undone; registry allowUndo is false. Hints explain the current support interval without freezing time or placing a slab. Space on the focused game or native touch buttons controls the drop; modifiers and repeat events are ignored.

One targeted desktop/mobile E2E journey observes live positions and presses real drop controls for first/final towers. It checks pause freeze, restart, disabled undo, terminal lock, runtime errors, screenshots and page width. It never assigns state, substitutes an automatic victory or calls the game engine to win.
