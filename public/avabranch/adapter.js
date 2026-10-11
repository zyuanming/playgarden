// SPDX-License-Identifier: GPL-3.0-only
// Playgarden host bridge, responsive input and lifecycle for the complete MIT game.
(function () {
  'use strict';
  var session = new URLSearchParams(location.search).get('session');
  var parentOrigin = new URL(location.href).origin;
  var revision = 'avabranch-4ab326b-playgarden-1';
  var booted = false, disposed = false, hostPaused = true, localPause = '';
  var phase = 'welcome', raf = 0, previous = null, frames = 0;
  var physical = new Set(), pointers = new Map(), removers = [];
  var lastSaved = '', lastStatus = '', lastHeight = 0;
  var names = ['红线', '黄线', '绿线', '蓝线'];
  var start = document.getElementById('start');
  var branch = document.getElementById('branch');
  var pause = document.getElementById('pause');
  var settings = document.getElementById('settings');
  var resizeObserver;

  function post(type, extra) {
    if (disposed) return;
    parent.postMessage(Object.assign({ source: 'playgarden-avabranch', session: session, type: type }, extra || {}), parentOrigin);
  }
  function listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    removers.push(function () { target.removeEventListener(type, fn, options); });
  }
  function paused() { return hostPaused || !!localPause || document.hidden; }
  function active() { return booted && !disposed && phase === 'playing' && !paused(); }
  function clearInputs() {
    physical.clear();
    pointers.forEach(function (hold, id) {
      hold.button.classList.remove('held');
      if (hold.button.hasPointerCapture(id)) hold.button.releasePointerCapture(id);
    });
    pointers.clear();
    keyState = {};
  }
  function updateKeys() {
    keyState = {};
    if (!active()) return;
    physical.forEach(function (key) { keyState[key] = true; });
    pointers.forEach(function (hold) {
      var line = game.objects.player.lines[hold.row];
      if (line.isDead) return;
      var key = global_controls.keyMaps[player.branchStates[player.branchState]][hold.row][hold.col];
      keyState[key] = true;
    });
  }
  function snapshot() {
    var currentPlayer = game && game.objects.player;
    var spawner = game && game.objects.spawner;
    var power = game && game.objects.power_spawn;
    return {
      phase: phase, paused: paused(), hostPaused: hostPaused, localPause: localPause,
      score: hud ? hud.score : 0, best: avabranchRecords.best,
      multiplier: hud ? hud.multiplier : 0, branch: currentPlayer ? currentPlayer.branchState : 0,
      level: spawner ? spawner.level : 1, frame: frames, elapsed: game ? game.elapsed : 0,
      difficultyTimer: game ? game.timer : 0,
      effects: game ? game.effects.map(function (effect) { return effect.remaining; }) : [],
      lines: currentPlayer ? currentPlayer.lines.map(function (line) { return { x: line.x, y: line.y, r: line.r, speed: line.speed, dead: line.isDead, target: line.tarX, mergeFrames: line.tarXTime }; }) : [],
      blocks: spawner ? spawner.blocks.map(function (block) { return { x: block.x, y: block.y, w: block.w, h: block.h }; }) : [],
      powerups: power ? power.powerups.map(function (orb) { return { x: orb.x, y: orb.y, type: orb.type, dead: orb.isDead }; }) : [],
      held: Object.keys(keyState).sort(), pointerCount: pointers.size,
      keyMaps: global_controls ? global_controls.keyMaps[4] : AVABRANCH_DEFAULT_KEYS
    };
  }
  function publish() {
    var state = snapshot();
    // Read-only telemetry: no test-only state setters or runtime RNG overrides.
    document.body.dataset.avabranchState = JSON.stringify(state);
    document.body.dataset.phase = phase;
    document.body.dataset.paused = String(paused());
    document.getElementById('score').textContent = String(state.score);
    document.getElementById('best').textContent = String(state.best);
    document.getElementById('mode').textContent = state.branch ? '分流 ×4' : '合流 ×1';
    document.getElementById('lives').textContent = (currentLives() || (phase === 'welcome' ? 2 : 0)) + ' / 4 条线';
    start.hidden = phase === 'playing';
    start.textContent = phase === 'lost' ? '再来一局' : '开始挑战';
    start.disabled = hostPaused || document.hidden || !booted;
    branch.disabled = !active();
    branch.textContent = state.branch ? '合流 · 空格' : '分流 · 空格';
    pause.disabled = phase !== 'playing' || hostPaused || document.hidden;
    pause.textContent = localPause ? '继续挑战 · P' : '暂停 · P';
    document.querySelectorAll('[data-steer]').forEach(function (button) {
      var row = Number(button.dataset.row), col = Number(button.dataset.col);
      var dead = state.lines.length ? state.lines[row].dead : row > 1;
      button.disabled = !active() || dead;
      var key = global_controls.keyMaps[state.branch ? 4 : 1][row][col];
      button.textContent = (col ? '右' : '左') + ' · ' + key;
      button.closest('.color-row').classList.toggle('dead', dead);
      document.getElementById('life-' + row).textContent = names[row] + (dead ? ' · 待复活' : '');
    });
    var record = { best: state.best, keyMaps: state.keyMaps };
    var encoded = JSON.stringify(record);
    if (encoded !== lastSaved) { lastSaved = encoded; post('save', { state: record }); }
    post('snapshot', { state: { phase: phase, paused: state.paused, score: state.score, best: state.best, branch: state.branch, lives: currentLives() } });
    var message = phase === 'welcome' ? '从红、黄两条线开始。躲开黑块和边缘，拾取彩色光球恢复同色生命。' :
      phase === 'lost' ? '四条线全部耗尽。本局 ' + state.score + ' 分，最高 ' + state.best + ' 分；可以再来一局。' :
      hostPaused ? '已由上方暂停。点击上方“继续游戏”恢复。' :
      localPause ? '已暂停，分数、障碍、难度和光球效果的时间都已冻结。' :
      state.branch ? '分流中：各色独立控制，存活线按 ×4 计分。空格或“合流”可重新聚拢。' :
      '合流中：A / F 或任一颜色行控制全队。空格或“分流”切换独立控制。';
    document.getElementById('message').textContent = message;
    if (message !== lastStatus) { lastStatus = message; post('status', { message: message }); }
  }
  function currentLives() { return game && game.objects.player ? game.objects.player.lines.filter(function (line) { return !line.isDead; }).length : 0; }
  function redraw() {
    if (!game) return;
    game.paused = paused() && phase === 'playing';
    game.ctx.clearRect(0, 0, canvas.width, canvas.height);
    game.draw();
    publish();
  }
  function syncClock() {
    if (!active()) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; previous = null;
    } else if (!raf) {
      previous = null;
      raf = requestAnimationFrame(tick);
    }
    redraw();
  }
  function tick(now) {
    raf = 0;
    if (!active()) { previous = null; return; }
    // Retain original per-render scoring rounding and spawning. Bound a stalled
    // frame to 100 ms so an operating-system stall cannot skip through the field.
    var delta = previous === null ? 0 : Math.max(0, Math.min(100, now - previous));
    previous = now;
    if (delta > 0) {
      updateKeys();
      game.physics(delta);
      frames += 1;
    }
    if (hud.gameOver) {
      phase = 'lost'; localPause = ''; game.effects = []; clearInputs();
    }
    redraw();
    if (active()) raf = requestAnimationFrame(tick);
  }
  function begin() {
    if (!booted || disposed || hostPaused || document.hidden || phase === 'playing') return;
    clearInputs();
    if (raf) cancelAnimationFrame(raf);
    raf = 0; previous = null; frames = 0; localPause = '';
    settings.open = false;
    if (game) { game.play = false; game.effects = []; }
    startGame();
    phase = 'playing';
    canvas.focus({ preventScroll: true });
    syncClock();
  }
  function toggleBranch() {
    if (!active()) return;
    clearInputs();
    keyListeners.slice().forEach(function (entry) { if (entry[0] === ' ') entry[1](); });
    redraw();
  }
  function togglePause() {
    if (!booted || disposed || phase !== 'playing' || hostPaused || document.hidden) return;
    clearInputs();
    localPause = localPause ? '' : 'manual';
    if (!localPause) settings.open = false;
    syncClock();
  }
  function normalizedKey(event) {
    if (event.key === ';' || event.code === 'Semicolon') return ';';
    if (/^[a-z0-9]$/i.test(event.key)) return event.key.toUpperCase();
    return event.key;
  }
  function isEditor(target) { return target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]'); }
  listen(window, 'keydown', function (event) {
    if (isEditor(event.target) || !booted || disposed) return;
    var key = normalizedKey(event);
    if (['Enter', ' ', 'P', 'Escape'].includes(key)) {
      // Enter/Space must still activate focused real buttons through their normal
      // click behavior. The canvas/global shortcuts own only non-button targets.
      if ((key === 'Enter' || key === ' ') && event.target instanceof Element && event.target.closest('button,summary')) return;
      event.preventDefault();
      if (event.repeat) return;
      if (key === 'Enter') begin();
      else if (key === ' ') toggleBranch();
      else togglePause();
    } else if (global_controls.keyMaps[4].flat().includes(key) || key === 'A' || key === 'F') {
      event.preventDefault();
      // A blur, cancellation or mode toggle requires a new physical press;
      // key-repeat events must not resurrect a cleared held direction.
      if (active() && !event.repeat) { physical.add(key); updateKeys(); }
    }
  });
  listen(window, 'keyup', function (event) { physical.delete(normalizedKey(event)); updateKeys(); });
  listen(start, 'click', begin);
  listen(branch, 'click', toggleBranch);
  listen(pause, 'click', togglePause);
  document.querySelectorAll('[data-steer]').forEach(function (button) {
    listen(button, 'pointerdown', function (event) {
      if (!active() || button.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      pointers.set(event.pointerId, { row: Number(button.dataset.row), col: Number(button.dataset.col), button: button });
      button.setPointerCapture(event.pointerId);
      button.classList.add('held');
      updateKeys(); publish();
    });
    function release(event) {
      var hold = pointers.get(event.pointerId);
      if (!hold) return;
      pointers.delete(event.pointerId);
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (![...pointers.values()].some(function (value) { return value.button === button; })) button.classList.remove('held');
      updateKeys(); publish();
    }
    listen(button, 'pointerup', release);
    listen(button, 'pointercancel', release);
    listen(button, 'lostpointercapture', release);
    listen(button, 'pointermove', function (event) {
      var box = button.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) release(event);
    });
    listen(button, 'contextmenu', function (event) { event.preventDefault(); });
    // Keyboard activation is a short genuine held direction, released at keyup.
    listen(button, 'keydown', function (event) {
      if (![' ', 'Enter'].includes(event.key) || !active() || event.repeat) return;
      event.preventDefault();
      var row = Number(button.dataset.row), col = Number(button.dataset.col);
      physical.add(global_controls.keyMaps[player.branchState ? 4 : 1][row][col]); updateKeys();
    });
    listen(button, 'keyup', function (event) { if ([' ', 'Enter'].includes(event.key)) { clearInputs(); publish(); } });
  });
  listen(window, 'blur', function () {
    clearInputs();
    if (phase === 'playing' && !hostPaused && !localPause) localPause = 'blur';
    if (booted) syncClock();
  });
  listen(document, 'visibilitychange', function () {
    clearInputs();
    if (document.hidden && phase === 'playing') localPause = localPause || 'visibility';
    if (booted) syncClock();
  });
  listen(settings, 'toggle', function () {
    if (settings.open && phase === 'playing') { localPause = localPause || 'settings'; clearInputs(); syncClock(); }
    measure();
  });
  listen(document.getElementById('save-keys'), 'click', function () {
    var keys = [[], [], [], []];
    document.querySelectorAll('[data-map-row]').forEach(function (input) { keys[Number(input.dataset.mapRow)][Number(input.dataset.mapCol)] = input.value.trim().toUpperCase(); });
    if (!validAvabranchKeys(keys)) { document.getElementById('key-message').textContent = '请用八个不同的字母、数字或分号；P 是暂停保留键。'; return; }
    clearInputs(); global_controls.load(keys); publish();
    document.getElementById('key-message').textContent = '新键位已保存。合流仍使用 A / F。';
  });
  listen(document.getElementById('reset-keys'), 'click', function () { clearInputs(); global_controls.reset(); publish(); document.getElementById('key-message').textContent = '已恢复原作默认键位。'; });
  function measure() {
    var height = Math.ceil(document.querySelector('main').getBoundingClientRect().height);
    if (height !== lastHeight) { lastHeight = height; post('height', { height: height }); }
  }
  function dispose() {
    if (disposed) return;
    clearInputs();
    if (raf) cancelAnimationFrame(raf);
    raf = 0; previous = null;
    if (game) { game.play = false; game.effects = []; }
    if (resizeObserver) resizeObserver.disconnect();
    removers.splice(0).forEach(function (remove) { remove(); });
    disposed = true;
  }
  listen(window, 'message', function (event) {
    var data = event.data;
    if (event.source !== parent || event.origin !== parentOrigin || !data || data.source !== 'playgarden-host' || data.session !== session || disposed) return;
    if (data.type === 'init') {
      if (!booted) {
        init();
        avabranchRecords.best = Number.isSafeInteger(data.state && data.state.best) && data.state.best >= 0 ? data.state.best : 0;
        global_controls.load(data.state && data.state.keyMaps);
        booted = true;
      }
      hostPaused = data.paused === true;
      post('ready', { revision: revision, endless: true, levelCount: 0 });
      syncClock(); measure();
    } else if (data.type === 'pause') {
      hostPaused = data.paused === true;
      // Clicking the host pause toolbar first blurs this iframe. That incidental
      // blur belongs to the host pause, while a pre-existing manual pause stays.
      if (hostPaused && localPause === 'blur') localPause = '';
      clearInputs(); if (booted) syncClock();
    } else if (data.type === 'hint') {
      post('status', { message: '先合流躲避黑块，再短暂分流提高得分。光球先复活同色线；同色已存活时，蓝减速、绿加速、红增粗、黄变细，持续 10 秒。' });
    } else if (data.type === 'dispose') dispose();
  });
  listen(window, 'pagehide', dispose);
  resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(document.querySelector('main'));
  post('hello');
})();
