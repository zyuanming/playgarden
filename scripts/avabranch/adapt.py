#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Reproduce the small integration edits without executing upstream JavaScript."""
from pathlib import Path
import difflib
import sys

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'vendor/avabranch-original/silent-base'
PUBLIC = ROOT / 'public/avabranch'
check = '--check' in sys.argv
changes = []

def emit(name, text):
    original = (BASE / name).read_text()
    target = PUBLIC / name
    if check:
        assert target.read_text() == text, name
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
    changes.extend(difflib.unified_diff(original.splitlines(True), text.splitlines(True), fromfile='silent-base/' + name, tofile='public/avabranch/' + name))

for name in ['player', 'line', 'blocks', 'util']:
    emit('js/' + name + '.js', (BASE / ('js/' + name + '.js')).read_text())

game = (BASE / 'js/game.js').read_text()
start = game.index('\tthis.update = function(time) {')
end = game.index('\tthis.physics = function(timeDelta)', start)
game = game[:start] + '''\t// Playgarden: one adapter-owned RAF advances only active simulation time.
\tthis.elapsed = 0
\tthis.effects = []
\tthis.after = function(callback, delay, arg) {
\t\tthis.effects.push({ remaining: delay, callback: callback, arg: arg })
\t}
''' + game[end:]
game = game.replace('\tthis.physics = function(timeDelta) {', '''\tthis.physics = function(timeDelta) {
\t\tthis.elapsed += timeDelta
\t\tvar due = []
\t\tthis.effects = this.effects.filter(function(effect) {
\t\t\teffect.remaining -= timeDelta
\t\t\tif (effect.remaining <= 0) { due.push(effect); return false }
\t\t\treturn true
\t\t})
\t\tfor (var e = 0; e < due.length; e++) due[e].callback(due[e].arg)''')
emit('js/game.js', '// SPDX-License-Identifier: MIT\n// Original Zolmeister game; Playgarden clock/lifecycle changes, 2026.\n' + game)

powerups = (BASE / 'js/powerups.js').read_text()
assert powerups.count('setTimeout(') == 4
powerups = powerups.replace('setTimeout(', 'this.parent.game.after(')
emit('js/powerups.js', '// SPDX-License-Identifier: MIT\n// Playgarden: original ten-second effects use the pausable game clock.\n' + powerups)

hud = (BASE / 'js/hud.js').read_text()
hud = hud[:hud.index("\tkeyListeners.push(['enter'")] + '}\n'
hud = hud.replace('localStorage.bestScore', 'avabranchRecords.best')
translations = {
 'Score: ': '得分：', 'Multiplier: ': '倍率：', 'Level: ': '难度：',
 'Best: ': '最高：', '[Enter] to start game': '按 Enter 或下方开始',
 '[Space] to branch': '空格：合流 / 分流', '[p] to pause': 'P：暂停',
 'Game Over': '本局结束', '[Enter] for new game': 'Enter：再来一局',
 'Paused': '已暂停', '[p] to resume': 'P：继续游戏', 'controls ': '操作 '
}
for before, after in translations.items(): hud = hud.replace('"' + before + '"', '"' + after + '"')
hud = hud.replace('this.game.canvas.width - 100', 'this.game.canvas.width - 125')
emit('js/hud.js', '// SPDX-License-Identifier: MIT\n// Playgarden: Chinese labels, host-owned records and centralized lifecycle input.\n' + hud)

main = (BASE / 'js/main.js').read_text()
main = main[:main.index('window.requestAnimFrame')]
main = main.replace('var selecting=false', 'var game, player, spawner, hud, power_spawner, global_controls\nvar avabranchRecords = { best: 0 }')
main = main.replace('\tvar hud = new HUD(game, true)', '\thud = new HUD(game, true)')
main = main.replace('\tgame.update()', '\tgame.draw()')
emit('js/main.js', main)

patch = ''.join(changes)
target = ROOT / 'vendor/avabranch-original/DERIVATION.patch'
if check:
    assert target.read_text() == patch, 'DERIVATION.patch'
else:
    target.write_text(patch)
print('Avabranch derivative ' + ('verified' if check else 'written') + ': four byte-identical core files; clock, HUD and entry edits only.')
