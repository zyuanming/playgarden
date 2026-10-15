#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Reproducible complete game-module source archive, not the entire host app."""
from pathlib import Path
import gzip,hashlib,io,json,tarfile
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'third_party/rollermaze';DEST=ROOT/'public/games/rollermaze'
for name in ['LICENSE-MIT.txt','PLAYGARDEN-COPYING.txt','MicroW-PUBLIC-DOMAIN.md','ADAPTATION.md','SOURCE-MANIFEST.json']:(DEST/name).write_bytes((SRC/name).read_bytes())
files=[]
for prefix in ['third_party/rollermaze','scripts/rollermaze']:
 files += [p for p in (ROOT/prefix).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
for name in ['src/games/RollermazeGame.tsx','src/games/rollermazeGame.css','public/games/rollermaze/index.html','public/games/rollermaze/frame.css','public/games/rollermaze/cover.svg','e2e/rollermaze.spec.ts','package.json','package-lock.json','src/lib/types.ts','e2e/helpers.ts','playwright.config.ts']:
 if (ROOT/name).is_file():files.append(ROOT/name)
files += list(ROOT.glob('tsconfig*.json'))
files=sorted(set(files),key=lambda p:p.relative_to(ROOT).as_posix());records=[];data=io.BytesIO()
with tarfile.open(fileobj=data,mode='w',format=tarfile.PAX_FORMAT) as archive:
 for p in files:
  blob=p.read_bytes();name=p.relative_to(ROOT).as_posix();records.append(dict(path=name,bytes=len(blob),sha256=hashlib.sha256(blob).hexdigest()))
  item=tarfile.TarInfo(name);item.size=len(blob);item.mode=0o644;item.mtime=0;archive.addfile(item,io.BytesIO(blob))
 blob=(json.dumps(records,indent=2)+'\n').encode();item=tarfile.TarInfo('ARCHIVE-MANIFEST.json');item.size=len(blob);item.mode=0o644;item.mtime=0;archive.addfile(item,io.BytesIO(blob))
with (DEST/'source.tar.gz').open('wb') as f:
 with gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0) as gz:gz.write(data.getvalue())
print('Rollermaze:',len(files),'editable module/build files archived locally.')
