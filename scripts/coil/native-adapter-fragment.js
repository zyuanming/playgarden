    // Playgarden adaptation fragment, SPDX-License-Identifier: GPL-3.0-only.
    var initialized = false, disposed = false, raf = 0, lastTick = 0;
    var hostPaused = false, localPaused = false, hiddenPaused = document.hidden;
    var pausedAt = 0, removers = [], resizeObserver;
    var keys = new Set(), activePointer = null, lastPublished = 0, lastSaved = 0;
    var captures = 0, bombsCaught = 0, expired = 0, lastEvent = '';
    var storageKey = 'playgarden.coil.original.records';
    var record = { version: 1, best: 0, runs: 0, last: 0 };
    var runRecorded = false, storageAvailable = true;
    try {
        var stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (stored && stored.version === 1) {
            ['best', 'runs', 'last'].forEach(function (key) {
                if (Number.isFinite(stored[key]) && stored[key] >= 0) record[key] = Math.floor(stored[key]);
            });
        }
    } catch (_) { storageAvailable = false; }

    function listen(target, type, handler) {
        target.addEventListener(type, handler);
        removers.push(function () { target.removeEventListener(type, handler); });
    }
    function status(message) {
        var el = document.querySelector('#feedback');
        if (el) el.textContent = message;
        window.dispatchEvent(new CustomEvent('coil-status', { detail: message }));
    }
    function isPaused() { return hostPaused || localPaused || hiddenPaused; }
    function setPaused(value, reason) {
        var before = isPaused();
        if (reason === 'local') localPaused = !!value;
        else if (reason === 'hidden') hiddenPaused = !!value;
        else hostPaused = !!value;
        var after = isPaused();
        if (!before && after) {
            pausedAt = Date.now();
            clearInput();
            persist(false);
        } else if (before && !after) {
            var elapsed = pausedAt ? Date.now() - pausedAt : 0;
            timeStart += elapsed;
            timeLastSecond += elapsed;
            timeLastFrame = Date.now();
            lastTick = performance.now();
            pausedAt = 0;
            canvas.focus({ preventScroll: true });
        }
        publish(true);
    }
    function toggleLocalPause() {
        if (hostPaused || !playing) return;
        setPaused(!localPaused, 'local');
    }
    function onBlur() {
        clearInput();
        // Merely focusing shell controls must not create a second pause to clear.
        // A hidden tab is paused separately by visibilitychange below.
    }
    function visibilityChanged() { setPaused(document.hidden, 'hidden'); }
    function pageHidden(event) {
        if (event.persisted) setPaused(true, 'hidden');
        else dispose();
    }
    function pageShown(event) {
        if (event.persisted) setPaused(document.hidden, 'hidden');
    }
    function clearInput() {
        keys.clear();
        mouse.down = false;
        if (activePointer !== null && canvas && canvas.hasPointerCapture(activePointer))
            canvas.releasePointerCapture(activePointer);
        activePointer = null;
    }
    function pointerMove(event) {
        if (!playing || isPaused()) return;
        if (event.pointerType !== 'mouse' && event.pointerId !== activePointer) return;
        var bounds = canvas.getBoundingClientRect();
        mouse.previousX = mouse.x;
        mouse.previousY = mouse.y;
        mouse.x = Math.max(0, Math.min(world.width - 1, (event.clientX - bounds.left) * world.width / bounds.width));
        mouse.y = Math.max(0, Math.min(world.height - 1, (event.clientY - bounds.top) * world.height / bounds.height));
        mouse.velocityX = Math.abs(mouse.x - mouse.previousX) / world.width;
        mouse.velocityY = Math.abs(mouse.y - mouse.previousY) / world.height;
    }
    function pointerDown(event) {
        if (!playing || isPaused() || activePointer !== null || event.button > 0) return;
        activePointer = event.pointerId;
        mouse.down = true;
        canvas.focus({ preventScroll: true });
        canvas.setPointerCapture(event.pointerId);
        pointerMove(event);
        event.preventDefault();
    }
    function pointerEnd(event) {
        if (activePointer === event.pointerId) clearInput();
    }
    function keyDown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        var key = event.key.toLowerCase();
        if (key === 'escape' || key === 'p') {
            event.preventDefault();
            if (!event.repeat) toggleLocalPause();
        } else if (key === 'enter' || key === ' ') {
            event.preventDefault();
            if (!playing && !event.repeat) start();
        } else if (['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d'].includes(key)) {
            event.preventDefault();
            if (playing && !isPaused()) keys.add(key);
        }
    }
    function keyUp(event) { keys.delete(event.key.toLowerCase()); }
    function updateKeyboard() {
        var dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
        var dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
        var scale = dx && dy ? Math.SQRT1_2 : 1;
        // Keyboard changes the same cursor used by the unchanged interpolated trail.
        var speed = 540 / FRAMERATE * Math.min(timeFactor, 2) * scale;
        mouse.x = Math.max(0, Math.min(world.width - 1, mouse.x + dx * speed));
        mouse.y = Math.max(0, Math.min(world.height - 1, mouse.y + dy * speed));
    }
    function loop(now) {
        if (disposed) return;
        raf = requestAnimationFrame(loop);
        if (isPaused()) return;
        var step = 1000 / FRAMERATE;
        if (now - lastTick < step) return;
        // At most one update per rAF; no backlog catch-up or 120 Hz acceleration.
        lastTick = now - ((now - lastTick) % step);
        update();
    }
    function persist(completed) {
        record.best = Math.max(record.best, Math.floor(score));
        if (completed && !runRecorded) {
            record.runs++;
            record.last = Math.floor(score);
            runRecorded = true;
        }
        try { localStorage.setItem(storageKey, JSON.stringify(record)); }
        catch (_) { storageAvailable = false; }
    }
    function snapshot() {
        return {
            phase: playing ? 'playing' : (document.body.dataset.phase === 'lost' ? 'lost' : 'welcome'),
            paused: isPaused(), score: Math.floor(score), best: Math.max(record.best, Math.floor(score)),
            energy: player ? player.energy : 100, multiplier: multiplier.major,
            multiplierProgress: multiplier.minor, duration: duration, frame: frameCount,
            captures: captures, bombsCaught: bombsCaught, expired: expired,
            difficulty: difficulty, lastEvent: lastEvent, storageAvailable: storageAvailable,
            width: world.width, height: world.height,
            cursor: { x: mouse.x, y: mouse.y },
            enemies: enemies.map(function (e) { return { x: e.x, y: e.y, type: e.type, age: e.time, alive: e.alive }; })
        };
    }
    function publish(force) {
        if (!initialized || disposed || !player) return;
        var now = performance.now();
        if (!force && now - lastPublished < 100) return;
        lastPublished = now;
        if (playing && now - lastSaved > 1000) { persist(false); lastSaved = now; }
        var state = snapshot();
        document.body.dataset.coilState = JSON.stringify(state);
        document.querySelector('#energy-value').textContent = state.energy;
        document.querySelector('#energy-meter').value = state.energy;
        document.querySelector('#score-value').textContent = state.score;
        document.querySelector('#best-value').textContent = state.best;
        document.querySelector('#multiplier-value').textContent = '×' + state.multiplier;
        document.querySelector('#multiplier-progress').value = state.multiplierProgress;
        document.querySelector('#time-value').textContent = Math.floor(state.duration / 1000) + ' 秒';
        document.querySelector('#pause-button').disabled = !playing || hostPaused;
        document.querySelector('#pause-button').textContent = localPaused ? '继续画圈' : '暂停画圈';
        document.querySelector('#paused').hidden = !state.paused || !playing;
        document.querySelector('#storage-note').hidden = storageAvailable;
        // These extra symbols never enter the collision bitmap.
        var marks = document.querySelector('#marks');
        marks.replaceChildren();
        state.enemies.forEach(function (enemy) {
            var mark = document.createElement('span');
            mark.textContent = enemy.type === 2 || enemy.type === 4 ? '×' : '·';
            mark.className = enemy.type === 2 || enemy.type === 4 ? 'bomb-mark' : 'blue-mark';
            mark.style.left = enemy.x / world.width * 100 + '%';
            mark.style.top = enemy.y / world.height * 100 + '%';
            marks.appendChild(mark);
        });
        var cursor = document.querySelector('#cursor');
        cursor.hidden = !playing;
        cursor.style.left = mouse.x / world.width * 100 + '%';
        cursor.style.top = mouse.y / world.height * 100 + '%';
        window.dispatchEvent(new CustomEvent('coil-snapshot', { detail: state }));
    }
    function dispose() {
        if (disposed) return;
        persist(false);
        clearInput();
        disposed = true;
        cancelAnimationFrame(raf);
        if (resizeObserver) resizeObserver.disconnect();
        removers.forEach(function (remove) { remove(); });
        removers = [];
        enemies = []; particles = []; notifications = []; intersections = []; effects = [];
        if (context) context.clearRect(0, 0, world.width, world.height);
    }
