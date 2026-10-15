#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Reproducible module-source archive. It is not the whole Playgarden source."""
from pathlib import Path
import gzip,hashlib,io,json,tarfile
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'third_party/black-hole-square'
DEST=ROOT/'public/games/black-hole-square'
def main():
    DEST.mkdir(parents=True,exist_ok=True)
    for original,name in [(SOURCE/'LICENSE-MIT.txt','LICENSE-MIT.txt'),(SOURCE/'PLAYGARDEN-COPYING.txt','PLAYGARDEN-COPYING.txt'),
        (SOURCE/'font-provenance/Gugi-author-OFL.txt','Gugi-OFL.txt'),(SOURCE/'ADAPTATION.md','ADAPTATION.md'),
        (SOURCE/'original/README.md','ORIGINAL-README.md'),(SOURCE/'original/scratch/title.svg','title.svg')]:
        (DEST/name).write_bytes(original.read_bytes())
    files=[]
    for prefix in ['third_party/black-hole-square','scripts/black-hole-square']:
        files += [p for p in (ROOT/prefix).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    for relative in ['src/games/BlackHoleSquareGame.tsx','src/games/blackHoleSquareGame.css',
        'public/games/black-hole-square/index.html','public/games/black-hole-square/frame.css',
        'e2e/black-hole-square.spec.ts','e2e/black-hole-square-focus.spec.ts','e2e/fixtures/black-hole-square-input-plans.json']:
        files.append(ROOT/relative)
    # In an integrated checkout include its exact official locked build context.
    context=['package.json','package-lock.json','src/lib/types.ts','e2e/helpers.ts','playwright.config.ts']
    context += [p.relative_to(ROOT).as_posix() for p in ROOT.glob('tsconfig*.json')]
    files += [ROOT/name for name in context if (ROOT/name).is_file()]
    files=sorted(set(files),key=lambda p:p.relative_to(ROOT).as_posix())
    records=[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
    data=io.BytesIO()
    with tarfile.open(fileobj=data,mode='w',format=tarfile.PAX_FORMAT) as archive:
        for p in files:
            blob=p.read_bytes();entry=tarfile.TarInfo(p.relative_to(ROOT).as_posix());entry.size=len(blob);entry.mode=0o644;entry.mtime=0
            archive.addfile(entry,io.BytesIO(blob))
        blob=(json.dumps(records,indent=2)+'\n').encode();entry=tarfile.TarInfo('ARCHIVE-MANIFEST.json');entry.size=len(blob);entry.mode=0o644;entry.mtime=0
        archive.addfile(entry,io.BytesIO(blob))
    with (DEST/'source.tar.gz').open('wb') as output:
        with gzip.GzipFile(filename='',mode='wb',fileobj=output,mtime=0) as packed:packed.write(data.getvalue())
    print('Black Hole Square: archived',len(files),'module-source files; game execution NOT_PERFORMED.')
if __name__=='__main__':main()
