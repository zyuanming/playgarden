#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Package corresponding preferred source from only this game's explicit paths."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
ROOT = Path(__file__).resolve().parents[2]
paths = []
for relative in ['vendor/heal-em-all-original', 'public/heal-em-all', 'scripts/heal-em-all']:
    paths.extend(p for p in (ROOT / relative).rglob('*') if p.is_file() and p.name != 'source.zip' and '__pycache__' not in p.parts)
paths += [ROOT / 'src/games/HealEmAllOriginal.tsx', ROOT / 'src/games/healEmAllOriginal.css']
with ZipFile(ROOT / 'public/heal-em-all/source.zip', 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(set(paths)):
        item = ZipInfo('heal-em-all/' + path.relative_to(ROOT).as_posix(), date_time=(2026, 10, 10, 0, 0, 0))
        item.compress_type = ZIP_DEFLATED
        archive.writestr(item, path.read_bytes())
    archive.writestr('heal-em-all/README.txt', '''Heal'em All — complete corresponding source

Original commit: 66950cda39d2b91f114dcf1a0b0307972f24a68f
Code and adaptation: GPL-3.0-only. Art: CC-BY-4.0. Engine/utilities: MIT.
See public/heal-em-all/NOTICE.txt and the full license files.

All 48 original CoffeeScript modules are under vendor/heal-em-all-original/
upstream/app/scripts/game/. The original generated JS and complete engine,
maps, spritesheets and art are retained there. No compiler or package install
is required to reproduce the adapted runtime:

  python3 scripts/heal-em-all/adapt.py
  python3 scripts/heal-em-all/verify-sources.py

The HTML game runs from public/heal-em-all/ on any ordinary static server.
Its bridge and React host are handwritten source. The host imports the
Playgarden GameProps shape (level, paused, resetToken, freshStart, hintToken,
undoToken, onComplete, onStatus). All changed engine/game seams are described
in adapt.py. No audio, remote fonts or analytics are used.
''')
print('Packaged Heal’em All corresponding source.')
