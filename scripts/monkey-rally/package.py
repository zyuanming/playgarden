#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Deterministic local notices/archives; no third-party code is run."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / 'vendor/monkey-rally-original'
PUBLIC = ROOT / 'public/monkey-rally'
def record(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
def archive(path, files):
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for name, source in sorted(files):
            info = zipfile.ZipInfo(name, (2026, 10, 10, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            output.writestr(info, source.read_bytes())

notice = '''Monkey Rally — complete original eight-puzzle campaign
Code: Anders Antila. Art and graphics: Erik Nahkala and Laura Kantti.
Original first-party code, authored levels, narrative and artwork: CC-BY-4.0.
https://creativecommons.org/licenses/by/4.0/
Fixed original source: https://github.com/antila/ludum-dare-28/tree/79abaad33db0e0b5bddf4500800de881e2bc738c

Playgarden modifications, 2026-10-10: isolated local original Phaser runtime,
six narrowly replaced engine utilities, responsive controls and Chinese captions,
safe tween lifecycle/pause and bounded commands, GID-aware original decoration,
namespaced validated progress and host-owned stage navigation. Adapter contributions
and replacement utilities are GPL-3.0-only. Original files retain their own licenses.
No author endorsement is implied. Music and third-party bitmap font are omitted.
The original credits illustration's music attribution to Raxl Snaxel is retained.

Preferred editable sources and exact corresponding-source ZIP: ./source.zip
The engine remains the audited readable Phaser 1.1.3/Pixi bundle (99.58% original
bytes retained), with complete component notices below and in ./licenses/.
No raw excluded engine helper bodies, external soundtrack or font are shipped.

Retained engine notices: Phaser / Richard Davey and Photon Storm; Pixi / Mathew
Groves; PolyK / Ivan Kuckir; QuadTree / Timo Hausmann; JS Signals / Miller Medeiros;
Tween.js and Robert Penner; EventTarget / Mr.doob; jQuery Foundation utilities;
Nonsense inspiration / Josh Faul (informal permissive grant); Alea/Mash /
Johannes Baagøe. Exact sources/hashes are in the corresponding source manifests.

=== Original first-party CC-BY-4.0 legal text ===
'''
notice += (VENDOR / 'upstream/LICENSE').read_text()
for license_file in sorted((VENDOR / 'upstream/licenses').iterdir()):
    notice += '\n\n=== ' + license_file.name + ' ===\n' + license_file.read_text()
(PUBLIC / 'NOTICE.txt').write_text(notice)

images = sorted(path for path in (VENDOR / 'upstream/src/assets').rglob('*') if path.suffix.lower() in ['.png', '.jpg', '.jpeg'])
image_manifest = []
for path in images:
    relative = path.relative_to(VENDOR / 'upstream/src/assets').as_posix()
    item = record(path)
    image_manifest.append({'path': relative, 'bytes': item['bytes'], 'sha256': item['sha256'], 'destinations': [item['path'], 'public/monkey-rally/assets/' + relative]})
save(VENDOR / 'image-manifest.json', {'format': 1, 'count': len(images), 'files': image_manifest})
archive(VENDOR / 'images.zip', [(item['path'], path) for item, path in zip(image_manifest, images)])

runtime = sorted(path for path in PUBLIC.rglob('*') if path.is_file() and path.name not in ['source.zip', 'runtime-manifest.json'])
save(PUBLIC / 'runtime-manifest.json', {'revision': 'monkey-rally-79abaad3-playgarden-1', 'files': [record(path) for path in runtime]})
sources = []
for base in [VENDOR, PUBLIC, ROOT / 'scripts/monkey-rally']:
    sources.extend(path for path in base.rglob('*') if path.is_file() and path.name not in ['source.zip', 'images.zip', 'corresponding-source-manifest.json'] and '__pycache__' not in str(path))
sources.extend([ROOT / 'src/games/MonkeyRallyOriginal.tsx', ROOT / 'src/games/monkeyRallyOriginal.css', ROOT / 'e2e/monkey-rally.spec.ts'])
sources = sorted(set(sources))
save(VENDOR / 'corresponding-source-manifest.json', {'commit': '79abaad33db0e0b5bddf4500800de881e2bc738c', 'files': [record(path) for path in sources]})
sources.append(VENDOR / 'corresponding-source-manifest.json')
archive(PUBLIC / 'source.zip', [(path.relative_to(ROOT).as_posix(), path) for path in sources])
print(f'Packaged {len(images)} unchanged images and {len(sources)} corresponding-source entries; full notices and runtime hashes written.')
