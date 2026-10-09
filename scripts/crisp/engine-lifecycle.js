    // Lifecycle additions stay in this closure, beside the original state.
    let pgRaf = 0, pgPaused = false, pgDisposed = false, pgFrames = 0, pgRuns = 0;
    const pgListeners = [], pgInputResets = [];
    function pgListen(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        pgListeners.push(() => target.removeEventListener(type, listener, options));
    }
    function pgCanInput() { return !pgPaused && !pgDisposed; }
    function pgRelease() {
        pgInputResets.forEach((reset) => reset());
        isDown = isClicked = isReleased = debugIsDown = false;
        isPressed$1 = isJustPressed$1 = isJustReleased$1 = false;
        isKeyPressing = isKeyPressed = isKeyReleased = false;
        isPressed$2 = isJustPressed$2 = isJustReleased$2 = false;
        pressingCode = {}; pressedCode = {}; releasedCode = {};
        if (code) Object.values(code).forEach((value) => {
            value.isPressed = value.isJustPressed = value.isJustReleased = false;
        });
        isPressed = isJustPressed = isJustReleased = false;
    }
    function pgPause(paused) {
        if (pgDisposed) return;
        pgRelease();
        if (pgPaused === paused) return;
        pgPaused = paused;
        cancelAnimationFrame(pgRaf); pgRaf = 0;
        if (!paused) { nextFrameTime = performance.now(); pgRaf = requestAnimationFrame(update$3); }
    }
    function pgRestart() {
        if (pgDisposed) return;
        pgRelease();
        if (isSoundEnabled) sss.stopBgm();
        initInGame();
        exports.ticks = 0;
    }
    function pgDispose() {
        if (pgDisposed) return;
        pgPause(true); pgDisposed = true;
        pgListeners.splice(0).forEach((remove) => remove());
        pgInputResets.length = 0;
    }
    function pgSnapshot() {
        return { phase: state, run: pgRuns, ticks: exports.ticks, frames: pgFrames, score: exports.score,
            difficulty: exports.difficulty, replaying: exports.isReplaying,
            paused: pgPaused, disposed: pgDisposed, pressed: isPressed, rafPending: !!pgRaf,
            listenerCount: pgListeners.length, nativeBest: hiScore };
    }
