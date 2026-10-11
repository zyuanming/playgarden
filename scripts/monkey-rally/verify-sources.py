#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Hash, JSON/HTML parsing and JS syntax only; no upstream program execution."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json
import subprocess
import sys
import zipfile
ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'vendor/monkey-rally-original'
PUBLIC = ROOT / 'public/monkey-rally'
manifest = json.loads((VENDOR / 'publication-manifest.json').read_text())
assert len(manifest['files']) == 104
assert sorted(p.relative_to(VENDOR / 'upstream').as_posix() for p in (VENDOR / 'upstream').rglob('*') if p.is_file()) == sorted(item['path'] for item in manifest['files'])
for item in manifest['files']:
    data = (VENDOR / 'upstream' / item['path']).read_bytes()
    assert len(data) == item['bytes'], item['path']
    assert hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
    assert hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest() == item['gitBlobSha1'], item['path']
engine = json.loads((VENDOR / 'clean-engine-manifest.json').read_text())
assert len(engine['replacements']) == 6
assert hashlib.sha256((PUBLIC / 'phaser.js').read_bytes()).hexdigest() == engine['sha256'] == '2659d5886eff76a5802376f478701234b6200ab207a57cb6aa2d5ef89e4330b6'
assert (PUBLIC / 'phaser.js').read_bytes() == (VENDOR / 'upstream/src/js/lib/phaser.js').read_bytes()
assert (PUBLIC / 'LICENSE.txt').read_bytes() == (VENDOR / 'upstream/LICENSE').read_bytes()
notice = (PUBLIC / 'NOTICE.txt').read_text()
assert (VENDOR / 'upstream/LICENSE').read_text() in notice
for path in (VENDOR / 'upstream/licenses').iterdir():
    assert path.read_text() in notice
    assert path.read_bytes() == (PUBLIC / 'licenses' / path.name).read_bytes()
assert sorted(p.name for p in (PUBLIC / 'assets/maps').glob('*.json')) == [f'level{n}.json' for n in range(1, 9)]
layouts = set()
for n in range(1, 9):
    path = PUBLIC / 'assets/maps' / f'level{n}.json'
    assert path.read_bytes() == (VENDOR / 'upstream/src/assets/maps' / path.name).read_bytes()
    data = json.loads(path.read_text()); assert data['width'] == data['height'] == 25
    entities = next(layer['data'] for layer in data['layers'] if layer['name'] == 'entities')
    assert entities.count(202) == entities.count(203) == 1
    layouts.add(tuple(entities))
    for i, tile in enumerate(entities):
        if tile: assert i % 25 < 16 and i // 25 < 9
    for layer in data['layers']:
        if 'data' in layer: assert len(layer['data']) == 625
assert len(layouts) == 8
class LocalHTML(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ['src', 'href']:
                assert value and '://' not in value and not value.startswith('//'), value
                assert (PUBLIC / value).is_file(), value
html = (PUBLIC / 'index.html').read_text()
LocalHTML().feed(html)
assert "connect-src 'self'" in html and "media-src 'none'" in html and "font-src 'none'" in html
adapter = (PUBLIC / 'adapter.js').read_text()
assert '__monkeyRead' in adapter and 'onCompleteCallback' in adapter and "send('navigate'" in adapter
assert 'localStorage.getItem(storageKey)' in adapter and 'localStorage.setItem(storageKey' in adapter
for path in (PUBLIC / 'original').rglob('*.js'):
    assert 'localStorage' not in path.read_text(), path
for path in PUBLIC.rglob('*'):
    assert not any(term in path.name.lower() for term in ['transfer.json', 'audit-reference', 'thumbs.db']), path
    assert path.suffix.lower() not in ['.mp3', '.ogg', '.fnt', '.xml'], path
for item in json.loads((PUBLIC / 'runtime-manifest.json').read_text())['files']:
    data = (ROOT / item['path']).read_bytes()
    assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
source_manifest = json.loads((VENDOR / 'corresponding-source-manifest.json').read_text())
with zipfile.ZipFile(PUBLIC / 'source.zip') as archive:
    expected = {item['path'] for item in source_manifest['files']} | {'vendor/monkey-rally-original/corresponding-source-manifest.json'}
    assert set(archive.namelist()) == expected
    for item in source_manifest['files']:
        data = archive.read(item['path'])
        assert data == (ROOT / item['path']).read_bytes(), item['path']
        assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256']
subprocess.run([sys.executable, str(Path(__file__).with_name('adapt.py')), '--check'], check=True)
for path in sorted(PUBLIC.rglob('*.js')): subprocess.run(['node', '--check', str(path)], check=True, capture_output=True)
print('Monkey Rally: 104 whitelisted inputs, unchanged cleaned engine, eight distinct maps, full notices, local references, source archive and JavaScript syntax verified. Browser behavior is not asserted.')
