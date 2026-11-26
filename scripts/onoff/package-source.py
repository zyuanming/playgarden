#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import io, gzip, tarfile
ROOT=Path(__file__).resolve().parents[2]
paths=[]
for directory in ['third_party/onoff','scripts/onoff']:
 paths.extend(p for p in (ROOT/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
for name in ['src/games/OnoffGame.tsx','src/games/onoffGame.css','docs/onoff-original.md','docs/onoff-catalog-entry.json','e2e/onoff.spec.ts','package.json','package-lock.json','tsconfig.json','LICENSE']:
 if (ROOT/name).exists():paths.append(ROOT/name)
buffer=io.BytesIO()
with tarfile.open(fileobj=buffer,mode='w',format=tarfile.PAX_FORMAT) as archive:
 for path in sorted(set(paths)):
  data=path.read_bytes();info=tarfile.TarInfo(path.relative_to(ROOT).as_posix());info.size=len(data);info.mtime=0;info.mode=0o644;info.uid=info.gid=0
  archive.addfile(info,io.BytesIO(data))
out=ROOT/'public/games/onoff/source.tar.gz'
out.parent.mkdir(parents=True,exist_ok=True)
with out.open('wb') as f:
 with gzip.GzipFile(filename='',fileobj=f,mode='wb',mtime=0) as zipped:zipped.write(buffer.getvalue())
print('ONOFF complete module source archive generated.')
