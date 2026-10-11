#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Static-only source, license, rule-preservation and corresponding ZIP checks."""
from pathlib import Path
import hashlib
from html.parser import HTMLParser
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'vendor/avabranch-original'
PUBLIC = ROOT / 'public/avabranch'
manifest = json.loads((VENDOR / 'source-manifest.json').read_text())
assert manifest['commit'] == '4ab326b4a24d796328963da35c0d8d193d728496'
assert len(manifest['files']) == 11
assert len(manifest['silentBase']) == 12
assert sum(file['bytes'] for file in manifest['silentBase']) == 26844
for file in manifest['files'] + manifest['silentBase']:
    path = VENDOR / file['path']
    data = path.read_bytes()
    assert len(data) == file['bytes'], file['path']
    assert hashlib.sha256(data).hexdigest() == file['sha256'], file['path']
    if 'gitBlobSha1' in file:
        assert hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest() == file['gitBlobSha1'], file['path']
expected_upstream = {file['path'] for file in manifest['files']}
expected_silent = {file['path'] for file in manifest['silentBase']}
assert {str(path.relative_to(VENDOR)) for path in (VENDOR / 'upstream').rglob('*') if path.is_file()} == expected_upstream
assert {str(path.relative_to(VENDOR)) for path in (VENDOR / 'silent-base').rglob('*') if path.is_file()} == expected_silent
subprocess.run([sys.executable, str(Path(__file__).with_name('adapt.py')), '--check'], check=True)
for name in ['player', 'line', 'blocks', 'util']:
    assert (PUBLIC / f'js/{name}.js').read_bytes() == (VENDOR / f'upstream/docs/js/{name}.js').read_bytes()
original_hud = (VENDOR / 'upstream/docs/js/hud.js').read_text()
hud = (PUBLIC / 'js/hud.js').read_text()
physics = lambda text: text[text.index('\tthis.physics ='):text.index('\tthis.draw =')]
assert physics(original_hud) == physics(hud), 'Original living-line/mode multiplier, ceil scoring and loss must remain exact.'
powerups = (PUBLIC / 'js/powerups.js').read_text()
assert powerups.count('this.parent.game.after(') == 4
assert '\n'.join(powerups.split('\n')[2:]).replace('this.parent.game.after(', 'setTimeout(') == (VENDOR / 'upstream/docs/js/powerups.js').read_text()
game = (PUBLIC / 'js/game.js').read_text()
assert 'this.timeTillLevel = 10000' in game and 'this.objects["spawner"].level += 1' in game
assert 'this.objects["power_spawn"].spawn()' in game
adapter = (PUBLIC / 'adapter.js').read_text()
runtime_js = '\n'.join(path.read_text() for path in PUBLIC.rglob('*.js'))
for forbidden in ['localStorage', 'innerHTML', 'setTimeout(', 'setInterval(', 'requestAnimFrame', 'eval(', 'new Function(', 'XMLHttpRequest', 'fetch(']:
    assert forbidden not in runtime_js, forbidden
assert adapter.count('requestAnimationFrame(tick)') == 2 and adapter.count('function tick(') == 1
assert 'game.effects = []' in adapter and 'document.hidden' in adapter
assert 'pointercancel' in adapter and 'lostpointercapture' in adapter and 'pointermove' in adapter
assert 'Math.random =' not in runtime_js
host = (ROOT / 'src/games/Avabranch.tsx').read_text()
for expected in ['sandbox="allow-scripts"', "event.origin !== 'null'", 'event.source !== target', 'data.session !== session', 'pendingSaves', 'epochRef', 'playgarden.avabranch.v1.records']:
    assert expected in host, expected
assert 'allow-same-origin' not in host and 'onComplete(' not in host
assert (PUBLIC / 'LICENSE').read_bytes() == (VENDOR / 'upstream/LICENSE').read_bytes()
notice = (PUBLIC / 'NOTICE.txt').read_text()
assert (PUBLIC / 'LICENSE').read_text() in notice
assert (PUBLIC / 'Playgarden-GPL-3.0.txt').read_text() in notice
for required in [manifest['commit'], 'Zolmeister', 'GPL-3.0-only', 'MIT', 'source.zip']:
    assert required in notice, required

class LocalPage(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ['script', 'link', 'img', 'audio', 'video', 'iframe']:
            assert tag in ['script', 'link'], tag
            path = attrs.get('src') or attrs.get('href')
            assert path and not re.match(r'^(?:[a-z]+:|//)', path), path
            assert (PUBLIC / path).is_file(), path
        assert all(not key.lower().startswith('on') for key in attrs), tag
LocalPage().feed((PUBLIC / 'index.html').read_text())
tree = ET.parse(ROOT / 'public/avabranch-art.svg')
for node in tree.iter():
    assert node.tag.rsplit('}', 1)[-1] not in ['script', 'foreignObject', 'image']
    assert all(not key.lower().startswith('on') for key in node.attrib)
distribution = json.loads((VENDOR / 'distribution-manifest.json').read_text())
for file in distribution['files']:
    data = (ROOT / file['path']).read_bytes()
    assert len(data) == file['bytes'] and hashlib.sha256(data).hexdigest() == file['sha256'], file['path']
for file in json.loads((ROOT / 'docs/avabranch-source-map.json').read_text())['files']:
    assert hashlib.sha256((ROOT / file['path']).read_bytes()).hexdigest() == file['sha256'], file['path']
with zipfile.ZipFile(ROOT / distribution['archive']) as archive:
    expected = {file['path'] for file in distribution['files'] if file['path'] != distribution['archive']}
    assert set(archive.namelist()) == expected
    assert len(archive.namelist()) == len(expected)
    for path in archive.namelist():
        assert all(part not in path.split('/') for part in ['audit-only', '.git', 'checks', '__pycache__'])
        assert not path.startswith('/') and '..' not in Path(path).parts
        assert archive.read(path) == (ROOT / path).read_bytes(), path
expected_public = {file['path'] for file in distribution['files'] if file['path'].startswith('public/avabranch/')}
assert {str(path.relative_to(ROOT)) for path in PUBLIC.rglob('*') if path.is_file()} == expected_public
spec = (ROOT / 'e2e/avabranch.spec.ts').read_text()
assert spec.count('\ntest(') == 1
assert 'Input.dispatchTouchEvent' in spec and "type: 'touchCancel'" in spec
assert '@playwright/test' not in runtime_js
print('Avabranch static sources verified: 11 frozen originals, 12 cleared input files, four exact core files, unchanged HUD scoring, four exact pickup rules, full licenses and exact source ZIP. No runtime PASS implied.')
