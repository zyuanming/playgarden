#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Reproducible Ghosted module-source archive. Does not execute upstream code."""
from pathlib import Path
import gzip, hashlib, io, json, tarfile
ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'public/games/ghosted'
SOURCE = ROOT / 'third_party/ghosted'

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    for source, name in [(SOURCE/'LICENSE-MIT.txt', 'LICENSE-MIT.txt'),
                         (SOURCE/'PLAYGARDEN-COPYING.txt', 'PLAYGARDEN-COPYING.txt'),
                         (SOURCE/'ADAPTATION.md', 'ADAPTATION.md'),
                         (SOURCE/'original/README.md', 'ORIGINAL-README.md'),
                         (SOURCE/'lfs/f.png', 'f.png'), (SOURCE/'lfs/g.png', 'g.png')]:
        (DEST/name).write_bytes(source.read_bytes())
    paths = []
    for prefix in ['third_party/ghosted', 'scripts/ghosted']:
        paths += [p for p in (ROOT/prefix).rglob('*') if p.is_file() and '.build' not in p.parts]
    for relative in ['src/games/GhostedGame.tsx', 'src/games/ghostedGame.css',
                     'public/games/ghosted/index.html', 'public/games/ghosted/frame.css']:
        paths.append(ROOT/relative)
    paths += [p for p in (ROOT/'e2e').glob('ghosted*') if p.is_file()]
    fixture=ROOT/'e2e/fixtures/ghosted-input-traces.json'
    if fixture.is_file(): paths.append(fixture)
    # This is a module archive, not a claim to contain the complete host site.
    # Include useful exact host context when materialized in the integration repo.
    context = ['package.json', 'package-lock.json', 'src/lib/types.ts', 'e2e/helpers.ts',
               'vite.config.ts', 'playwright.config.ts']
    context += [p.relative_to(ROOT).as_posix() for p in ROOT.glob('tsconfig*.json')]
    paths += [ROOT/name for name in context if (ROOT/name).is_file()]
    paths = sorted(set(paths), key=lambda p:p.relative_to(ROOT).as_posix())
    manifest = [{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,
                 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]
    data = io.BytesIO()
    with tarfile.open(fileobj=data, mode='w', format=tarfile.PAX_FORMAT) as archive:
        for p in paths:
            content = p.read_bytes(); item = tarfile.TarInfo(p.relative_to(ROOT).as_posix())
            item.size=len(content); item.mode=0o644; item.mtime=0
            archive.addfile(item, io.BytesIO(content))
        content=(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n').encode()
        item=tarfile.TarInfo('ARCHIVE-MANIFEST.json');item.size=len(content);item.mode=0o644;item.mtime=0
        archive.addfile(item,io.BytesIO(content))
    with (DEST/'source.tar.gz').open('wb') as output:
        with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0) as zipped:zipped.write(data.getvalue())
    print(f'Ghosted: archived {len(paths)} corresponding-source files.')
if __name__=='__main__': main()
