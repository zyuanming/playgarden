// SPDX-License-Identifier: GPL-3.0-only
// Playgarden integration, 2026-10-10. Gameplay/physics remain in the original game.js.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const session = params.get('session') || '';
  const requestedLevel = Math.max(1, Math.min(6, Number(params.get('level')) || 1));
  const PREFIX = 'playgarden.heal-em-all.v1.';
  const abort = new AbortController();
  const requests = new Set(), images = new Set(), held = new Map();
  const volatile = new Map();
  let Q, game, disposed = false, ready = false, phase = 'loading', localPaused = false, hostPaused = false;
  let hostConnected = !session, initialViewPending = true;
  let currentHint = '', screenNumber = requestedLevel, lastSnapshotTime = 0, playedTime = 0;
  let summary = null;
  const send = (type, fields = {}) => {
    if (!disposed) parent.postMessage({ source: 'playgarden-heal-em-all', session, type, ...fields }, location.origin);
  };
  const integer = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  const storage = {
    getItem(key) {
      if (!/^playgarden\.heal-em-all\.v1\.(available|stars:[1-6])$/.test(key)) return null;
      let value = volatile.get(key) ?? null;
      try { if (!volatile.has(key)) value = localStorage.getItem(key); } catch { $('save-warning').hidden = false; }
      return String(key.endsWith('available') ? integer(value, 1, 7, 1) : integer(value, 0, 3, 0));
    },
    setItem(key, value) {
      if (!/^playgarden\.heal-em-all\.v1\.(available|stars:[1-6])$/.test(key)) return;
      const number = key.endsWith('available') ? integer(value, 1, 7, 1) : integer(value, 0, 3, 0);
      volatile.set(key, String(number));
      try { localStorage.setItem(key, String(number)); } catch { $('save-warning').hidden = false; }
    }
  };
  const paused = () => hostPaused || localPaused || document.hidden;
  function releaseAll() {
    held.clear();
    if (Q) for (const action of ['left', 'right', 'up', 'action', 'fire']) Q.inputs[action] = false;
    document.querySelectorAll('[data-held]').forEach(el => el.removeAttribute('data-held'));
  }
  function applyPause() {
    if (!Q || disposed) return;
    releaseAll();
    Q.hostPaused = paused() || phase !== 'playing';
    if (Q.hostPaused) Q.pauseGame(); else Q.unpauseGame();
    $('pause-cover').hidden = !paused();
    $('pause').textContent = paused() ? '继续冒险' : '暂停冒险';
    document.querySelectorAll('[data-input]').forEach(el => { el.disabled = paused() || phase !== 'playing'; });
    publish();
  }
  function input(id, action, down) {
    if (!Q || disposed || !ready) return;
    if (down && (phase !== 'playing' || paused())) return;
    if (down) held.set(id, action); else held.delete(id);
    Q.inputs[action] = [...held.values()].includes(action);
    document.querySelectorAll(`[data-input="${action}"]`).forEach(el => el.toggleAttribute('data-held', Q.inputs[action]));
    if (down) Q.input.trigger(action);
    else Q.input.trigger(action + 'Up');
  }
  const actorList = type => (Q?.stage(0)?.lists[type] || []).filter(item => !item.isDestroyed);
  function read() {
    const player = actorList('Player')[0] || actorList('ZombiePlayer')[0];
    const p = player?.p;
    const copyActor = item => ({ x: item.p.x, y: item.p.y, vx: item.p.vx || 0, vy: item.p.vy || 0, wasHuman: !!item.p.wasHuman, opened: !!item.p.opened });
    // Every object is copied. This observer has no route, clock or state setters.
    return {
      phase, paused: paused(), level: screenNumber, frames: Q?._loopFrame || 0,
      availableLevel: game ? Number(game.availableLevel) : 1,
      lives: Q?.state.get('lives') || 0, ammo: Q?.state.get('bullets') || 0,
      hasKey: !!Q?.state.get('hasKey'), hasGun: !!Q?.state.get('hasGun'),
      hint: currentHint, elapsed: playedTime,
      player: p ? { x: p.x, y: p.y, vx: p.vx, vy: p.vy, direction: p.direction, form: player.isA('Player') ? 'human' : 'zombie', wasZombie: !!p.wasZombie, grounded: p.landed > 0, invincible: p.timeInvincible || 0 } : null,
      objects: Object.fromEntries(['Key', 'Door', 'Gun', 'Heart', 'Zombie', 'Human', 'DeadZombie', 'Bullet'].map(type => [type, actorList(type).map(copyActor)])),
      summary: summary ? JSON.parse(JSON.stringify(summary)) : null,
      inputs: Q ? Object.fromEntries(['left', 'right', 'action', 'fire'].map(action => [action, !!Q.inputs[action]])) : {},
      stars: Array.from({ length: 6 }, (_, i) => Number(storage.getItem(PREFIX + 'stars:' + (i + 1))))
    };
  }
  function publish() { if (ready && !disposed) send('snapshot', { state: read() }); }
  function initializeView() {
    if (!ready || disposed || !hostConnected || !initialViewPending) return;
    initialViewPending = false;
    // The host's initial pause state is known before any autonomous stage starts.
    if (requestedLevel !== 1 && requestedLevel <= Number(game.availableLevel)) start(requestedLevel, true);
    else showTitle();
  }
  function announceReady() {
    if (!ready || disposed) return;
    send('ready', { revision: 'heal-em-all-66950cda-playgarden-1', levelCount: 6 });
    send('height', { height: Math.ceil($('game').getBoundingClientRect().height) + 1 });
    publish();
  }
  function updateHud() {
    const state = read();
    $('level-label').textContent = `第 ${screenNumber} / 6 关`;
    $('form').textContent = state.player?.form === 'zombie' ? '感染形态' : '人类形态';
    $('lives').textContent = `生命 ${state.lives}`;
    $('ammo').textContent = `治愈弹 ${state.ammo}`;
    $('key').textContent = state.hasKey ? '钥匙 ✓' : state.objects.Door.some(d => d.opened) ? '出口已开' : '寻找钥匙';
    $('saved').textContent = `已治愈 ${state.objects.Human.length} / ${game.currentLevelData?.zombies.available || 0}`;
    $('hint').textContent = currentHint;
    publish();
  }
  function button(text, action, attrs = {}) {
    const el = document.createElement('button'); el.textContent = text;
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    el.addEventListener('click', action, { signal: abort.signal });
    return el;
  }
  function paragraph(parent, text, className) {
    const p = document.createElement('p'); p.textContent = text; if (className) p.className = className; parent.append(p); return p;
  }
  function menu(title, text) {
    releaseAll(); $('play').hidden = true; $('menu').hidden = false; $('menu').replaceChildren();
    const panel = document.createElement('section'); panel.className = 'menu-panel';
    paragraph(panel, 'HEAL’EM ALL · 完整六关', 'eyebrow');
    const h = document.createElement('h1'); h.textContent = title; panel.append(h);
    if (text) paragraph(panel, text);
    $('menu').append(panel); $('game').dataset.phase = phase;
    applyPause(); send('height', { height: Math.ceil($('game').getBoundingClientRect().height) + 1 });
    return panel;
  }
  function actions(panel, buttons) { const row = document.createElement('div'); row.className = 'menu-actions'; row.append(...buttons); panel.append(row); }
  function showTitle() {
    game.Q.clearStages(); phase = 'title';
    const panel = menu('治愈所有人', '带着有限的治愈弹，穿过高低错落的平台。找到钥匙，打开出口；让被感染的人恢复健康。');
    paragraph(panel, '卡通感染者与墓碑画面。跌落与碰撞会失去生命，谨慎寻找安全落脚点。', 'notice');
    actions(panel, [button('开始冒险', showLevels), button('玩法说明', showControls)]);
    paragraph(panel, 'Krzysztof Urbas · Paweł Madeja · 2013\n本站提供完整原作地图、规则与结局。', 'notice');
    publish();
  }
  function showControls() {
    Q.clearStages(); phase = 'controls';
    const panel = menu('先找钥匙，再救更多人', '左右键移动；向上或 X 跳跃、进入已开的门；空格或 Z 发射治愈弹。触屏使用下方四个按钮，可同时按住方向和跳跃。');
    paragraph(panel, '枪与子弹需要拾取，治疗不是过关的强制条件。人类有四秒免疫期，随后可能再次感染。重复治疗普通感染者转化的感染者会留下墓碑。');
    paragraph(panel, '第一次失去全部生命后进入感染形态：跳出地图，恢复人类形态。恢复后再失去全部生命，就需要重试这一关。');
    actions(panel, [button('选择关卡', showLevels)]); publish();
  }
  function showLevels() {
    Q.clearStages(); phase = 'levels'; game.currentScreen = 'levelSelect'; summary = null;
    const panel = menu('六关救援地图', '完成一关会解锁下一关。再次挑战已解锁的关卡，争取留下更多健康的人。');
    const grid = document.createElement('div'); grid.className = 'level-grid';
    for (let n = 1; n <= 6; n++) {
      const allowed = n <= Number(game.availableLevel), stars = Number(storage.getItem(PREFIX + 'stars:' + n));
      const el = button(`第 ${n} 关`, () => start(n), { 'aria-label': `开始第 ${n} 关` });
      el.disabled = !allowed;
      const small = document.createElement('small'); small.textContent = allowed ? (stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '等待出发') : '完成上一关解锁';
      el.append(small); grid.append(el);
    }
    panel.append(grid); actions(panel, [button('玩法说明', showControls), button('返回标题', showTitle)]); publish();
  }
  function start(n, initial = false) {
    if (disposed || !ready || n < 1 || n > 6 || n > Number(game.availableLevel) || (hostPaused && !initial)) return;
    // Keep the shell's selected level and its completion callback in sync.
    // Standalone source has no session and navigates locally instead.
    if (session && n !== requestedLevel) { send('navigate', { level: n }); return; }
    releaseAll(); screenNumber = n; phase = 'playing'; summary = null; playedTime = 0; localPaused = false;
    game.stageLevel(n);
    $('menu').hidden = true; $('play').hidden = false; $('game').dataset.phase = phase;
    updateHud(); applyPause(); if (!paused()) $('heal-canvas').focus({ preventScroll: true });
    send('status', { message: `第 ${n} 关：找到钥匙，接触出口开门，再按跳跃进入。` });
  }
  function finished() {
    // The original Door.sensor is the only caller of this scene transition.
    const data = game.currentLevelData, ratio = data.zombies.healed / data.zombies.available;
    const stars = ratio <= .5 ? 1 : ratio < .9 ? 2 : 3;
    if (screenNumber >= Number(game.availableLevel)) { game.availableLevel = screenNumber + 1; storage.setItem(PREFIX + 'available', game.availableLevel); }
    const key = PREFIX + 'stars:' + screenNumber;
    if (Number(storage.getItem(key)) < stars) storage.setItem(key, stars);
    summary = JSON.parse(JSON.stringify({ ...data, stars, level: screenNumber }));
    releaseAll(); Q.clearStages(); phase = 'summary'; game.currentScreen = 'levelSummary';
    const panel = menu(`第 ${screenNumber} 关 · 已抵达出口`, '每位离开时仍然健康的人，都会计入这一关的救援评分。');
    paragraph(panel, '★'.repeat(stars) + '☆'.repeat(3 - stars), 'stars');
    const stats = document.createElement('div'); stats.className = 'summary-stats';
    for (const [title, value] of [['健康的人', `${data.zombies.healed} / ${data.zombies.available}`], ['心心收集', `${data.health.collected} / ${data.health.available}`], ['未命中弹药', `${data.bullets.waisted} / ${data.bullets.available}`], ['感染形态', data.zombieModeFound ? '已发现' : '未触发']]) {
      const p = paragraph(stats, title), strong = document.createElement('b'); strong.textContent = value; p.append(strong);
    }
    panel.append(stats); actions(panel, [button(screenNumber === 6 ? '查看旅程结局' : '前往下一关', () => screenNumber === 6 ? showEnd() : start(screenNumber + 1)), button('再试本关', () => start(screenNumber)), button('关卡地图', showLevels)]);
    send('complete', { level: screenNumber, stars }); publish();
  }
  function showEnd() {
    if (!summary || summary.level !== 6) return;
    Q.clearStages(); phase = 'ending'; game.currentScreen = 'end';
    const panel = menu('六关旅程 · 完成', '你已经穿过最后一扇门。感谢你的救援！回到关卡地图，还可以继续寻找更完整的三星救援。');
    panel.setAttribute('aria-label', '完整旅程结局');
    paragraph(panel, 'THE END · Krzysztof Urbas & Paweł Madeja', 'notice');
    actions(panel, [button('回到全部关卡', showLevels), button('再挑战最后一关', () => start(6))]);
    send('status', { message: '六关旅程完成。最终出口与完整结局已抵达。' }); publish();
  }
  function gameOver() {
    releaseAll(); Q.clearStages(); phase = 'gameover'; game.currentScreen = 'gameOver';
    const panel = menu('先休息，再出发', '恢复人类形态后再次失去了全部生命。重试会以三条生命重新开始这一关。');
    actions(panel, [button('重试本关', () => start(screenNumber)), button('关卡地图', showLevels)]); publish();
  }
  function dispose() {
    if (disposed) return;
    releaseAll(); disposed = true; abort.abort();
    if (Q) { Q.disposed = true; Q.pauseGame(); Q.clearStages(); }
    for (const request of requests) request.abort(); requests.clear();
    for (const img of images) { img.onload = img.onerror = null; img.src = ''; } images.clear();
    resize.disconnect(); delete window.__healRead; delete window.HealBridge;
  }
  const listen = (target, name, fn, options = {}) => target.addEventListener(name, fn, { ...options, signal: abort.signal });
  listen(window, 'message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.source !== 'playgarden-host' || event.data.session !== session) return;
    if (event.data.type === 'host-ready') {
      hostConnected = true; hostPaused = !!event.data.paused;
      initializeView(); applyPause(); announceReady();
    }
    if (event.data.type === 'dispose') dispose();
    if (event.data.type === 'pause') { const wasPaused = hostPaused; hostPaused = !!event.data.paused; if (wasPaused && !hostPaused) localPaused = false; applyPause(); }
    if (event.data.type === 'hint') { currentHint = '拿到钥匙后接触门，再按跳跃进入。治愈人数决定星级；感染形态可跳出地图恢复。'; if (ready) updateHud(); }
  });
  listen(window, 'pagehide', dispose);
  listen(window, 'blur', () => { releaseAll(); if (phase === 'playing') { localPaused = true; applyPause(); } });
  listen(document, 'visibilitychange', () => { releaseAll(); if (document.hidden && phase === 'playing') localPaused = true; applyPause(); });
  const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'action', KeyW: 'action', KeyX: 'action', Space: 'fire', KeyZ: 'fire' };
  listen(document, 'keydown', event => {
    if (event.code === 'KeyP' || event.code === 'Escape') { if (phase === 'playing' && !event.repeat) { event.preventDefault(); localPaused = !localPaused; applyPause(); } return; }
    const action = keyMap[event.code]; if (!action || phase !== 'playing') return;
    event.preventDefault(); if (!event.repeat) input('key:' + event.code, action, true);
  });
  listen(document, 'keyup', event => { const action = keyMap[event.code]; if (action) { if (phase === 'playing') event.preventDefault(); input('key:' + event.code, action, false); } });
  for (const el of document.querySelectorAll('[data-input]')) {
    listen(el, 'pointerdown', event => { event.preventDefault(); el.setPointerCapture(event.pointerId); input('pointer:' + event.pointerId, el.dataset.input, true); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(el, name, event => input('pointer:' + event.pointerId, el.dataset.input, false));
    listen(el, 'contextmenu', event => event.preventDefault());
  }
  listen($('pause'), 'click', () => { localPaused = !localPaused; applyPause(); });
  listen($('resume'), 'click', () => { localPaused = false; applyPause(); $('heal-canvas').focus({ preventScroll: true }); });
  listen($('retry'), 'click', () => start(screenNumber));
  listen($('levels'), 'click', showLevels);
  const resize = new ResizeObserver(() => { if (!disposed) send('height', { height: Math.ceil($('game').getBoundingClientRect().height) + 1 }); });
  resize.observe($('game'));
  window.__healRead = read;
  window.HealBridge = {
    storage,
    setup(engine) {
      Q = engine; Q.el = $('heal-canvas'); Q.ctx = Q.el.getContext('2d');
      Q.width = 960; Q.height = 640; Q.cssWidth = 960; Q.cssHeight = 640;
      Q.input.touchControls = Q.input.disableTouchControls = () => Q.input;
      Q.loadAssetImage = (key, src, callback, failure) => {
        if (!/^(characters|items|hud|others|bullet|map_tiles|gradient-top)\.png$/.test(src)) { failure(); return; }
        const img = new Image(); images.add(img);
        img.onload = () => { images.delete(img); if (!disposed) callback(key, img); };
        img.onerror = () => { images.delete(img); if (!disposed) failure(); };
        img.src = './images/' + src;
      };
      Q.loadAssetOther = (key, src, callback, failure) => {
        if (!/^(level[1-6]\.tmx|(characters|items|hud|others|bullet)\.json)$/.test(src)) { failure(); return; }
        const request = new XMLHttpRequest(); requests.add(request);
        request.open('GET', './data/' + src); request.timeout = 20000;
        request.onload = () => { requests.delete(request); if (disposed) return; if (request.status !== 200) { failure(); return; } try { callback(key, src.endsWith('.json') ? JSON.parse(request.responseText) : request.responseText); } catch { failure(); } };
        request.onerror = request.ontimeout = () => { requests.delete(request); if (!disposed) failure(); };
        request.send();
      };
      const originalLoop = Q.stageGameLoop;
      Q.stageGameLoop = function(dt) {
        if (disposed || paused() || phase !== 'playing') return;
        if (Q.inputs.fire) Q.input.trigger('fire');
        originalLoop.call(Q, dt); playedTime += dt;
        lastSnapshotTime += dt;
        if (lastSnapshotTime >= .1) { lastSnapshotTime = 0; updateHud(); }
      };
    },
    ready(instance) {
      if (disposed) return;
      game = instance; ready = true;
      Q.scene('hud', () => {});
      const messages = { intro: '找到钥匙，打开出口；用治愈弹帮助感染者。', keyNeeded: '需要先找到钥匙。', doorOpen: '门已打开，按跳跃进入出口。', gunFound: '拿到治愈枪！空格、Z 或治愈弹按钮发射。', outOfBullets: '治愈弹用完了，继续寻找钥匙和出口。', keyFound: '找到钥匙了，接下来寻找出口。', clear: '', lifeLevelLow: '只剩一条生命，留意落脚点。', extraLifeFound: '生命增加了！', lifeLost: '失去了一条生命。', zombieModeOn: '被感染了，正在转换形态…', zombieModeOnNext: '跳出地图，恢复人类形态', zombieModeOff: '恢复人类形态，继续寻找出口。' };
      game.infoLabel = Object.fromEntries(Object.entries(messages).map(([name, value]) => [name, () => { currentHint = value; $('hint').textContent = value; }]));
      game.playerAvatar = { changeToZombie() {}, changeToPlayer() {} }; game.healthImg = { changeToHalf() {} };
      game.stageEndLevelScreen = finished; game.stageGameOverScreen = gameOver; game.stageLevelSelectScreen = showLevels; game.stageStartScreen = showTitle; game.stageControlsScreen = showControls; game.stageEndScreen = showEnd;
      $('loading').hidden = true;
      initializeView(); announceReady();
      delete window.HealBridge;
    },
    progress(loaded, total) { if (!disposed) $('loading').textContent = `正在准备六关旅程… ${loaded}/${total}`; },
    error(message) { if (!disposed) { $('error').hidden = false; $('error').textContent = message; send('error', { message }); } }
  };
})();
