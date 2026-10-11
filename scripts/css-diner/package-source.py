#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Deterministic archive of exact editable sources; stdlib only, no game execution."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'public/css-diner/source.zip'
MANIFEST = ROOT / 'vendor/css-diner-original/distribution-manifest.json'
files = []
for folder in ['vendor/css-diner-original', 'public/css-diner', 'scripts/css-diner']:
    files.extend(path for path in (ROOT / folder).rglob('*') if path.is_file() and path not in [ARCHIVE, MANIFEST] and '__pycache__' not in path.parts)
files.extend(ROOT / name for name in ['src/games/CssDiner.tsx', 'src/games/cssDiner.css', 'e2e/css-diner.spec.ts'])
files.extend(path for path in (ROOT / 'docs').glob('css-diner-*') if path.is_file())
files = sorted(set(files))
with zipfile.ZipFile(ARCHIVE, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        info = zipfile.ZipInfo(str(path.relative_to(ROOT)), (2026, 10, 10, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes(), compresslevel=9)
records = []
for path in files + [ARCHIVE]:
    data = path.read_bytes()
    records.append({'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
MANIFEST.write_text(json.dumps({
    'game': 'css-diner', 'commit': '566aaa01314caddc7a9034d793250cf2b8f12a4e',
    'archive': str(ARCHIVE.relative_to(ROOT)),
    'archiveExclusions': ['distribution-manifest.json (hashes the archive externally)', 'source.zip (the archive itself)', 'HANDOFF.md (integration status, not runtime source)'],
    'files': records
}, indent=2) + '\n')
print(f'CSS Diner: packaged {len(files)} editable source/runtime files with deterministic timestamps and SHA-256 identities.')
