// Playgarden's native shell. No third-party runtime dependencies.
var REVISION = 'hextris-3f4847dc-playgarden-1';
var SESSION = new URLSearchParams(location.search).get('session') || '';
var SAVE_KEY = 'playgarden.hextris.original.save.v1';
var RECORD_KEY = 'playgarden.hextris.original.records.v1';
var WAVE_NAMES = ['randomGeneration', 'doubleGeneration', 'crosswiseGeneration', 'spiralGeneration', 'circleGeneration', 'halfCircleGeneration'];
var colors = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71'];
var hexColorsToTintedColors = {'#e74c3c':'rgb(241,163,155)','#f1c40f':'rgb(246,223,133)','#3498db':'rgb(151,201,235)','#2ecc71':'rgb(150,227,183)'};
var rgbColorsToTintedColors = {};
var hexagonBackgroundColor = '#edf2f0';
var angularVelocityConst = 4;
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var trueCanvas = { width: 1, height: 1 };
var settings, MainHex, waveone, blocks = [], score = 0, highscores = [];
var gameState = 0, gdx = 0, gdy = 0, op = 1;
var metrics = newMetrics();
var phase = 'welcome', hasPlayed = false, localPaused = false, hostPaused = false;
var disposed = false, raf = 0, lastTime = 0, lastSnapshot = 0, lastAutosave = 0;
var rush = 1, pressedBoost = new Set(), removers = [], saved = null;
var storageAvailable = true, helpOpen = false, pauseReason = '', staticPainting = false;
var $id = function (id) { return document.getElementById(id); };

