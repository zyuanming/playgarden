#!/usr/bin/env python3
"""Deterministic, fail-closed patches of audited MIT bundles. No upstream code is executed."""
from pathlib import Path
import hashlib, json, re, shutil
ROOT = Path(__file__).resolve().parents[2]
V = ROOT / 'vendor/crisp-original'
OUT = ROOT / 'public/crisp-original'
patches = []
for source_record in json.loads((V/'source-manifest.json').read_text())['files'] + json.loads((V/'second-games-source-manifest.json').read_text())['files']:
    original_bytes = (V/source_record['dest']).read_bytes()
    assert len(original_bytes) == source_record['expected_bytes']
    assert hashlib.sha256(original_bytes).hexdigest() == source_record['sha256']
def replace(text, old, new, why):
    assert text.count(old) == 1, (why, text.count(old))
    patches.append({'change': why, 'before_sha256': hashlib.sha256(old.encode()).hexdigest(), 'after_sha256': hashlib.sha256(new.encode()).hexdigest()})
    return text.replace(old, new)
def span(text, start, end, new, why):
    a=text.index(start); b=text.index(end,a)
    return replace(text,text[a:b],new,why)
engine=(V/'upstream/engine/docs/bundle.js').read_text()
engine=replace(engine,"    'use strict';", "    'use strict';\n"+(ROOT/'scripts/crisp/engine-lifecycle.js').read_text(), 'Own listeners, inputs, RAF, pause/restart/dispose and read-only state')
engine=replace(engine,'window.addEventListener("resize", setSize);','pgListen(window, "resize", setSize);', 'Track canvas resize listener')
engine=span(engine,'        document.addEventListener("keydown", (e) => {','    function update$6()', '''        pgListen(document, "keydown", (e) => {
            if (!pgCanInput() || !["Space", "Enter"].includes(e.code) || e.repeat) return;
            e.preventDefault();
            const wasDown = isKeyPressing;
            pressingCode[e.code] = pressedCode[e.code] = true;
            isKeyPressing = true;
            if (!wasDown) isKeyPressed = true;
            if (options$3.onKeyDown) options$3.onKeyDown();
        });
        pgListen(document, "keyup", (e) => {
            if (!["Space", "Enter"].includes(e.code)) return;
            e.preventDefault();
            pressingCode[e.code] = false;
            releasedCode[e.code] = true;
            isKeyPressing = Object.values(pressingCode).some(Boolean);
            if (!isKeyPressing) isKeyReleased = true;
        });
    }
''', 'Restrict genuine keyboard input and release independent held keys')
engine=span(engine,'        document.addEventListener("mousedown", (e) => {','    function update$5()', '''        screen.id = "crisp-canvas";
        screen.tabIndex = 0;
        screen.setAttribute("aria-label", "原作游戏画布，按住或松开空格、回车或触摸操作");
        screen.style.touchAction = "none";
        let activePointer = null;
        pgListen(screen, "pointerdown", (e) => {
            if (!pgCanInput() || activePointer !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
            e.preventDefault(); screen.focus(); activePointer = e.pointerId;
            screen.setPointerCapture(e.pointerId);
            onDown(e.pageX, e.pageY);
        });
        pgListen(screen, "pointermove", (e) => {
            if (activePointer !== e.pointerId) return;
            const r = screen.getBoundingClientRect();
            if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
                activePointer = null; onUp();
                if (screen.hasPointerCapture(e.pointerId)) screen.releasePointerCapture(e.pointerId);
                return;
            }
            onMove(e.pageX, e.pageY);
        });
        const release = (e) => {
            if (activePointer !== e.pointerId) return;
            activePointer = null; onUp();
            if (screen.hasPointerCapture(e.pointerId)) screen.releasePointerCapture(e.pointerId);
        };
        pgListen(screen, "pointerup", release);
        pgListen(screen, "pointercancel", release);
        pgListen(screen, "lostpointercapture", release);
        pgListen(screen, "touchcancel", () => { activePointer = null; onUp(); });
        pgInputResets.push(() => {
            const id = activePointer; activePointer = null;
            if (id !== null && screen.hasPointerCapture(id)) screen.releasePointerCapture(id);
        });
    }
''', 'Use real Pointer Events; capture, cancel and leaving canvas release held input')
engine=replace(engine,'init$3(options$1.isSoundEnabled ? sss.startAudio : () => { });','init$3(() => window.__crispAudio.gesture());', 'Resume the owned AudioContext in the actual input gesture')
engine=replace(engine,'        requestAnimationFrame(update$3);','        if (pgDisposed || pgPaused) return;\n        pgRaf = requestAnimationFrame(update$3);', 'Cancellable RAF and full simulation freeze')
engine=replace(engine,'    function initInGame() {','    function initInGame() {\n        pgRuns++;', 'Observe run identity including same-phase restart')
engine=replace(engine,'        _update$1();','        _update$1();\n        pgFrames++;\n        if (window.__crispAfterFrame) window.__crispAfterFrame();', 'Read-only observation after complete original frame')
engine=replace(engine,'            sss.init(seed);','            sss.init(seed, window.__crispAudio.context);', 'Pass the one owned audio context')
engine=replace(engine,'  isSoundEnabled: opts.isSoundEnabled,','  isSoundEnabled: opts.isSoundEnabled,', 'identity guard') if False else engine
engine=replace(engine,'        if (opts.isMinifying) {\n            showMinifiedScript();\n        }','        if (!["simple", "dark"].includes(opts.theme) || opts.isCapturing || opts.isRewindEnabled || opts.isMinifying) throw new Error("Unsupported optional engine mode");\n        if (!window.__crispAudio.context) { isSoundEnabled = false; loopOptions.isSoundEnabled = false; }', 'Reject optional modes that require omitted dependencies; graceful unavailable audio')
engine=span(engine,'    function addGameScript() {','    exports.inp = void 0;', '', 'Remove URL-based script loader and remote debug minifier')
engine=replace(engine,'    exports.addGameScript = addGameScript;\n','', 'Remove loader export')
engine=replace(engine,'    Object.defineProperty(exports, \'__esModule\', { value: true });','    exports.__crispEngine = Object.freeze({ pause: pgPause, release: pgRelease, restart: pgRestart, dispose: pgDispose, snapshot: pgSnapshot });\n    Object.defineProperty(exports, \'__esModule\', { value: true });', 'Publish bounded lifecycle interface, no state setters')
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'engine.js').write_text('// MIT: ABA Games 2019. Playgarden lifecycle modifications, 2026; see LICENSES.txt.\n'+engine)
audio=(V/'upstream/audio/build/index.js').read_text()
audio=replace(audio,'return new AudioContext().sampleRate;','return window.__crispAudio.context ? window.__crispAudio.context.sampleRate : 44100;', 'Remove otherwise leaked jsfx sample-rate AudioContext')
audio=replace(audio,'audioContext = _audioContext == null ? new (window.AudioContext || window.webkitAudioContext)() : _audioContext;','audioContext = _audioContext;\n    if (!audioContext) throw new Error("Managed audio context required");','Remove optional unmanaged AudioContext fallback')
audio=replace(audio,'gainNode.connect(audioContext.destination);','gainNode.connect(window.__crispAudio.destination);','Route every generated and cached voice through controlled master gain')
generator=re.search(r'    function newGenerator\(line\) \{\n      return new Function\("\$", "block", (.+) \+ line \+ (.+)\);\n    \}',audio)
assert generator
prefix=json.loads(generator[1], strict=False); suffix=json.loads(generator[2], strict=False)
matches=list(re.finditer(r'jsfx2\.G\.(\w+) = newGenerator\((".*?")\);',audio))
assert len(matches)==7
for m in matches:
    line=json.loads(m[2])
    literal='jsfx2.G.'+m[1]+' = function ($, block) {\n'+prefix+line+suffix+'};'
    audio=replace(audio,m[0],literal,'Statically expand fixed '+m[1]+' oscillator without dynamic evaluation')
