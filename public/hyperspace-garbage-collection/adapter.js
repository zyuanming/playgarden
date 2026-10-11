// SPDX-License-Identifier: GPL-3.0-only
(function() {
  'use strict';
  var session = new URL(location.href).searchParams.get('session');
  var parentOrigin = new URL(location.href).origin;
  var revision = 'hgc-f5b93cbb-playgarden-1';
  var disposed = false, initialized = false, pendingInit = null, runtimeReady = false;
  var hostPaused = false, localPaused = false, blurPaused = false, hidden = document.hidden;
  var phase = 'loading', level = 0, awarded = false, ticks = 0, raf = 0, previous = 0, accumulator = 0;
  var game, Clock, Player, Trash, Trigger, Door, Emitter, Laser, Settings, stages;
  var controls = new AbortController(), keyboard = new Set(), pointers = new Map(), drag = null;
  var emitted = 0, expired = 0, annihilated = 0;
  var names = ['漂流与牵引', '挡住激光', '双向分流', '最后一班清运'];
  var hints = [
    '你现在是反物质。跟随通道，把紫色碎屑送进同色收集框；所有激光都不会伤害清运员。',
    '切成物质可以挡住蓝色激光，让左行碎屑通过。收集框在走廊最左端。',
    '两股碎屑交叉流动。用相同物质从侧面推偏轨迹，把两种碎屑分别送到下方同色收集框。',
    '先将左侧反物质送入下方收集框，再到右上切成物质，照顾第二股碎屑。两个收集框都点亮后进入右下舱门。'
  ];
  function el(id) { return document.getElementById(id); }
  function send(type, extra) {
    if (!disposed && session && parent !== window) parent.postMessage(Object.assign({ source: 'playgarden-hgc', session: session, type: type }, extra || {}), parentOrigin);
  }
  function listen(node, type, fn, extra) { node.addEventListener(type, fn, Object.assign({ signal: controls.signal }, extra || {})); }
  function paused() { return hostPaused || localPaused || hidden || (phase === 'playing' && blurPaused); }
  function active() { return !disposed && (phase === 'playing' || phase === 'ending') && !paused(); }
  function canMove() { return (phase === 'playing' || phase === 'ending') && !paused(); }
  function clearInput() {
    keyboard.clear(); pointers.clear(); drag = null;
    if (game) game.input.clear();
  }
  function syncKeys() {
    if (!game) return;
    game.input.keys = [];
    keyboard.forEach(function(code) { game.input.keys[code] = true; });
    pointers.forEach(function(code) { if (code) game.input.keys[code] = true; });
  }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; previous = 0; accumulator = 0; }
  function refreshPause() {
    if (paused()) { clearInput(); stopLoop(); } else startLoop();
    el('pause-cover').hidden = !paused() || phase === 'briefing' || phase === 'won';
    el('pause-btn').textContent = localPaused || blurPaused ? '继续' : '暂停';
    el('pause-btn').disabled = hostPaused || hidden || !['playing','ending'].includes(phase);
    document.querySelectorAll('[data-direction]').forEach(function(button) { button.disabled = !canMove(); });
    el('material-btn').disabled = !canMove();
    snapshot();
  }
  function frame(now) {
    raf = 0;
    if (!active()) return;
    if (!previous) previous = now;
    accumulator += Math.min(100, Math.max(0, now - previous)); previous = now;
    while (accumulator + 0.000001 >= 1000 / 60 && active()) {
      accumulator -= 1000 / 60;
      Clock.tick(1 / 60);
      if (!active()) break;
      game.update(1 / 60); ticks++;
      if (ticks % 6 === 0) snapshot();
    }
    game.draw();
    if (active() && !raf) raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (game && active() && !raf) raf = requestAnimationFrame(frame); }
  function materialLabel() {
    var matter = game.player.material === 2;
    el('material-btn').textContent = (matter ? '物质 ●' : '反物质 ◇') + ' · 切换';
    el('material-btn').className = matter ? 'matter' : 'antimatter';
    el('material-btn').setAttribute('aria-label', matter ? '当前物质，切换为反物质' : '当前反物质，切换为物质');
  }
  function toggleMaterial() { if (canMove()) { game.player.toggleMaterial(); materialLabel(); snapshot(); } }
  function objects(Type) { return game ? game.entities.filter(function(entity) { return entity instanceof Type; }) : []; }
  function reading() {
    if (!game) return { level: level, phase: phase, paused: paused() };
    var coordinate = function(entity) { return { id: entity.observationId, x: entity.x, y: entity.y, vx: entity.vx || 0, vy: entity.vy || 0, material: entity.material }; };
    return {
      level: level, phase: phase, paused: paused(), hostPaused: hostPaused, localPaused: localPaused, blurPaused: blurPaused,
      ticks: ticks, clock: Clock.read(), awarded: awarded, player: coordinate(game.player),
      input: { held: Object.keys(game.input.keys).filter(function(k) { return game.input.keys[k]; }), dragging: !!game.input.touch },
      camera: { x: game.camera.x, y: game.camera.y, width: game.camera.width, height: game.camera.height },
      triggers: objects(Trigger).map(function(t) { return Object.assign(coordinate(t), { active: t.active, capturedId: t.active && t.object ? t.object.observationId : null }); }),
      doors: objects(Door).map(function(d) { return Object.assign(coordinate(d), { open: !!d.open, capturedPlayer: !!d.player, pending: d.callback === null }); }),
      debris: objects(Trash).map(function(t) { return Object.assign(coordinate(t), { age: t.time, lifetime: Number.isFinite(t.lifeTime) ? t.lifeTime : null, captured: t.fixture.IsSensor() }); }),
      emitters: objects(Emitter).map(function(e) { return { x: e.x, y: e.y, firing: e.firing, time: e.time }; }),
      lasers: objects(Laser).map(function(l) { return { x: l.x, y: l.y, material: l.material, endpoint: l.endpoint ? { x: l.endpoint.x, y: l.endpoint.y } : null }; }),
      emitted: emitted, expired: expired, annihilated: annihilated, text: game.text,
      walls: game.entities.filter(function(e) { return e.body && e.body.GetType() === 0 && !e.fixture.IsSensor(); }).map(function(e) {
        var shape = e.fixture.GetShape();
        if (!shape.GetVertices) return [];
        return shape.GetVertices().slice(0, shape.GetVertexCount()).map(function(v) { var p = e.body.GetWorldPoint(v); return { x: p.x, y: p.y }; });
      })
    };
  }
  // Pure JSON copies. No engine reference, setters, key injection or win API.
  Object.defineProperty(window, '__hgcRead', { value: function() { return JSON.parse(JSON.stringify(reading())); }, writable: false });
  function snapshot() {
    if (!game || disposed) return;
    var triggers = objects(Trigger), count = triggers.filter(function(t) { return t.active; }).length;
    el('captures').textContent = phase === 'ending' ? '原作结局 · the end' : '收集框 ' + count + ' / ' + triggers.length;
    send('snapshot', { state: { level: level, phase: phase, paused: paused(), captured: count, required: triggers.length } });
  }
  function load(n) {
    stopLoop(); clearInput(); level = n; awarded = false; emitted = 0; expired = 0; annihilated = 0; ticks = 0;
    localPaused = false; blurPaused = false; phase = 'briefing';
    stages[n](game);
    game.camera.x = game.player.x; game.camera.y = game.player.y; game.camera.angle = 0;
    materialLabel(); game.draw();
    el('stage-label').textContent = '第 ' + (n + 1) + ' / 4 关 · ' + names[n];
    el('briefing-text').textContent = hints[n]; el('instructions').textContent = '方向键 / WASD，或画布拖动、按住下方方向。空格 / 物质按钮切换。' + (n === 0 ? '首关固定反物质。' : '同类推动，异类湮灭。');
    el('briefing').hidden = false; el('finish').hidden = true;
    el('finish').classList.remove('original-ending'); el('next-btn').hidden = false;
    el('message').textContent = '碎屑丢失或过期会重新发射；没有生命值。'; refreshPause();
  }
  function start() {
    if (hostPaused || hidden || phase !== 'briefing') return;
    phase = 'playing'; blurPaused = false; el('briefing').hidden = true;
    game.canvas.focus(); refreshPause();
  }
  function complete(index, originalNext) {
    if (disposed || awarded || index !== level || phase !== 'playing' || paused()) return;
    var doors = objects(Door), valid = doors.some(function(d) {
      return d.open && d.player === game.player && d.callback === null && d.triggers.length > 0 && d.triggers.every(function(t) { return t.active; });
    });
    if (!valid) return;
    awarded = true; clearInput(); stopLoop();
    if (level === 3) {
      // The original final scene runs only after the original door callback.
      originalNext(game); phase = 'ending'; materialLabel();
      game.camera.x = game.player.x; game.camera.y = game.player.y;
      el('finish-title').textContent = '四段航程的终点';
      el('finish-text').textContent = '第 4 关已完成。原作结局保留在画布中。';
      el('finish').classList.add('original-ending'); el('next-btn').textContent = '返回第一关';
    } else {
      phase = 'won';
      el('finish-title').textContent = '清运完成'; el('finish-text').textContent = '同色碎屑已收集，你已穿过打开的舱门。';
      el('next-btn').textContent = '下一关';
    }
    el('finish').hidden = false; el('message').textContent = '本关真实通关已保存。';
    game.draw(); refreshPause();
    send('complete', { level: level, ending: level === 3 });
  }
  function init(data) {
    if (initialized || disposed || !runtimeReady || !Number.isInteger(data.level) || data.level < 0 || data.level >= 4) return;
    initialized = true; hostPaused = data.paused === true; load(data.level);
    send('ready', { revision: revision, levelCount: 4 }); height();
  }
  function height() { send('height', { height: Math.ceil(el('app').getBoundingClientRect().height) + 2 }); }
  var resize = new ResizeObserver(height); resize.observe(el('app'));
  function dispose() {
    if (disposed) return; disposed = true; stopLoop(); clearInput(); if (Clock) Clock.reset();
    controls.abort(); resize.disconnect();
  }
  listen(window, 'message', function(event) {
    var d = event.data;
    if (event.source !== parent || event.origin !== parentOrigin || !d || d.source !== 'playgarden-host' || d.session !== session || disposed) return;
    if (d.type === 'init') { pendingInit = d; if (runtimeReady) init(d); }
    else if (d.type === 'pause' && initialized) {
      var wasHostPaused = hostPaused; hostPaused = d.paused === true;
      if (wasHostPaused && !hostPaused && phase === 'playing') { blurPaused = false; game.canvas.focus(); }
      refreshPause();
    } else if (d.type === 'hint' && initialized) { el('message').textContent = hints[level]; send('status', { message: hints[level] }); }
    else if (d.type === 'dispose') dispose();
  });
  listen(window, 'pagehide', dispose);
  listen(window, 'blur', function() { clearInput(); if (phase === 'playing') blurPaused = true; refreshPause(); });
  listen(window, 'focus', function() { blurPaused = false; refreshPause(); });
  listen(document, 'visibilitychange', function() { hidden = document.hidden; clearInput(); refreshPause(); });
  listen(window, 'pointercancel', function() { clearInput(); });
  listen(window, 'touchcancel', function() { clearInput(); }, { passive: true });
  listen(document, 'keydown', function(event) {
    var code = event.which || event.keyCode;
    if ([32,37,38,39,40,65,68,83,87].includes(code)) event.preventDefault();
    if (!canMove()) return;
    if (code === 32) { if (!event.repeat) toggleMaterial(); return; }
    if ([37,38,39,40,65,68,83,87].includes(code)) { keyboard.add(code); syncKeys(); }
  });
  listen(document, 'keyup', function(event) { keyboard.delete(event.which || event.keyCode); syncKeys(); });
  listen(el('material-btn'), 'click', toggleMaterial);
  listen(el('start-btn'), 'click', start);
  listen(el('pause-btn'), 'click', function() {
    if (hostPaused || hidden) return;
    if (blurPaused) { blurPaused = false; localPaused = false; } else localPaused = !localPaused;
    if (!localPaused) game.canvas.focus(); refreshPause();
  });
  listen(el('restart-btn'), 'click', function() { if (initialized) { load(level); if (!hostPaused && !hidden) start(); } });
  listen(el('replay-btn'), 'click', function() { load(level); start(); });
  listen(el('next-btn'), 'click', function() { if (awarded && !hostPaused) send('navigate', { level: level === 3 ? 0 : level + 1 }); });
  document.querySelectorAll('[data-direction]').forEach(function(button) {
    listen(button, 'pointerdown', function(event) {
      if (!canMove()) return; event.preventDefault(); button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, Number(button.dataset.direction)); syncKeys();
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(function(type) { listen(button, type, function(event) { pointers.delete(event.pointerId); syncKeys(); }); });
  });
  requirejs.config({ baseUrl: 'js', waitSeconds: 15, shim: { box2d: { exports: 'Box2D' } }, paths: { box2d: 'Box2dWeb/Box2dWeb-2.1.a.3' } });
  requirejs.onError = function(error) { if (!disposed) { el('message').textContent = '原作资源加载失败，请重试本关。'; send('error', { message: String(error.message).slice(0, 250) }); } };
  requirejs(['game','entities/player','entities/trash','entities/trigger','entities/door','entities/emitter','entities/laser','config/settings','playgarden-clock','levels/level-01','levels/level-02','levels/level-03','levels/level-04'], function(Game, P, T, Tr, D, E, L, S, C, one, two, three, four) {
    if (disposed) return;
    Player=P; Trash=T; Trigger=Tr; Door=D; Emitter=E; Laser=L; Settings=S; Clock=C; stages=[one,two,three,four];
    game=Game.instance=new Game(); game.setPlayer(new Player()); game.camera.target=game.player; game.stageCleared=complete;
    var add=game.add, remove=game.remove;
    game.add=function(entity) { if (entity instanceof Trash) emitted++; return add.call(game,entity); };
    game.remove=function(entity) {
      if (entity instanceof Trash && entity.game === game) { if (entity.time > entity.lifeTime) expired++; else annihilated++; }
      return remove.call(game,entity);
    };
    game.element.className='game'; game.canvas.tabIndex=0; game.canvas.setAttribute('aria-label','零重力清运画布');
    el('canvas-mount').appendChild(game.element);
    listen(game.canvas,'pointerdown',function(event) {
      if (!canMove() || drag !== null) return; event.preventDefault(); game.canvas.focus(); game.canvas.setPointerCapture(event.pointerId);
      drag=event.pointerId; game.input.initialTouch=game.input.normalizeTouch(event); game.input.touch=null;
    });
    listen(game.canvas,'pointermove',function(event) { if (canMove() && drag===event.pointerId) { event.preventDefault(); game.input.touch=game.input.normalizeTouch(event); } });
    ['pointerup','pointercancel','lostpointercapture'].forEach(function(type) { listen(game.canvas,type,function(event) { if (drag===event.pointerId) { drag=null; game.input.initialTouch=null; game.input.touch=null; } }); });
    runtimeReady=true; if (pendingInit) init(pendingInit); else send('hello');
  });
  send('hello');
})();
