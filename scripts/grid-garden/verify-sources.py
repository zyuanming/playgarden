#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Static identities, license/source completeness and local runtime boundaries."""
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
VENDOR = ROOT / 'vendor/grid-garden-original'
PUBLIC = ROOT / 'public/grid-garden'
manifest = json.loads((VENDOR / 'source-manifest.json').read_text())
assert manifest['commit'] == '0e262f7272d4992340eb556bdb9b2d502cc59932'
assert len(manifest['files']) == 22
for record in manifest['files']:
    data = (VENDOR / record['path']).read_bytes()
    assert len(data) == record['bytes'], record['path']
    assert hashlib.sha256(data).hexdigest() == record['sha256'], record['path']
    assert hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest() == record['gitBlobSha1'], record['path']
for record in json.loads((VENDOR / 'supplement-manifest.json').read_text()):
    data = (VENDOR / 'upstream' / record['path']).read_bytes()
    assert len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256'], record['path']
    assert data == (PUBLIC / record['path']).read_bytes()
subprocess.run([sys.executable, str(Path(__file__).with_name('adapt.py')), '--check'], check=True)

source = (PUBLIC / 'js/levels.js').read_text()
lessons, ending = source.split('var levelWin =', 1)
names = re.findall(r"    name: '([^']+)'", lessons)
boards = re.findall(r"    board: '([cw]+)'", lessons)
assert len(names) == len(boards) == 28
assert lessons.count("'zh-cn':") == 28 and ending.count("'zh-cn':") == 1
assert names == json.loads((ROOT / 'src/games/gridGardenLevels.json').read_text())
inventory = json.loads((ROOT / 'docs/grid-garden-level-inventory.json').read_text())
assert inventory['countedLevels'] == 28 and inventory['endingCounted'] is False
assert inventory['sourceSha256'] == hashlib.sha256((PUBLIC / 'js/levels.js').read_bytes()).hexdigest()
assert names == [lesson['name'] for lesson in inventory['levels']]
assert boards == [lesson['board'] for lesson in inventory['levels']]
assert [lesson['ordinal'] for lesson in inventory['levels']] == list(range(1, 29))
assert 'grid-template-rows-50px-0-0-0-1fr' in inventory['levels'][25]['classes']['#plants']
assert "board: ''" in ending
images = sorted((PUBLIC / 'images').iterdir())
assert len(images) == 9 and sum(path.suffix == '.svg' for path in images) == 8
for path in images:
    if path.suffix != '.svg':
        assert path.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
        continue
    for node in ET.parse(path).iter():
        assert node.tag.rsplit('}', 1)[-1] not in ['script', 'foreignObject', 'image']
        assert all(not key.lower().startswith('on') for key in node.attrib)
        for key, value in node.attrib.items():
            if key.rsplit('}', 1)[-1] == 'href': assert value.startswith('#')

class LocalPage(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        assert all(not name.lower().startswith('on') for name in attrs), tag
        if tag in ['script', 'link', 'img']:
            path = attrs.get('src') or attrs.get('href')
            assert path and not re.match(r'^(?:[a-z]+:|//)', path), path
            assert (PUBLIC / path).is_file(), path
page = (PUBLIC / 'index.html').read_text()
LocalPage().feed(page)
for directive in ["default-src 'none'", "connect-src 'none'", "font-src 'none'", "img-src 'self'", "form-action 'none'", "base-uri 'none'"]:
    assert directive in page
for path in [PUBLIC / 'css/style.css', PUBLIC / 'adapter.css', PUBLIC / 'third-party/animate.css/animate.css']:
    css = path.read_text()
    assert '@import' not in css and '@font-face' not in css
    for url in re.findall(r'url\([\'"]?([^\)\'\"]+)', css):
        assert not re.match(r'^(?:[a-z]+:|//)', url), url
        assert (path.parent / url).is_file(), url
game = (PUBLIC / 'js/game.js').read_text()
assert all(text not in game for text in ['localStorage', 'twttr', 'twitter.com', "ga('send'", 'setTimeout'])
for text in ['game.bridge.navigate', 'game.bridge.safeCSS', 'Math.round(this.getBoundingClientRect().top)', 'Math.floor(parseFloat(window.getComputedStyle(this).width))', 'treatments[key] = (treatments[key] || 0) + 1']:
    assert text in game, text
bridge = (PUBLIC / 'adapter.js').read_text()
for text in ['pauseTimer(inputTimer)', 'pauseTimer(advanceTimer)', 'resumeTimer(inputTimer)', 'resumeTimer(advanceTimer)', '.stop(true, false)', 'fade.remaining = Math.max(0, fade.due - performance.now())', 'game.solved.length !== levels.length', 'event.source !== parent', 'event.origin !== parentOrigin', 'data.session !== session']:
    assert text in bridge, text
host = (ROOT / 'src/games/GridGarden.tsx').read_text()
assert 'sandbox="allow-scripts"' in host and 'allow-same-origin' not in host
assert 'playgarden.grid-garden.v1.state' in host and 'effectEpoch' in host
assert 'const allSolved = solved.length === names.length;' in host
notice = (PUBLIC / 'NOTICE.txt').read_text()
for text in ['CC-BY-3.0', 'Thomas Park', 'Jin', 'Daniel Eden', 'jQuery', 'Sizzle', 'GPL-3.0-only', manifest['commit']]:
    assert text in notice, text
for path in ['LICENSE', 'README.md', 'licenses/CC-BY-3.0.txt', 'licenses/Animate-MIT.txt', 'licenses/Playgarden-GPL-3.0.txt', 'third-party/jquery/LICENSE.txt', 'third-party/jquery/external/sizzle/LICENSE.txt']:
    assert (PUBLIC / path).read_text().rstrip() in notice, path
distribution = json.loads((VENDOR / 'distribution-manifest.json').read_text())
for record in distribution['files']:
    data = (ROOT / record['path']).read_bytes()
    assert len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256'], record['path']
with zipfile.ZipFile(ROOT / distribution['archive']) as archive:
    expected = {record['path'] for record in distribution['files'] if record['path'] != distribution['archive']}
    assert set(archive.namelist()) == expected
    for path in archive.namelist():
        assert all(forbidden not in path for forbidden in ['preflight', 'transports', '.git/', 'audit-reference', '__pycache__'])
        assert archive.read(path) == (ROOT / path).read_bytes(), path
print('Grid Garden static source/license checks: 22 exact upstream files, 28 original lessons, 9 licensed original images, complete notices and corresponding source verified. Gameplay E2E is separate.')