function newMetrics() { return { spawned: 0, placed: 0, rotations: 0, cleared: 0, clearEvents: 0, frame: 0 }; }
function post(type, extra) {
    if (parent !== window) parent.postMessage(Object.assign({ source: 'playgarden-hextris', session: SESSION, type: type }, extra || {}), location.origin);
}
function status(message) { $id('message').textContent = message; post('status', { message: message }); }
function listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    removers.push(function () { target.removeEventListener(type, fn, options); });
}
function readStorage(key) {
    try { return localStorage.getItem(key); }
    catch (_) { storageAvailable = false; return null; }
}
function writeStorage(key, data) {
    try { localStorage.setItem(key, data); return true; }
    catch (_) { storageAvailable = false; return false; }
}
function removeStorage(key) {
    try { localStorage.removeItem(key); return true; }
    catch (_) { storageAvailable = false; return false; }
}
function configure(platform) {
    // All gameplay constants are unchanged from upstream initialization.js.
    var mobile = platform === 'mobile';
    settings = { platform: mobile ? 'mobile' : 'nonmobile', baseScale: mobile ? 1.4 : 1,
        startDist: mobile ? 227 : 340, creationDt: mobile ? 60 : 9, scale: 1, prevScale: 1,
        baseHexWidth: 87, hexWidth: 87, baseBlockHeight: 20, blockHeight: 20,
        rows: mobile ? 7 : 8, speedModifier: mobile ? 0.73 : 0.65,
        creationSpeedModifier: mobile ? 0.73 : 0.65, speedUpKeyHeld: false, comboTime: 310 };
}
function preferredPlatform() { return matchMedia('(pointer: coarse)').matches || innerWidth < 600 ? 'mobile' : 'nonmobile'; }
function scaleCanvas() {
    var previousScale = settings.scale;
    var bounds = canvas.getBoundingClientRect();
    trueCanvas = { width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) };
    settings.scale = Math.min(trueCanvas.width, trueCanvas.height) / 800 * settings.baseScale;
    settings.prevScale = settings.scale;
    settings.hexWidth = settings.baseHexWidth * settings.scale;
    settings.blockHeight = settings.baseBlockHeight * settings.scale;
    var ratio = Math.min(devicePixelRatio || 1, 3);
    canvas.width = Math.round(trueCanvas.width * ratio);
    canvas.height = Math.round(trueCanvas.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (MainHex) {
        blocks.concat.apply(blocks.slice(), MainHex.blocks).forEach(function (block) {
            block.distFromHex *= settings.scale / previousScale;
            block.height = settings.blockHeight;
        });
        MainHex.sideLength = settings.hexWidth;
        // A resize updates only geometry; it must not advance paused game state.
        paintStatic();
    }
}
function addNewBlock(blocklane, color, iter, distFromHex, settled) {
    // Original addNewBlock physics; development replay logging was removed.
    iter *= settings.speedModifier;
    blocks.push(new Block(blocklane, color, iter, distFromHex, settled));
    metrics.spawned++;
}
function currentWave() {
    return WAVE_NAMES.find(function (name) { return waveone.currentFunction === waveone[name]; }) || 'randomGeneration';
}
function snapshot() {
    return { phase: phase, paused: isPaused(), score: score, best: highscores[0] || 0,
        highscores: highscores.slice(), logicalTime: MainHex.ct, position: MainHex.position,
        rows: settings.rows, platform: settings.platform, rush: rush,
        comboMultiplier: MainHex.comboMultiplier || 1, comboTime: settings.comboTime,
        lastCombo: MainHex.lastCombo, wave: currentWave(), difficulty: waveone.difficulty,
        nextGen: waveone.nextGen, metrics: Object.assign({}, metrics),
        stacks: MainHex.blocks.map(function (lane) { return lane.map(function (b) { return { color: b.color, deleted: b.deleted, settled: b.settled }; }); }),
        falling: blocks.map(function (b) { return { lane: b.fallingLane, color: b.color,
            distance: b.distFromHex / settings.scale, initializing: b.initializing, settled: b.settled, ict: b.ict }; }),
        hasSave: !!saved, storageAvailable: storageAvailable, helpOpen: helpOpen };
}
function publish() {
    if (disposed) return;
    var state = snapshot();
    document.body.dataset.hextrisState = JSON.stringify(state);
    document.body.dataset.phase = phase;
    document.body.dataset.paused = String(isPaused());
    $id('score').textContent = String(score);
    $id('best').textContent = String(highscores[0] || 0);
    $id('combo').textContent = '×' + String(MainHex.comboMultiplier || 1);
    $id('wave').textContent = ({ randomGeneration: '随机', doubleGeneration: '双列', crosswiseGeneration: '对向', spiralGeneration: '螺旋', circleGeneration: '整环', halfCircleGeneration: '半环' })[currentWave()];
    $id('pause').textContent = localPaused ? '继续' : '暂停';
    $id('pause').disabled = phase !== 'playing' || hostPaused;
    $id('save').disabled = !hasPlayed || phase === 'lost';
    ['left', 'right', 'boost'].forEach(function (id) { $id(id).disabled = phase !== 'playing' || isPaused(); });
    $id('welcome').hidden = phase !== 'welcome';
    $id('lost').hidden = phase !== 'lost';
    $id('pause-cover').hidden = phase !== 'playing' || !isPaused() || helpOpen;
    $id('resume-save').hidden = !saved;
    $id('storage-note').hidden = storageAvailable;
    $id('help-panel').hidden = !helpOpen;
    $id('help').setAttribute('aria-expanded', String(helpOpen));
    $id('best-list').textContent = highscores.length ? highscores.join(' · ') : '还没有记录';
    $id('final-score').textContent = String(score);
    post('snapshot', { state: state });
}
function isPaused() { return hostPaused || localPaused; }
function resetBoost() { pressedBoost.clear(); rush = 1; settings.speedUpKeyHeld = false; }
function setBoost(id, on) {
    if (on && phase === 'playing' && !isPaused()) pressedBoost.add(id);
    else pressedBoost.delete(id);
    settings.speedUpKeyHeld = pressedBoost.size > 0;
    rush = settings.speedUpKeyHeld ? 4 : 1;
    publish();
}
function setPaused(value, fromHost, reason) {
    if (fromHost) {
        hostPaused = value;
        // Moving focus to the host pause button must not add an extra native pause.
        if (value && pauseReason === 'blur') { localPaused = false; pauseReason = ''; }
    } else {
        localPaused = value; pauseReason = value ? (reason || 'manual') : '';
        if (!value) helpOpen = false;
    }
    resetBoost();
    lastTime = performance.now();
    if (isPaused()) {
        cancelAnimationFrame(raf); raf = 0;
        saveGame();
    } else schedule();
    publish();
}
function startFresh() {
    removeStorage(SAVE_KEY); saved = null;
    resetBoost(); configure(preferredPlatform());
    MainHex = null; blocks = []; scaleCanvas();
    MainHex = new Hex(settings.hexWidth);
    MainHex.comboMultiplier = 1;
    MainHex.delay = 15;
    waveone = new waveGen(MainHex);
    score = 0; metrics = newMetrics(); hasPlayed = true;
    phase = 'playing'; gameState = 1; localPaused = false; pauseReason = ''; helpOpen = false;
    lastTime = performance.now(); lastAutosave = 0; lastSnapshot = 0;
    paintStatic(); publish(); schedule();
    status('左右旋转接住彩块；相邻同色 3 块起消除。按住下键或“加速”可四倍加速。');
    canvas.focus({ preventScroll: true });
}
function finishGame() {
    phase = 'lost'; gameState = 2; resetBoost();
    if (highscores.indexOf(score) === -1) highscores.push(score);
    highscores.sort(function (a, b) { return b - a; });
    highscores = highscores.slice(0, 3);
    writeStorage(RECORD_KEY, JSON.stringify({ version: 1, scores: highscores }));
    removeStorage(SAVE_KEY); saved = null;
    status('彩块超出外环，本局结束。得分 ' + score + '，可以再来一局。');
    publish();
}
function schedule() {
    if (!disposed && !raf && phase === 'playing' && !isPaused()) raf = requestAnimationFrame(tick);
}
function tick(now) {
    raf = 0;
    if (disposed || phase !== 'playing' || isPaused()) return;
    // Keep original 60 Hz physics and 4× rush. Bound only discontinuities (tab suspension).
    var dt = Math.min(Math.max(0, now - lastTime), 50) / 16.666 * rush;
    lastTime = now;
    render();
    if (!MainHex.delay) update(dt); else MainHex.delay--;
    metrics.frame++;
    if (isInfringing(MainHex)) { finishGame(); return; }
    if (now - lastAutosave > 3000) { saveGame(); lastAutosave = now; }
    if (now - lastSnapshot > 80) { publish(); lastSnapshot = now; }
    schedule();
}
function paintStatic() {
    // Upstream draw methods animate. Preserve all their state on an out-of-loop repaint.
    var objects = [MainHex].concat(blocks).concat.apply([MainHex].concat(blocks), MainHex.blocks).concat(MainHex.texts);
    var copies = objects.map(function (obj) {
        var copy = {};
        Object.keys(obj).forEach(function (key) { if (typeof obj[key] !== 'function') copy[key] = Array.isArray(obj[key]) ? obj[key].slice() : obj[key]; });
        return copy;
    });
    var oldGdx = gdx, oldGdy = gdy;
    var oldDt = MainHex.dt;
    MainHex.dt = 0; staticPainting = true;
    render();
    staticPainting = false;
    objects.forEach(function (obj, i) { Object.keys(copies[i]).forEach(function (key) { obj[key] = copies[i][key]; }); });
    MainHex.dt = oldDt; gdx = oldGdx; gdy = oldGdy;
}

