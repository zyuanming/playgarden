#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Package the complete per-game source with deterministic metadata and digests."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'vendor/avabranch-original'
ARCHIVE = ROOT / 'public/avabranch/source.zip'
MANIFEST = VENDOR / 'distribution-manifest.json'
COMMIT = '4ab326b4a24d796328963da35c0d8d193d728496'
original_core = {'game.js', 'hud.js', 'powerups.js', 'main.js', 'player.js', 'line.js', 'blocks.js', 'util.js'}

def license_for(path):
    name = str(path.relative_to(ROOT))
    if '/upstream/' in name or '/silent-base/' in name or name == 'public/avabranch/LICENSE':
        return 'MIT'
    if name.startswith('public/avabranch/js/') and path.name in original_core:
        return 'MIT'
    return 'GPL-3.0-only'

def record(path):
    data = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'license': license_for(path)}

source_files = sorted(path for path in (ROOT / 'public/avabranch').rglob('*') if path.is_file() and path != ARCHIVE)
source_files += [ROOT / 'src/games/Avabranch.tsx', ROOT / 'src/games/avabranch.css', ROOT / 'public/avabranch-art.svg']
records = []
for path in source_files:
    item = record(path)
    if path.parent.name == 'js' and path.name in original_core:
        item['source'] = f'https://github.com/Zolmeister/avabranch/blob/{COMMIT}/docs/js/{path.name}'
        item['relationship'] = 'byte-identical original' if path.name in ['player.js', 'line.js', 'blocks.js', 'util.js'] else 'modified MIT original, reproducible in DERIVATION.patch'
    elif path.name == 'LICENSE':
        item['source'] = f'https://github.com/Zolmeister/avabranch/blob/{COMMIT}/LICENSE'
        item['relationship'] = 'complete original MIT license'
    else:
        item['source'] = 'Playgarden contributors, 2026-10-11'
        item['relationship'] = 'new adaptation source or license/provenance document'
    records.append(item)
(ROOT / 'docs/avabranch-source-map.json').write_text(json.dumps({'game': 'avabranch', 'commit': COMMIT, 'levelCount': 0, 'endless': True, 'files': records}, indent=2) + '\n')

files = []
for folder in ['vendor/avabranch-original', 'public/avabranch', 'scripts/avabranch']:
    files.extend(path for path in (ROOT / folder).rglob('*') if path.is_file() and path not in [ARCHIVE, MANIFEST] and '__pycache__' not in path.parts)
files += [ROOT / name for name in ['src/games/Avabranch.tsx', 'src/games/avabranch.css', 'public/avabranch-art.svg', 'e2e/avabranch.spec.ts', 'docs/avabranch-adaptation.md', 'docs/avabranch-source-map.json']]
files = sorted(set(files))
with zipfile.ZipFile(ARCHIVE, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        info = zipfile.ZipInfo(str(path.relative_to(ROOT)), (2026, 10, 11, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
MANIFEST.write_text(json.dumps({'game': 'avabranch', 'commit': COMMIT, 'levelCount': 0, 'endless': True, 'archive': str(ARCHIVE.relative_to(ROOT)), 'archiveExclusions': ['distribution-manifest.json (external to avoid circular hashing)', 'source.zip (archive itself)'], 'files': [record(path) for path in files + [ARCHIVE]]}, indent=2) + '\n')
print(f'Packaged {len(files)} exact source/runtime files. ZIP SHA-256: {hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()}')