audio=replace(audio,generator[0],'    var __noiseLast = 0;', 'Remove dynamic compiler; explicitly scope original noise sample state')
audio=replace(audio,'      document.location.href = audio.src;','      throw new Error("Audio download is not part of this game");','Disable unused audio navigation helper')
(OUT/'audio.js').write_text('// MIT: ABA Games 2022, Egon Elbre 2017, Nao Yonamine. See LICENSES.txt.\n'+audio)
for game in ['castn','bamboo','parking','pizzaarrow','rps','swingby']:
    dest=OUT/game; dest.mkdir(exist_ok=True)
    shutil.copyfile(V/f'upstream/games/docs/{game}/main.js',dest/'main.js')
    (dest/'index.html').write_text('''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>'''+game+''' 原作</title><link rel="stylesheet" href="../frame.css"></head>
<body><div id="crisp-pause" role="status" hidden>已暂停 · 点击继续或按 P</div><script src="../lifecycle.js"></script><script src="../audio.js"></script><script src="../engine.js"></script><script src="main.js"></script><script src="observe.js"></script><script src="../bridge.js"></script></body></html>
''')
licenses=[]
for label,path in [('Original games','upstream/games/LICENSE.txt'),('crisp-game-lib','upstream/engine/LICENSE.txt'),('sounds-some-sounds','upstream/audio/LICENSE.txt'),('jsfx','third-party/jsfx/LICENSE-MIT')]:
    licenses.append(label+'\n'+'='*60+'\n'+(V/path).read_text())
licenses.append('Modified jsfx attribution, verbatim from original source:\n'+'\n'.join((V/'upstream/audio/lib/jsfx/index.js').read_text().splitlines()[:7]))
licenses.append((OUT/'THIRD-PARTY-NOTICES.md').read_text())
(OUT/'LICENSES.txt').write_text('\n\n'.join(licenses))
(ROOT/'docs/crisp-transform-map.json').write_text(json.dumps({'gameplay':'All six main.js files copied byte-for-byte; no gameplay changes.','patches':patches},ensure_ascii=False,indent=2)+'\n')
print('Prepared original game files and deterministic engine/audio adaptation.')
