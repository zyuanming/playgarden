#!/usr/bin/env python3
"""Reproducibly derive the offline engine from pinned quarantined GPL source."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
UP = ROOT / 'vendor/hextris-original/upstream/js'
OUT = ROOT / 'public/hextris-original'
HEADER = '''// SPDX-License-Identifier: GPL-3.0-or-later
// Hextris, Copyright (C) 2018 Logan Engstrom and contributors.
// Pinned source: 3f4847dc8fd7dab3d1c87e6324b9159d92fbd396.
// Playgarden adaptation (2026): offline native shell, scoped lifecycle and plain-data saves.
// Full original source, modification map and GPL terms accompany this distribution.
(function () {
'''
def read(name):
    return (UP / name).read_text()
def replace_once(text, before, after):
    assert text.count(before) == 1, (before, text.count(before))
    return text.replace(before, after, 1)
parts = []
for name in ['math.js', 'Hex.js', 'Block.js', 'Text.js', 'checking.js', 'comboTimer.js', 'wavegen.js', 'update.js']:
    code = read(name)
    if name == 'Hex.js':
        start = code.index('\t\tif (!history[this.ct])')
        end = code.index('\n\t\twhile (this.position < 0)', start)
        code = code[:start] + '\t\tmetrics.rotations++;\n' + code[end:]
        code = replace_once(code, '\t\tblock.checked = 1;\n\t};', '\t\tblock.checked = 1;\n\t\tmetrics.placed++;\n\t};')
    if name == 'Block.js':
        code = code.replace('localStorage.setItem("saveState", exportSaveState());', 'saveGame();')
        start = code.index('\t\tif (Math.abs(settings.scale - settings.prevScale)')
        end = code.index('\n\n\t\tthis.incrementOpacity();', start)
        code = code[:start] + '\t\t// Viewport scaling is applied once by scaleCanvas, including while paused.\n' + code[end:]
        code = replace_once(code, '\t\twhile (ang < 0) {\n\t\t\tang += 360;\n\t\t}', '\t\t// Constant-time normalization also bounds work for untrusted saved angles.\n\t\tang = ((ang % 360) + 360) % 360;')
    if name == 'checking.js':
        code = replace_once(code, '\tscore += adder;', '\tscore += adder;\n\tmetrics.cleared += deleting.length;\n\tmetrics.clearEvents++;')
    parts.append('// Upstream: js/' + name + '\n' + code)
view = read('view.js')
# Keep the original canvas geometry and text primitives; replace imported-font menu drawings.
view = view[:view.index('function toggleClass')]
start = view.index('function drawScoreboard()')
end = view.index('function clearGameBoard()', start)
view = view[:start] + '''function drawScoreboard() {
    renderText(trueCanvas.width / 2 + gdx, trueCanvas.height / 2 + gdy,
        score >= 1000000 ? 30 : 45, "#ecf0f1", gameState === 0 ? "六向" : String(score));
}

''' + view[end:]
view = view.replace("'px Exo'", "'px system-ui, sans-serif'")
parts.append('// Upstream: js/view.js, canvas primitives retained\n' + view)
render = read('render.js')
render = render[:render.index('function renderBeginningText()')]
# Chinese instructions are persistent semantic HTML, not font-dependent canvas overlays.
start = render.index('\tif ((MainHex.ct < 650')
end = render.index('\n\tsettings.prevScale', start)
render = render[:start] + render[end:]
parts.append('// Upstream: js/render.js, original board renderer\n' + render)
main = read('main.js')
start = main.index('function isInfringing(hex)')
end = main.index('function checkGameOver()', start)
parts.append('// Upstream: js/main.js, exact capacity rule\n' + main[start:end])
expected = HEADER + '\n\n'.join(parts) + '\n\n' + (ROOT / 'scripts/hextris/native-adapter.js').read_text() + '\n})();\n'
if '--check' in sys.argv:
    assert (OUT / 'hextris.js').read_text() == expected, 'Generated runtime is stale'
    print('Generated runtime exactly matches pinned-source transform')
else:
    (OUT / 'hextris.js').write_text(expected)
    print('Generated public/hextris-original/hextris.js')
