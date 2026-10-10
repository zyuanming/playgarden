#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Static source/notice/asset integrity only; never imports or executes game code."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('--shared-root', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
shared = args.shared_root.resolve() if args.shared_root else root
vendor = root / 'vendor/crisp-original'
manifest = json.loads((vendor / 'makemaze-source-manifest.json').read_text())
for record in manifest['files']:
    data = (vendor / record['dest']).read_bytes()
    assert len(data) == record['expected_bytes'], record['path']
    assert hashlib.sha256(data).hexdigest() == record['sha256'], record['path']
    assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == record['git_blob_sha1'], record['path']
runtime = root / 'public/crisp-original/makemaze'
main = (runtime / 'main.js').read_bytes()
assert main == (vendor / 'upstream/games/docs/makemaze/main.js').read_bytes()
assert main.count(b'\n') == main.count(b'\r\n')
assert (vendor / 'makemaze-LICENSE.txt').read_text().strip() in (shared / 'public/crisp-original/LICENSES.txt').read_text()
for file in runtime.glob('*.js'):
    source = file.read_text()
    for pattern in [r'\beval\s*\(', r'\bnew\s+Function\s*\(', r'\bfetch\s*\(', r'\bXMLHttpRequest\b',
                    r'\bWebSocket\b', r'\bsendBeacon\s*\(', r'\bimportScripts\s*\(', r'\bhttps?://']:
        assert not re.search(pattern, source), (file, pattern)
html = (runtime / 'index.html').read_text()
assert "connect-src 'none'" in html and "script-src 'self'" in html
for url in re.findall(r'(?:src|href)="([^"]+)"', html):
    assert not re.match(r'(?:\w+:|//)', url), url
    local = (runtime / url).resolve()
    fallback = (shared / local.relative_to(root)).resolve()
    assert local.is_file() or fallback.is_file(), url
ET.parse(runtime / 'card.svg')
catalog = json.loads((root / 'docs/makemaze-catalog-entry.json').read_text())
assert catalog['levelCount'] == 0 and catalog['endless'] is True and catalog['allowUndo'] is False
print('MAKE MAZE: exact original CRLF main, Git blobs, full MIT notice, local-only assets and zero finite levels verified. No gameplay executed.')
