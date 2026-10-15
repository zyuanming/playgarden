#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Package deterministic editable sources with standard-library tools only."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'vendor/grid-garden-original'
ARCHIVE = ROOT / 'public/grid-garden/source.zip'
MANIFEST = VENDOR / 'distribution-manifest.json'
files = []
for folder in ['vendor/grid-garden-original', 'public/grid-garden', 'scripts/grid-garden']:
    files.extend(path for path in (ROOT / folder).rglob('*') if path.is_file() and path not in [ARCHIVE, MANIFEST] and '__pycache__' not in path.parts)
for name in ['src/games/GridGarden.tsx', 'src/games/gridGarden.css', 'src/games/gridGardenLevels.json', 'e2e/grid-garden.spec.ts']:
    files.append(ROOT / name)
files.extend((ROOT / 'docs').glob('grid-garden-*'))
files = sorted(set(files))
with zipfile.ZipFile(ARCHIVE, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        info = zipfile.ZipInfo(str(path.relative_to(ROOT)), (2026, 10, 11, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
records = []
for path in files + [ARCHIVE]:
    data = path.read_bytes()
    records.append({'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
MANIFEST.write_text(json.dumps({'game': 'grid-garden', 'commit': '0e262f7272d4992340eb556bdb9b2d502cc59932', 'archive': str(ARCHIVE.relative_to(ROOT)), 'archiveExclusions': ['distribution-manifest.json (outside archive to avoid circular hashing)', 'source.zip (the archive itself)'], 'files': records}, indent=2) + '\n')
print(f'Packaged {len(files)} exact source/runtime files with archive SHA-256.')
