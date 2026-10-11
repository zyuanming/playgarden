#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Package exact editable sources using only Python's standard library."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'vendor/flexbox-froggy-original'
ARCHIVE = ROOT / 'public/flexbox-froggy/source.zip'
MANIFEST = VENDOR / 'distribution-manifest.json'
files = []
for folder in ['vendor/flexbox-froggy-original', 'public/flexbox-froggy', 'scripts/flexbox-froggy']:
    files.extend(path for path in (ROOT / folder).rglob('*') if path.is_file() and path not in [ARCHIVE, MANIFEST] and '__pycache__' not in path.parts)
for name in ['src/games/FlexboxFroggy.tsx', 'src/games/flexboxFroggy.css', 'src/games/flexboxFroggyLevels.json', 'e2e/flexbox-froggy.spec.ts']:
    files.append(ROOT / name)
files.extend((ROOT / 'docs').glob('flexbox-froggy-*'))
files = sorted(set(files))
with zipfile.ZipFile(ARCHIVE, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        info = zipfile.ZipInfo(str(path.relative_to(ROOT)), (2026, 10, 10, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
records = []
for path in files + [ARCHIVE]:
    data = path.read_bytes()
    records.append({'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
MANIFEST.write_text(json.dumps({'game': 'flexbox-froggy', 'commit': '9a6feab850a56cbe9ad90f3afcc95e88335bbec8', 'archive': str(ARCHIVE.relative_to(ROOT)), 'archiveExclusions': ['distribution-manifest.json (generated outside archive to avoid circular hashing)', 'source.zip (the archive itself)'], 'files': records}, indent=2) + '\n')
print(f'Packaged {len(files)} exact source/runtime files and recorded archive SHA-256.')
