#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Static source/license identity checks; never runs the game or a campaign."""
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
VENDOR = ROOT / 'vendor/flexbox-froggy-original'
PUBLIC = ROOT / 'public/flexbox-froggy'
manifest = json.loads((VENDOR / 'source-manifest.json').read_text())
assert manifest['commit'] == '9a6feab850a56cbe9ad90f3afcc95e88335bbec8'
assert len(manifest['files']) == 26
for file in manifest['files']:
    data = (VENDOR / file['path']).read_bytes()
    assert len(data) == file['bytes'], file['path']
    assert hashlib.sha256(data).hexdigest() == file['sha256'], file['path']
    assert hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest() == file['gitBlobSha1'], file['path']
for file in json.loads((VENDOR / 'supplement-manifest.json').read_text()):
    data = (VENDOR / 'upstream' / file['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == file['sha256'], file['path']
    if 'gitBlobSha1' in file:
        assert hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest() == file['gitBlobSha1'], file['path']
    assert data == (PUBLIC / file['path']).read_bytes()
assert json.loads((VENDOR / 'supplied-supplement-manifest.json').read_text()) == json.loads((VENDOR / 'supplement-manifest.json').read_text())
subprocess.run([sys.executable, str(Path(__file__).with_name('adapt.py')), '--check'], check=True)
source = (PUBLIC / 'js/levels.js').read_text()
lessons, ending = source.split('var levelWin =', 1)
names = re.findall(r"    name: '([^']+)'", lessons)
boards = re.findall(r"    board: '([gyr]+)'", lessons)
assert len(names) == len(boards) == 24
assert lessons.count("'zh-cn':") == 24 and ending.count("'zh-cn':") == 1
assert names == json.loads((ROOT / 'src/games/flexboxFroggyLevels.json').read_text())
summary = json.loads((VENDOR / 'level-summary.json').read_text())
assert names == [item['name'] for item in summary]
assert boards == [item['board'] for item in summary]
assert len(re.search(r"board: '([gyr]+)'", ending)[1]) == 25
svgs = sorted((PUBLIC / 'images').glob('*.svg'))
assert len(svgs) == 12
for path in svgs:
    tree = ET.parse(path)
    for node in tree.iter():
        assert node.tag.rsplit('}', 1)[-1] not in ['script', 'foreignObject', 'image']
        assert all(not key.lower().startswith('on') for key in node.attrib)

class LocalPage(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ['script', 'link', 'img']:
            path = attrs.get('src') or attrs.get('href')
            assert path and not re.match(r'^(?:[a-z]+:|//)', path), path
            assert (PUBLIC / path).is_file(), path
LocalPage().feed((PUBLIC / 'index.html').read_text())
game = (PUBLIC / 'js/game.js').read_text()
assert 'localStorage' not in game and 'twttr' not in game and 'twitter.com' not in game
assert 'game.bridge.navigate' in game and 'game.bridge.safeCSS' in game
assert "Math.floor(position.top)" in game and "Math.floor(position.left)" in game
assert "frogs[key] = (frogs[key] || 0) + 1" in game
host = (ROOT / 'src/games/FlexboxFroggy.tsx').read_text()
assert 'sandbox="allow-scripts"' in host and 'allow-same-origin' not in host
assert 'playgarden.flexbox-froggy.v1.state' in host and 'effectEpoch' in host
notice = (PUBLIC / 'NOTICE.txt').read_text()
for text in ['CC-BY-3.0', 'Thomas Park', 'Tim Guo', 'Daniel Eden', 'jQuery', 'Sizzle', 'GPL-3.0-only', manifest['commit']]:
    assert text in notice, text
for path in ['LICENSE', 'licenses/CC-BY-3.0.txt', 'licenses/Animate-MIT.txt', 'licenses/Playgarden-GPL-3.0.txt', 'third-party/jquery/LICENSE.txt', 'third-party/jquery/external/sizzle/LICENSE.txt', 'README.md']:
    assert (PUBLIC / path).read_text() in notice, path
distribution = json.loads((VENDOR / 'distribution-manifest.json').read_text())
for file in distribution['files']:
    data = (ROOT / file['path']).read_bytes()
    assert len(data) == file['bytes'] and hashlib.sha256(data).hexdigest() == file['sha256'], file['path']
with zipfile.ZipFile(ROOT / distribution['archive']) as archive:
    expected = {file['path'] for file in distribution['files'] if file['path'] != distribution['archive']}
    assert set(archive.namelist()) == expected
    for path in archive.namelist():
        assert 'audit-reference' not in path and 'transfer' not in path and '.git/' not in path
        assert archive.read(path) == (ROOT / path).read_bytes(), path
print('Flexbox Froggy: 26 exact frozen files; 24 original lessons + uncounted ending; 12 licensed SVGs; full notices; reproducible patch/archive; source identities verified.')
