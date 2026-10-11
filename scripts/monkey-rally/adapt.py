#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Copy only approved source and apply explicit game seams. Never execute upstream."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'vendor/monkey-rally-original/upstream'
OUT = ROOT / 'public/monkey-rally'
CHECK = '--check' in sys.argv

def emit(relative, data):
    target = OUT / relative
    if isinstance(data, str):
        data = data.encode()
    if CHECK:
        assert target.read_bytes() == data, f'Runtime drift: {relative}'
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

def replace(text, old, new):
    assert old in text, 'Frozen source seam changed: ' + old[:80]
    return text.replace(old, new)

for file in sorted((SRC / 'src/assets').rglob('*')):
    if file.is_file():
        emit(Path('assets') / file.relative_to(SRC / 'src/assets'), file.read_bytes())
for file in (SRC / 'licenses').iterdir():
    emit(Path('licenses') / file.name, file.read_bytes())
emit('LICENSE.txt', (SRC / 'LICENSE').read_bytes())
emit('phaser.js', (SRC / 'src/js/lib/phaser.js').read_bytes())
for file in sorted((SRC / 'src/js').rglob('*.js')):
    if '/lib/' in str(file) or file.name == 'main.js':
        continue
    code = file.read_text()
    if file.name == 'preloader.js':
        code = '\n'.join(line for line in code.split('\n') if 'game.load.audio(' not in line)
        # The adapter owns scaling and disposal. No anonymous resize listeners.
    if file.name in ['boot.js', 'preloader.js']:
        code = replace(code, "        window.addEventListener('resize', function () {\n            game.stage.scale.refresh();\n        });", '')
        code = '\n'.join(line for line in code.split('\n') if 'game.stage.scale' not in line)
    if file.name == 'mainmenu.js':
        start = code.index('function playMusic(')
        end = code.index('MouseGame.MainMenu =', start)
        code = code[:start] + 'function playMusic() { /* Unlicensed soundtrack omitted. */ }\n\n' + code[end:]
    if file.name == 'levelselector.js':
        code = replace(code, 'localStorage["level-" + levelButton.level] === \'true\'', 'MonkeyBridge.completed(Number(levelButton.level.slice(5)))')
        code = code[:code.index('\nfunction clearSaves()')]
    if file.name == 'commands.js':
        code = replace(code, 'localStorage["level-" + mapName] = true;', '// Progress is recorded only by the guarded adapter victory callback.')
    if file.name == 'mapLoader.js':
        code = replace(code, "'tiles-sprites', itemLookup[sprite]", 'itemLookup[tile]')
    emit(Path('original') / file.relative_to(SRC / 'src/js'), '// Original CC-BY-4.0; bounded Playgarden changes 2026-10-10. See NOTICE.txt.\n' + code)
print('Monkey Rally runtime copy/seam check passed.' if CHECK else 'Monkey Rally approved source copied and runtime seams adapted.')
