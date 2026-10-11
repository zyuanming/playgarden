#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Optional Git-transport materializer. Exact local assets, never browser ZIP code."""
from pathlib import Path
import hashlib
import json
import zipfile
ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'vendor/monkey-rally-original'
manifest = json.loads((VENDOR / 'image-manifest.json').read_text())
approved = {item['path']: item for item in json.loads((VENDOR / 'publication-manifest.json').read_text())['files']}
assert manifest['count'] == len(manifest['files']) == 68
with zipfile.ZipFile(VENDOR / 'images.zip') as archive:
    assert sorted(archive.namelist()) == sorted(item['path'] for item in manifest['files'])
    verified = []
    for item in manifest['files']:
        relative = Path(item['path']); assert not relative.is_absolute() and '..' not in relative.parts
        source = approved['src/assets/' + relative.as_posix()]
        data = archive.read(item['path'])
        assert len(data) == item['bytes'] == source['bytes']
        assert hashlib.sha256(data).hexdigest() == item['sha256'] == source['sha256']
        assert data.startswith(b'\x89PNG\r\n\x1a\n') or data.startswith(b'\xff\xd8\xff')
        expected = ['vendor/monkey-rally-original/upstream/src/assets/' + relative.as_posix(), 'public/monkey-rally/assets/' + relative.as_posix()]
        assert item['destinations'] == expected
        for destination in expected:
            path = ROOT / destination
            assert path.resolve().is_relative_to(ROOT.resolve())
            verified.append((path, data))
    for path, data in verified:
        if path.exists() and path.read_bytes() == data: continue
        path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
print('68 original Monkey Rally images materialized with exact publication hashes.')