// Strict, versioned plain-data storage. Constructor methods always come from this source.
var BLOCK_NUMBERS = ['fallingLane','iter','distFromHex','settled','angle','angularVelocity','targetAngle','deleted','removed','tint','opacity','initializing','ict','initLen','attachedLane','checked'];
var HEX_NUMBERS = ['ct','dt','position','angle','targetAngle','angularVelocity','lastCombo','comboMultiplier','playThrough','delay'];
var WAVE_NUMBERS = ['lastGen','last','nextGen','start','ct','difficulty','dt'];
function numeric(value, min, max, integer) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exactKeys(value, keys) { return plain(value) && Object.keys(value).length === keys.length && keys.every(function (key) { return Object.prototype.hasOwnProperty.call(value, key); }); }
function pickNumbers(object, names) { var result = {}; names.forEach(function (name) { result[name] = object[name] || 0; }); return result; }
function blockData(block) {
    var data = pickNumbers(block, BLOCK_NUMBERS);
    data.distFromHex /= settings.scale; data.color = block.color;
    return data;
}
function validateBlock(block, attached) {
    if (!exactKeys(block, BLOCK_NUMBERS.concat(['color'])) || colors.indexOf(block.color) === -1) return false;
    if (!BLOCK_NUMBERS.every(function (key) { return numeric(block[key], -1e10, 1e12, false); })) return false;
    if (!['fallingLane','attachedLane'].every(function (key) { return numeric(block[key], 0, 5, true); })) return false;
    if (!['settled','removed','initializing','checked'].every(function (key) { return numeric(block[key], 0, 1, true); })) return false;
    return numeric(block.deleted, 0, 2, true) && numeric(block.opacity, 0, 1, false) && numeric(block.tint, 0, 1, false) &&
        numeric(block.iter, 0, 100, false) && numeric(block.distFromHex, 0, 1000, false) &&
        numeric(block.initLen, 1, 60, false) && numeric(block.ict, 0, 1e12, false) && (!attached || block.removed === 1);
}
function validateSave(data) {
    if (!exactKeys(data, ['version','platform','score','comboTime','hex','blocks','wave','metrics']) || data.version !== 1 ||
        ['mobile','nonmobile'].indexOf(data.platform) === -1 || !numeric(data.score, 0, Number.MAX_SAFE_INTEGER, true) ||
        !numeric(data.comboTime, 1, 1e7, false)) return false;
    if (!exactKeys(data.hex, HEX_NUMBERS.concat(['lastColorScored','blocks'])) || !HEX_NUMBERS.every(function (key) { return numeric(data.hex[key], -1e10, 1e12, false); }) ||
        !numeric(data.hex.position, 0, 5, true) || !numeric(data.hex.dt, 0, 12.1, false) || !numeric(data.hex.ct, 0, 1e12, false) || !numeric(data.hex.comboMultiplier, 1, 1e8, true) ||
        !numeric(data.hex.delay, 0, 15, true) || !numeric(data.hex.playThrough, 0, 1e9, true) ||
        colors.concat(['#000']).indexOf(data.hex.lastColorScored) === -1 || !Array.isArray(data.hex.blocks) || data.hex.blocks.length !== 6) return false;
    if (!data.hex.blocks.every(function (lane, i) { return Array.isArray(lane) && lane.length <= 20 && lane.every(function (b) { return validateBlock(b, true) && b.attachedLane === i; }); })) return false;
    if (!Array.isArray(data.blocks) || data.blocks.length > 64 || !data.blocks.every(function (b) { return validateBlock(b, false) && b.removed === 0 && b.settled === 0; })) return false;
    if (!exactKeys(data.wave, WAVE_NUMBERS.concat(['pattern'])) || !WAVE_NUMBERS.every(function (key) { return numeric(data.wave[key], 0, 1e14, false); }) ||
        !numeric(data.wave.nextGen, 500, 2700, false) || !numeric(data.wave.difficulty, 1, 36, false) || WAVE_NAMES.indexOf(data.wave.pattern) === -1) return false;
    // Spiral uses ct as a lane index; only crosswise legitimately advances by 1.5.
    if (!Number.isInteger(data.wave.pattern === 'crosswiseGeneration' ? data.wave.ct / 1.5 : data.wave.ct)) return false;
    return exactKeys(data.metrics, Object.keys(newMetrics())) && Object.keys(data.metrics).every(function (key) { return numeric(data.metrics[key], 0, Number.MAX_SAFE_INTEGER, true); });
}
function exportSaveState() {
    var hex = pickNumbers(MainHex, HEX_NUMBERS);
    hex.lastColorScored = MainHex.lastColorScored;
    // Keep deletion flags so the original update removes faded blocks and drops blocks above them.
    hex.blocks = MainHex.blocks.map(function (lane) { return lane.map(blockData); });
    var wave = pickNumbers(waveone, WAVE_NUMBERS); wave.pattern = currentWave();
    return { version: 1, platform: settings.platform, score: score, comboTime: settings.comboTime,
        hex: hex, blocks: blocks.filter(function (b) { return !b.removed && !b.settled; }).map(blockData),
        wave: wave, metrics: Object.assign({}, metrics) };
}
function saveGame() {
    if (!hasPlayed || phase !== 'playing' || disposed || staticPainting) return false;
    var state = exportSaveState();
    if (!validateSave(state)) return false;
    if (writeStorage(SAVE_KEY, JSON.stringify(state))) { saved = state; return true; }
    return false;
}
function readSavedGame() {
    var raw = readStorage(SAVE_KEY);
    if (!raw) return null;
    try {
        if (raw.length > 150000) throw new Error('size');
        var data = JSON.parse(raw);
        if (validateSave(data)) return data;
    } catch (_) { /* Invalid saves are never executed or partially restored. */ }
    removeStorage(SAVE_KEY);
    status('旧存档无效，已安全跳过；可以开始新局。');
    return null;
}
function restoreBlock(data) {
    var block = new Block(data.fallingLane, data.color, data.iter);
    BLOCK_NUMBERS.forEach(function (key) { block[key] = data[key]; });
    block.distFromHex *= settings.scale;
    block.height = settings.blockHeight;
    return block;
}
function resumeSavedGame() {
    if (!saved || !validateSave(saved)) return;
    var data = saved;
    configure(data.platform); MainHex = null; blocks = []; scaleCanvas();
    MainHex = new Hex(settings.hexWidth);
    HEX_NUMBERS.forEach(function (key) { MainHex[key] = data.hex[key]; });
    MainHex.lastColorScored = data.hex.lastColorScored;
    MainHex.lastRotate = Date.now() - 100;
    MainHex.playThrough++;
    MainHex.blocks = data.hex.blocks.map(function (lane) { return lane.map(restoreBlock); });
    blocks = data.blocks.map(restoreBlock);
    waveone = new waveGen(MainHex);
    WAVE_NUMBERS.forEach(function (key) { waveone[key] = data.wave[key]; });
    waveone.currentFunction = waveone[data.wave.pattern];
    settings.comboTime = data.comboTime;
    score = data.score; metrics = Object.assign({}, data.metrics);
    hasPlayed = true; phase = 'playing'; gameState = 1; localPaused = false; pauseReason = ''; helpOpen = false;
    resetBoost(); lastTime = performance.now(); lastAutosave = lastTime;
    paintStatic(); publish(); schedule(); status('已恢复本机存档，继续守住六边形。');
    canvas.focus({ preventScroll: true });
}
function loadRecords() {
    try {
        var raw = readStorage(RECORD_KEY);
        if (!raw || raw.length > 256) return;
        var data = JSON.parse(raw);
        if (exactKeys(data, ['version','scores']) && data.version === 1 && Array.isArray(data.scores) && data.scores.length <= 3 &&
            data.scores.every(function (n) { return numeric(n, 0, Number.MAX_SAFE_INTEGER, true); })) {
            highscores = Array.from(new Set(data.scores)).sort(function (a, b) { return b - a; });
        }
    } catch (_) { highscores = []; }
}
function rotate(steps) {
    if (phase !== 'playing' || isPaused()) return;
    MainHex.rotate(steps); publish();
}
function toggleHelp() {
    helpOpen = !helpOpen;
    if (helpOpen && phase === 'playing') setPaused(true, false);
    publish();
}
function dispose() {
    if (disposed) return;
    saveGame(); resetBoost(); cancelAnimationFrame(raf); raf = 0;
    removers.splice(0).forEach(function (remove) { remove(); });
    disposed = true;
}

