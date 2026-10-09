#!/usr/bin/env python3
"""Reproducible local adaptation of audited Coil source; never runs upstream code."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[2]
source = root / 'vendor/coil-original/upstream/js/coil.js'
text = source.read_text()

def function(name, replacement):
    global text
    start = text.index('\tfunction ' + name + '(')
    # All upstream top-level functions close at one tab; nested blocks use two.
    end = text.index('\n\t}', start) + len('\n\t}')
    text = text[:start] + replacement + text[end:]

text = text.replace('var DEBUG = URLUtil.queryValue(\'debug\') == \'1\';', 'var DEBUG = false;')
text = text.replace('\t\tENEMY_SIZE = 10;', '\tvar ENEMY_SIZE = 10;')
text = text.replace("\t\tSTATE_WINNER = 'winner';", "\tvar STATE_WINNER = 'winner';")
text = text.replace('\tinitialize();', '''\treturn {
        initialize: initialize,
        start: start,
        reset: reset,
        setPaused: setPaused,
        snapshot: snapshot,
        dispose: dispose
    };''')
for name in ['activate3dEffects', 'disable3dEffects', 'showLagWarning', 'renderEffects', 'updateEffects', 'renderHeader', 'onLagWarningButtonClick', 'onDocumentMouseDownHandler', 'onDocumentMouseMoveHandler', 'onDocumentMouseUpHandler', 'onCanvasTouchStartHandler', 'onCanvasTouchMoveHandler', 'onCanvasTouchEndHandler']:
    function(name, '')

function('initialize', '''\tfunction initialize() {
        if (initialized || disposed) return;
        initialized = true;
        container = document.querySelector('#game');
        menu = document.querySelector('#menu');
        canvas = document.querySelector('#world');
        scorePanel = document.querySelector('#score');
        startButton = document.querySelector('#start-button');
        context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('当前浏览器未能开启 Canvas 2D。');
        listen(startButton, 'click', onStartButtonClick);
        listen(document.querySelector('#pause-button'), 'click', toggleLocalPause);
        listen(canvas, 'pointerdown', pointerDown);
        listen(canvas, 'pointermove', pointerMove);
        listen(canvas, 'pointerup', pointerEnd);
        listen(canvas, 'pointercancel', pointerEnd);
        listen(canvas, 'lostpointercapture', clearInput);
        listen(canvas, 'keydown', keyDown);
        listen(window, 'keyup', keyUp);
        listen(canvas, 'blur', clearInput);
        listen(window, 'blur', onBlur);
        listen(document, 'visibilitychange', visibilityChanged);
        listen(window, 'pagehide', pageHidden);
        listen(window, 'pageshow', pageShown);
        resizeObserver = new ResizeObserver(onWindowResizeHandler);
        resizeObserver.observe(container);
        onWindowResizeHandler();
        mouse.x = world.width / 2;
        mouse.y = world.height / 2;
        createSprites();
        reset();
        publish(true);
        raf = requestAnimationFrame(loop);
    }''')
function('start', '''\tfunction start() {
        if (disposed || hostPaused || document.hidden) return;
        localPaused = false;
        reset();
        timeStart = Date.now();
        timeLastFrame = timeStart;
        timeLastSecond = timeStart;
        framesThisSecond = 0;
        fps = 0;
        fpsMin = 1000;
        fpsMax = 0;
        playing = true;
        menu.hidden = true;
        scorePanel.hidden = true;
        document.body.dataset.phase = 'playing';
        canvas.focus({ preventScroll: true });
        status('围住蓝色圆点，避开带叉号的红色炸弹。');
        publish(true);
    }''')
function('stop', '''\tfunction stop() {
        playing = false;
        clearInput();
        scorePanel.hidden = false;
        scorePanel.querySelector('strong').textContent = Math.floor(score);
        menu.hidden = false;
        startButton.textContent = '再来一局';
        document.body.dataset.phase = 'lost';
        persist(true);
        status('能量耗尽。本局 ' + Math.floor(score) + ' 分，圈住 ' + captures + ' 颗蓝球。');
        publish(true);
    }''')
text = text.replace('\t\tplayer = new Player();', '''        clearInput();
        if (context) context.clearRect(0, 0, world.width, world.height);
        captures = 0;
        bombsCaught = 0;
        expired = 0;
        lastEvent = '';
        runRecorded = false;
        document.body.dataset.phase = 'welcome';
        if (menu) menu.hidden = false;
        if (scorePanel) scorePanel.hidden = true;
        dirtyRegions = [];
\t\tplayer = new Player();''')
text = text.replace('\t\trequestAnimFrame( update );', '\t\tpublish(false);')
text = text.replace('''\t\tif( effectsEnabled ) {
\t\t\tupdateEffects();
\t\t\t
\t\t\tif (frameCount % 2 == 0) {
\t\t\t\trenderEffects();
\t\t\t}
\t\t}''', '')
text = text.replace('''\t\tif( score !== 0 ) {
\t\t\trenderHeader();
\t\t}''', '')
text = text.replace('''\t\tif( frameCount > FRAMERATE * 6 && Math.round( ( fpsMin + fpsMax + fps ) / 3 ) < 30 ) {
\t\t\tshowLagWarning();
\t\t}''', '')
# Shape labels render in an independent DOM layer. The cyan capture bitmap is untouched.
text = text.replace('function handleEnemyDeath( entity ) {', "function handleEnemyDeath( entity ) {\n        expired++;\n        lastEvent = 'blue-expired';")
text = text.replace('function handleEnemyInClosure( entity ) {', "function handleEnemyInClosure( entity ) {\n        captures++;\n        lastEvent = 'blue-captured';")
text = text.replace('function handleBombInClosure( entity ) {', "function handleBombInClosure( entity ) {\n        bombsCaught++;\n        lastEvent = 'bomb-captured';")
function('onWindowResizeHandler', '''\tfunction onWindowResizeHandler() {
        var width = Math.max(240, Math.floor(container.clientWidth));
        var height = Math.max(280, Math.floor(container.clientHeight));
        if (world.width === width && world.height === height && canvas.width === width) return;
        var previous = { width: world.width, height: world.height };
        world.width = width;
        world.height = height;
        canvas.width = width;
        canvas.height = height;
        // Keep logical and bitmap pixels identical: capture reads exact cyan pixels.
        // Resize existing coordinates rather than losing a run on device rotation.
        function rebase(p) { p.x *= width / previous.width; p.y *= height / previous.height; }
        rebase(mouse);
        if (player) { rebase(player); player.trail.forEach(rebase); }
        enemies.forEach(rebase);
        particles.forEach(rebase);
        notifications.forEach(rebase);
        dirtyRegions = [];
        publish(true);
    }''')

adapter = (root / 'scripts/coil/native-adapter-fragment.js').read_text()
text = text.replace('\t/**\n\t * \n\t */\n\tfunction initialize()', adapter + '\n\tfunction initialize()', 1)
text = text.replace('''\t\t\tupdatePlayer();
\t\t\tupdateParticles();''', '''            updateKeyboard();
\t\t\tupdatePlayer();
            if (!playing) { context.restore(); publish(true); return; }
\t\t\tupdateParticles();''')
text = text.replace(''' * @author Hakim El Hattab (http://hakim.se)
 */''', ''' * @author Hakim El Hattab (http://hakim.se)
 * Upstream ea6fd3afae10a6d8a53b07e82be4211619206ede, MIT (see LICENSE.txt).
 * Playgarden native UI, lifecycle, accessibility and persistence modifications:
 * Copyright (C) 2026 Playgarden contributors, GPL-3.0-only.
 * Editable upstream and reproducible adaptation are retained under vendor/ and scripts/.
 */''')
(root / 'public/coil-original/coil.js').write_text(text)
