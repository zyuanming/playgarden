#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Source, license and asset integrity check; never executes upstream gameplay."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'vendor/heal-em-all-original'
PUBLIC = ROOT / 'public/heal-em-all'
manifest = json.loads((VENDOR / 'manifest.json').read_text())
assert manifest['commit'] == '66950cda39d2b91f114dcf1a0b0307972f24a68f'
for file in manifest['files']:
    data = (VENDOR / file['path']).read_bytes()
    assert len(data) == file['bytes'], file['path']
    assert hashlib.sha256(data).hexdigest() == file['sha256'], file['path']
    assert hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest() == file['gitSha1'], file['path']
for file in json.loads((VENDOR / 'supplement-manifest.json').read_text()):
    if not file['path'].startswith('licenses/'):
        continue
    assert hashlib.sha256((VENDOR / file['path']).read_bytes()).hexdigest() == file['sha256'], file['path']
for file in (VENDOR / 'licenses').iterdir():
    assert (PUBLIC / 'licenses' / file.name).read_bytes() == file.read_bytes(), file.name
assert (PUBLIC / 'LICENSE.txt').read_bytes() == (VENDOR / 'upstream/LICENSE').read_bytes()
for folder in ['data', 'images']:
    for file in (PUBLIC / folder).iterdir():
        assert file.read_bytes() == (VENDOR / 'upstream/app' / folder / file.name).read_bytes(), file.name
assert sorted(file.name for file in (PUBLIC / 'images').iterdir()) == sorted(['characters.png', 'items.png', 'hud.png', 'others.png', 'bullet.png', 'map_tiles.png', 'gradient-top.png'])
for n, dimensions in enumerate([(30, 21), (30, 21), (50, 31), (100, 46), (100, 46), (100, 46)], 1):
    root = ET.parse(PUBLIC / 'data' / f'level{n}.tmx').getroot()
    assert (int(root.get('width')), int(root.get('height'))) == dimensions
    for layer in root.findall('layer'):
        gids = [int(tile.get('gid')) for tile in layer.find('data')]
        assert len(gids) == dimensions[0] * dimensions[1] and all(0 <= gid <= 16 for gid in gids)
game = (PUBLIC / 'game.js').read_text()
assert '跳出地图，恢复人类形态' in game
for prohibited in ['window.Game', "ga('send'", 'new Stats(', 'initUnloadEvent', 'localStorage.', '.mp3', '.ogg', 'I need to kill myself']:
    assert prohibited not in game, prohibited
assert 'Q.stats.' not in (PUBLIC / 'quintus.js').read_text()
subprocess.run([sys.executable, str(Path(__file__).with_name('adapt.py')), '--check'], check=True)
print(f'Heal’em All: {len(manifest["files"])} frozen files, six complete maps, seven licensed PNGs, full licenses and reproducible runtime verified.')
