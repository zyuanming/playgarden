/* SPDX-License-Identifier: GPL-3.0-only
 * Playgarden adapter, 2026-10-10. Original modules/maps/art remain CC-BY-4.0.
 * The unmodified cleared Phaser/Pixi bundle owns rendering, input and tweens.
 */
var game;
var MonkeyBridge;
(function () {
    'use strict';
    var params = new URLSearchParams(location.search);
    var session = params.get('session') || '';
    var selected = Math.max(1, Math.min(8, Number(params.get('level')) || 1));
    var source = 'playgarden-monkey-rally', revision = 'monkey-rally-79abaad3-playgarden-1';
    var storageKey = 'playgarden.monkey-rally.v1.completed';
    var completed = [], disposed = false, ready = false, generation = 0;
    var scene = 'loading', phase = 'loading', cursor = 0, direction = null, pending = false, pendingScene = null;
    var pauseReasons = { host: false, manual: false, hidden: document.hidden, blur: false };
    var cell = { x: 0, y: 0 }, slideCount = 0, stopCount = 0, toggleCounts = [0, 0, 0];
    var C = MouseGame.Commands.prototype, M = MouseGame.MapLoader.prototype, G = MouseGame.Game.prototype;
    var byId = function (id) { return document.getElementById(id); };
    var arrows = ['↑', '→', '←', '↓'], names = ['向上', '向右', '向左', '向下'];
    var captions = ['Monkey Rally：一只猴子，一整段指令。', '实验室发生了事故，科学家被火焰困住了！', '训练有素的猴子们纷纷逃走。', '猴子们一个接一个离开。', '留下来的越来越少。', '只剩两只了。', '最后一只还没有离开。', '大家都走了，只有它留下。', '一只猴子。', '你只能给它一整段方向指令。', '带上药剂，救出科学家！'];
    var introIndex = 0;
    try {
        var saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (Array.isArray(saved)) completed = Array.from(new Set(saved.filter(function (n) { return Number.isInteger(n) && n >= 1 && n <= 8; })));
    } catch (_) { /* In-memory progress remains available when storage is blocked. */ }

    function send(type, data) {
        if (!disposed) parent.postMessage(Object.assign({ source: source, session: session, type: type }, data || {}), location.origin);
    }
    function caption(message) { byId('caption').textContent = message; send('status', { message: message }); }
    function paused() {
        // The host focuses its victory action after an earned completion. That
        // blurs this iframe, but must leave its Next/Reset controls reachable
        // and allow the final deferred ending to render. Both states are idle;
        // blur still freezes every live attempt, including its celebration.
        var completedScene = phase === 'won' || scene === 'ending';
        return pauseReasons.host || pauseReasons.manual || pauseReasons.hidden || (pauseReasons.blur && !completedScene);
    }
    function read() {
        var mouse = G.mouse, doors = [];
        if (scene === 'game' && M.group) M.group.forEach(function (item) {
            if ([90, 110, 130, 900, 1100, 1300].indexOf(item.name) !== -1) doors.push({ x: Math.floor(item.x / 64), y: Math.floor(item.y / 64), code: item.name, open: !item.alive });
        });
        return { scene: scene, phase: phase, level: selected, paused: paused(), cursor: cursor, direction: direction,
            queue: C.orders.map(function (order) { return order.spriteNumber; }), cell: { x: cell.x, y: cell.y },
            player: scene === 'game' && mouse ? { x: mouse.x, y: mouse.y, scaleX: mouse.scale.x, scaleY: mouse.scale.y, angle: mouse.angle } : null,
            doors: doors, slideCount: slideCount, stopCount: stopCount, toggleCounts: toggleCounts.slice(), completed: completed.slice(), introIndex: introIndex };
    }
    // Read-only snapshots for accessibility/targeted browser evidence. No setter or win hook.
    Object.defineProperty(window, '__monkeyRead', { value: read, writable: false, configurable: false });
    MonkeyBridge = { completed: function (level) { return completed.indexOf(level) !== -1; } };
    function snapshot() { send('snapshot', { state: read() }); }
    function cancel() {
        generation += 1; pending = false; pendingScene = null; direction = null; C.isPlaying = false;
        if (game && game.tweens) {
            // Phaser 1.1.3 removeAll omits pending additions. Mark active objects and
            // discard pending ones, while preserving the manager's live update array.
            game.tweens.getAll().concat(game.tweens._add).forEach(function (tween) { tween.stop(); tween.pendingDelete = true; });
            game.tweens._add.length = 0;
        }
    }
    function valid(token) { return !disposed && token === generation && scene === 'game'; }
    function applyPause() {
        var value = paused(); G.gamePaused = value;
        if (game && game.isBooted) { game.input.disabled = value; game.paused = value; }
        byId('pause-cover').hidden = !value;
        byId('pause').textContent = pauseReasons.manual ? '继续' : '暂停';
        byId('pause').disabled = pauseReasons.host;
        byId('stage').style.pointerEvents = value ? 'none' : 'auto';
        renderControls(); snapshot();
    }
    function setPause(reason, value) { pauseReasons[reason] = Boolean(value); applyPause(); }
    function resize() {
        if (disposed) return;
        if (game && game.isBooted && game.canvas) {
            var bounds = game.canvas.getBoundingClientRect();
            if (bounds.width && bounds.height) game.input.scale.setTo(1280 / bounds.width, 720 / bounds.height);
            Phaser.Canvas.getOffset(game.canvas, game.stage.offset);
        }
        send('height', { height: document.documentElement.scrollHeight });
    }
    var observer = new ResizeObserver(resize); observer.observe(byId('app')); observer.observe(byId('stage-wrap'));
    function route(next) {
        if (disposed || paused()) return;
        cancel(); game.state.start(next, true, false);
    }
    function requestLevel(level) {
        if (paused() || !Number.isInteger(level) || level < 1 || level > 8) return;
        if (level === selected) { route('game'); return; }
        cancel(); phase = 'navigation'; caption('正在切换关卡…'); renderControls();
        // Never start another stage before the host owns its zero-based selection.
        send('navigate', { level: level });
    }
    function button(label, action) {
        var node = document.createElement('button'); node.textContent = label; node.addEventListener('click', action); byId('scene-controls').appendChild(node); return node;
    }
    function renderScene() {
        byId('scene-controls').replaceChildren();
        if (scene === 'mainmenu') {
            button('开始第 ' + selected + ' 关', function () { requestLevel(selected); });
            button('原作署名', function () { route('credits'); });
        } else if (scene === 'levelselector') {
            for (var n = 1; n <= 8; n++) (function (level) { button('开始第 ' + level + ' 关' + (MonkeyBridge.completed(level) ? ' ✓' : ''), function () { requestLevel(level); }); })(n);
        } else if (scene === 'intro') button('下一幅故事', function () { game.state.states.intro.nextSlide(); });
        else if (scene === 'ending') button('返回原作菜单', function () { route('mainmenu'); });
        else if (scene === 'credits') button('返回原作菜单', function () { route('mainmenu'); });
        if (phase === 'won' && selected < 8) button('前往下一关', function () { requestLevel(selected + 1); });
        renderControls(); resize(); snapshot();
    }
    function renderControls() {
        var editing = scene === 'game' && phase === 'editing' && !paused();
        byId('controls').hidden = scene !== 'game';
        document.querySelectorAll('[data-direction]').forEach(function (node) { node.disabled = !editing; });
        byId('play').disabled = !editing || !C.orders.length;
        byId('stop').disabled = scene !== 'game' || paused();
        byId('reset').disabled = scene !== 'game' || paused();
        document.querySelectorAll('#scene-controls button').forEach(function (node) { node.disabled = paused(); });
        ['menu', 'story', 'levels'].forEach(function (id) { byId(id).disabled = paused(); });
        var list = byId('queue'); list.replaceChildren();
        C.orders.forEach(function (order, index) {
            var li = document.createElement('li'), node = document.createElement('button');
            node.textContent = (index + 1) + ' ' + arrows[order.spriteNumber];
            node.setAttribute('aria-label', '删除第 ' + (index + 1) + ' 条' + names[order.spriteNumber] + '指令');
            node.dataset.consumed = String(index < cursor); node.disabled = !editing;
            node.addEventListener('click', function () { C.onOrderClick(order); }); li.appendChild(node); list.appendChild(li);
        });
        resize();
    }
    var originalRender = C.renderOrders, originalAdd = C.onTileClick, originalRemove = C.onOrderClick;
    C.renderOrders = function () {
        originalRender.call(C);
        C.orders.forEach(function (order, index) { order.visible = index < 69; });
        renderControls(); snapshot();
    };
    C.onTileClick = function (item) { if (scene === 'game' && phase === 'editing' && !paused()) originalAdd.call(C, item); };
    C.onOrderClick = function (item) { if (scene === 'game' && phase === 'editing' && !paused()) originalRemove.call(C, item); };
    C.stopButton = function () {
        if (scene !== 'game' || paused()) return;
        cancel(); C.resetDoors(90, 229, 900); C.resetDoors(110, 230, 1100); C.resetDoors(130, 231, 1300);
        M.parseEntities(); cursor = 0; phase = 'editing'; slideCount = 0; stopCount = 0; toggleCounts = [0, 0, 0];
        cell = { x: Math.floor(G.mouse.x / 64), y: Math.floor(G.mouse.y / 64) };
        C.orders.forEach(function (order) { order.inactive = false; });
        C.goButton.setFrames(20, 21, 22); C.renderOrders(); renderScene(); caption('已复位；指令序列保留，可以修改后重试。');
    };
    C.resetLevel = function () {
        if (scene !== 'game' || paused()) return;
        C.stopButton(); C.orders.forEach(function (order) { order.destroy(); }); C.orders = []; C.renderOrders(); caption('指令已清空，猴子和所有门已复位。');
    };
    C.playLevel = function () {
        if (scene !== 'game' || paused()) return;
        if (phase !== 'editing') { C.stopButton(); return; }
        if (!C.orders.length) return;
        generation += 1; phase = 'running'; C.isPlaying = true; cursor = 0; pending = true;
        C.goButton.setFrames(22, 22, 22); caption('正在执行整段路线…'); C.renderOrders();
    };
    C.executeOrder = function () { if (phase === 'running') pending = true; };
    function finishSequence() { phase = 'finished'; C.isPlaying = false; direction = null; caption('序列已结束，还没有到达科学家。停止可保留序列并复位。'); C.renderOrders(); }
    function fail(message, fall) {
        pending = false; phase = 'failed'; C.isPlaying = false; direction = null; caption(message); C.renderOrders();
        if (fall) {
            game.add.tween(G.mouse).to({ angle: -125 }, 1500, Phaser.Easing.Linear.None, true);
            game.add.tween(G.mouse.scale).to({ x: 0, y: 0 }, 1500, Phaser.Easing.Linear.None, true);
        }
    }
    C.moveMouse = function (name) {
        if (phase !== 'running' || paused()) return;
        direction = name;
        var x = cell.x + (name === 'RIGHT' ? 1 : name === 'LEFT' ? -1 : 0);
        var y = cell.y + (name === 'DOWN' ? 1 : name === 'UP' ? -1 : 0);
        // Original visible stage is 1280x720; playable commands stay in the
        // authored 16x9 laboratory above the original queue and side controls.
        // A missing perimeter becomes a visible failed attempt, never a new wall.
        if (x < 0 || x >= 16 || y < 0 || y >= 9) { fail('滑出了实验室边界。停止复位后，调整路线重试。', false); return; }
        var target = M.mapLayer.data[y][x];
        M.map.layers.forEach(function (layer) { if (layer.data[y] && layer.data[y][x] === 6) target = M.TILE_HOLE; });
        if (M.TILE_WALLS.indexOf(target) !== -1) { direction = null; pending = true; return; }
        var token = generation;
        C.mouseTween = game.add.tween(G.mouse).to({ x: x * 64 + 32, y: y * 64 + 32 }, 150, Phaser.Easing.Back.InOut, true)
            .onCompleteCallback(function () {
                if (!valid(token) || phase !== 'running') return;
                cell = { x: x, y: y }; slideCount += 1;
                if (target === 211) { fail('猴子掉进了洞。停止可保留路线，重置可重新编排。', true); return; }
                if (target >= 225 && target <= 227) {
                    var color = target - 225; toggleCounts[color] += 1;
                    C.toggleDoor([90, 110, 130][color], [229, 230, 231][color], [900, 1100, 1300][color]);
                }
                if (target === 203) { C.victoryAnimation(); return; }
                if (target === 212) { stopCount += 1; direction = null; pending = true; }
                else C.moveMouse(name);
                snapshot();
            });
    };
    C.victoryAnimation = function () {
        phase = 'celebrating'; pending = false; direction = null; C.isPlaying = false;
        var token = generation, level = selected;
        game.add.tween(G.mouse.scale).to({ x: 1.1, y: 1.1 }, 150, Phaser.Easing.Back.In, true).to({ x: 1, y: 1 }, 150, Phaser.Easing.Back.Out);
        game.add.tween({ time: 0 }).to({ time: 1 }, 550, Phaser.Easing.Linear.None, true).onCompleteCallback(function () {
            if (!valid(token) || phase !== 'celebrating' || selected !== level) return;
            if (completed.indexOf(level) === -1) completed.push(level);
            try { localStorage.setItem(storageKey, JSON.stringify(completed)); } catch (_) {}
            phase = 'won'; caption('第 ' + level + ' 关救援成功！'); send('complete', { level: level });
            C.renderOrders(); renderScene();
            // StateManager clears TweenManager's array; defer until its current
            // update loop has finished rather than switching inside this callback.
            if (level === 8) pendingScene = 'ending';
        });
        caption('到达科学家，救援成功！'); C.renderOrders();
    };
    C.goToLevelSecletor = function () { route('levelselector'); };
    G.update = function () {
        if (pendingScene && !paused()) { var next = pendingScene; pendingScene = null; route(next); return; }
        if (!pending || phase !== 'running' || paused()) return;
        pending = false;
        if (cursor >= C.orders.length) { finishSequence(); return; }
        var order = C.orders[cursor++]; order.inactive = true;
        // At most one blocked command per engine frame; never recursive.
        C.moveMouse(['UP', 'RIGHT', 'LEFT', 'DOWN'][order.spriteNumber]); C.renderOrders();
    };
    G.togglePause = function () { setPause('manual', !pauseReasons.manual); };
    G.pauseGame = function () { setPause('manual', true); };
    G.unpauseGame = function () { setPause('manual', false); };
    G.quitToMenu = G.returnToMainMenu = function () { route('levelselector'); };
    var originalGameCreate = G.create;
    G.create = function () {
        cancel(); scene = 'game'; phase = 'editing'; cursor = 0; slideCount = 0; stopCount = 0; toggleCounts = [0, 0, 0];
        game.state.states.levelselector.level = 'level' + selected;
        originalGameCreate.call(this);
        cell = { x: Math.floor(G.mouse.x / 64), y: Math.floor(G.mouse.y / 64) };
        // One keyboard owner in the focused iframe; the original Escape listener
        // is removed so pausing does not queue an additional command on resume.
        game.input.keyboard.removeKey(Phaser.Keyboard.ESC);
        caption('第 ' + selected + ' 关：编排方向，带猴子滑到科学家身边。'); renderScene();
        if (!ready) { ready = true; send('ready', { revision: revision, levelCount: 8 }); }
        applyPause();
    };

    // Keep Phaser.Tilemap, TilemapLayer and original entity sprites. Add only
    // Tiled's separate decorative GIDs/objects with Phaser's own sprite renderer.
    // The original loader accidentally treated all sheets as the 64px sheet.
    M.createMap = function () {
        game.stage.backgroundColor = '#000000';
        var mapName = 'level' + selected, raw = game.cache.getTilemapData(mapName).data;
        this.map = game.add.tilemap(mapName); this.tileset = game.add.tileset('tiles'); C.orders = [];
        // Cache layers are shared by Phaser 1.1.3: fresh arrays prevent reentry
        // from retaining door mutations from the previous attempt.
        this.map.layers = Phaser.TilemapParser.parseTiledJSON(raw);
        var layerIndex = 0;
        function decorate(gid, x, bottom, opacity) {
            if (!gid) return;
            var set = raw.tilesets[0];
            raw.tilesets.forEach(function (candidate) { if (candidate.firstgid <= gid) set = candidate; });
            var sprite = game.add.sprite(x, bottom - set.tileheight, 'tiled-' + set.name, gid - set.firstgid);
            sprite.alpha = opacity;
        }
        raw.layers.forEach(function (layer) {
            if (layer.data) {
                var index = layerIndex++;
                if (layer.name === 'entities') { M.mapLayer = M.map.layers[index]; return; }
                game.add.tilemapLayer(0, 0, 1280, 720, M.tileset, M.map, index);
                if (layer.visible !== false) layer.data.forEach(function (gid, i) { if (gid >= 201) decorate(gid, (i % layer.width) * 64, (Math.floor(i / layer.width) + 1) * 64, layer.opacity); });
            } else if (layer.visible !== false) (layer.objects || []).forEach(function (object) { if (object.visible !== false && object.gid) decorate(object.gid, object.x, object.y, layer.opacity); });
        });
        this.group = game.add.group(); this.parseEntities();
    };
    var originalPreload = MouseGame.Preloader.prototype.preload;
    MouseGame.Preloader.prototype.preload = function () {
        originalPreload.call(this);
        var tileSets = { 'new-tiles': ['tiles/new-tiles.png', 64, 64], 'tile-logic': ['tiles/tile-logic.png', 64, 64], decorations: ['tiles/decorations.png', 128, 128], scientist: ['entities/scientist.png', 128, 128], omgfire: ['entities/omgfire.png', 640, 192] };
        ['bottle_blue', 'bottle_green', 'bottle_red', 'bottle_yellow', 'bottle_orange', 'pill', 'key', 'pipette', 'pipetteset'].forEach(function (name) { tileSets[name] = ['entities/' + name + '.png', 64, 64]; });
        Object.keys(tileSets).forEach(function (name) { var set = tileSets[name]; game.load.spritesheet('tiled-' + name, 'assets/' + set[0], set[1], set[2]); });
    };
    MouseGame.Preloader.prototype.create = function () { game.state.states.levelselector.level = 'level' + selected; game.state.start('game'); };
    MouseGame.Preloader.prototype.update = function () {};
    MouseGame.Boot.prototype.create = function () {
        game.input.maxPointers = 1; game.stage.disableVisibilityChange = true; game.stage.scaleMode = Phaser.StageScaleMode.NO_SCALE;
        // Engine pause/resume already owns active tweens. Pending additions need
        // the same exact-time treatment, including a pause before the first tick.
        game.onPause.add(function () { game.tweens._add.forEach(function (t) { if (!t._paused) t.pause(); }); });
        game.onResume.add(function () { game.tweens._add.forEach(function (t) { if (t._paused) t.resume(); }); });
        game.state.start('preloader');
    };
    ['mainmenu', 'credits', 'levelselector', 'intro', 'ending'].forEach(function (name) {
        var klass = { mainmenu: MouseGame.MainMenu, credits: MouseGame.Credits, levelselector: MouseGame.LevelSelector, intro: MouseGame.Intro, ending: MouseGame.Ending }[name];
        var create = klass.prototype.create;
        klass.prototype.create = function () {
            cancel(); scene = name; phase = name; if (name === 'intro') introIndex = 0;
            create.call(this); caption(name === 'intro' ? captions[0] : name === 'ending' ? '八关旅程的原作结局：科学家得救了！' : name === 'credits' ? '代码：Anders Antila。美术：Erik Nahkala、Laura Kantti。图中原作音乐署名保留，本版省略音轨。' : 'Monkey Rally · 原作完整八关'); renderScene();
        };
    });
    MouseGame.LevelSelector.prototype.startGame = function (target) { requestLevel(Number(target.level.slice(5))); };
    MouseGame.MainMenu.prototype.startGame = function () { route('levelselector'); };
    var originalNext = MouseGame.Intro.prototype.nextSlide;
    MouseGame.Intro.prototype.nextSlide = function () { if (paused()) return; originalNext.call(this); if (scene === 'intro') { introIndex = Math.min(10, introIndex + 1); caption(captions[introIndex]); snapshot(); } };

    document.querySelectorAll('[data-direction]').forEach(function (node) { node.addEventListener('click', function () { C.onTileClick({ spriteNumber: Number(node.dataset.direction) }); }); });
    byId('play').addEventListener('click', C.playLevel); byId('stop').addEventListener('click', C.stopButton); byId('reset').addEventListener('click', C.resetLevel);
    byId('menu').addEventListener('click', function () { route('mainmenu'); }); byId('story').addEventListener('click', function () { route('intro'); }); byId('levels').addEventListener('click', function () { route('levelselector'); });
    byId('pause').addEventListener('click', G.togglePause);
    byId('app').addEventListener('keydown', function (event) {
        if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
        var keyMap = { ArrowUp: 0, ArrowRight: 1, ArrowLeft: 2, ArrowDown: 3 };
        if (Object.prototype.hasOwnProperty.call(keyMap, event.key)) { event.preventDefault(); C.onTileClick({ spriteNumber: keyMap[event.key] }); }
        else if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); C.playLevel(); }
        else if (event.key.toLowerCase() === 'p' || event.key === 'Escape') { event.preventDefault(); G.togglePause(); }
    });
    function message(event) {
        if (event.source !== parent || event.origin !== location.origin || event.data?.source !== 'playgarden-host' || event.data.session !== session) return;
        if (event.data.type === 'host-ready') {
            setPause('host', event.data.paused);
            // Idempotent handshake covers cached loads and StrictMode's replayed
            // host effect. An unfinished boot will still announce ready in create.
            if (ready) { send('ready', { revision: revision, levelCount: 8 }); snapshot(); }
        } else if (event.data.type === 'pause') setPause('host', event.data.paused);
        else if (event.data.type === 'dispose') dispose();
        else if (event.data.type === 'hint') caption('每条指令会滑到底；停靠垫提前停车。每次踏上彩色开关，所有同色门都会反转。');
    }
    function visibility() { setPause('hidden', document.hidden); }
    function blur() { setPause('blur', true); }
    function focus() { setPause('blur', false); }
    function dispose() {
        if (disposed) return; cancel(); disposed = true; clearTimeout(startTimer); observer.disconnect();
        window.removeEventListener('message', message); window.removeEventListener('resize', resize); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility);
        if (game && game.isBooted) { game.paused = true; game.destroy(); }
    }
    window.addEventListener('message', message); window.addEventListener('resize', resize); window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', dispose, { once: true });
    window.addEventListener('error', function (event) { send('error', { message: '原作资源或运行发生错误：' + event.message }); });
    var startTimer = setTimeout(function () {
        if (disposed) return;
        game = new Phaser.Game(1280, 720, Phaser.CANVAS, 'stage');
        game.state.add('boot', MouseGame.Boot, true); game.state.add('preloader', MouseGame.Preloader);
        game.state.add('mainmenu', MouseGame.MainMenu); game.state.add('game', MouseGame.Game); game.state.add('credits', MouseGame.Credits);
        game.state.add('levelselector', MouseGame.LevelSelector); game.state.add('intro', MouseGame.Intro); game.state.add('ending', MouseGame.Ending);
    }, 0);
}());