configure(preferredPlatform()); scaleCanvas();
MainHex = new Hex(settings.hexWidth); MainHex.comboMultiplier = 1; MainHex.delay = 15;
waveone = new waveGen(MainHex); loadRecords();
if (new URLSearchParams(location.search).get('fresh') === '1') removeStorage(SAVE_KEY);
else saved = readSavedGame();
paintStatic();
listen($id('start'), 'click', startFresh);
listen($id('restart'), 'click', startFresh);
listen($id('resume-save'), 'click', resumeSavedGame);
listen($id('pause'), 'click', function () { setPaused(!localPaused, false); });
listen($id('resume'), 'click', function () { if (!hostPaused) setPaused(false, false); });
listen($id('help'), 'click', toggleHelp);
listen($id('close-help'), 'click', toggleHelp);
listen($id('save'), 'click', function () {
    setPaused(true, false);
    status(saveGame() ? '进度已保存到本机。返回大厅或刷新后，选择“继续存档”即可接着玩。' : '浏览器未能保存进度；仍可继续当前游戏。');
    publish();
});
listen($id('left'), 'click', function () { rotate(1); });
listen($id('right'), 'click', function () { rotate(-1); });
listen($id('boost'), 'pointerdown', function (event) {
    if (phase !== 'playing' || isPaused()) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setBoost('pointer', true);
});
['pointerup','pointercancel','lostpointercapture'].forEach(function (type) { listen($id('boost'), type, function () { setBoost('pointer', false); }); });
listen(canvas, 'pointerdown', function (event) {
    if (event.button !== 0) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    var bounds = canvas.getBoundingClientRect(); rotate(event.clientX - bounds.left < bounds.width / 2 ? 1 : -1);
});
listen(document, 'keydown', function (event) {
    var key = event.key.toLowerCase();
    if (['arrowleft','arrowright','arrowdown','a','d','s','p','escape',' '].indexOf(key) === -1) return;
    if (key === ' ' && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    if (key === 'arrowleft' || key === 'a') rotate(1);
    if (key === 'arrowright' || key === 'd') rotate(-1);
    if (key === 'arrowdown' || key === 's') setBoost(key, true);
    if (!event.repeat && ['p','escape',' '].indexOf(key) !== -1 && phase === 'playing' && !hostPaused) {
        if (helpOpen) helpOpen = false;
        setPaused(!localPaused, false);
    }
});
listen(document, 'keyup', function (event) { if (['arrowdown','s'].indexOf(event.key.toLowerCase()) !== -1) setBoost(event.key.toLowerCase(), false); });
listen(window, 'blur', function () { if (phase === 'playing' && !hostPaused && !localPaused) setPaused(true, false, 'blur'); else resetBoost(); });
listen(document, 'visibilitychange', function () { if (document.hidden && phase === 'playing' && !localPaused) setPaused(true, false, 'hidden'); });
listen(window, 'resize', function () { scaleCanvas(); publish(); });
listen(window, 'pagehide', function (event) {
    if (event.persisted) { setPaused(true, false, 'hidden'); saveGame(); }
    else dispose();
});
listen(window, 'pageshow', function (event) { if (event.persisted && !disposed) { paintStatic(); publish(); } });
listen(window, 'message', function (event) {
    if (event.source !== parent || event.origin !== location.origin || !event.data || event.data.source !== 'playgarden-host' || event.data.session !== SESSION) return;
    if (event.data.type === 'pause' && typeof event.data.paused === 'boolean') setPaused(event.data.paused, true);
    if (event.data.type === 'hint') { helpOpen = true; if (phase === 'playing') setPaused(true, false); publish(); }
    if (event.data.type === 'dispose') dispose();
});
publish(); post('ready', { revision: REVISION, endless: true });
