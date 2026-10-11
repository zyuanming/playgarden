# SPDX-License-Identifier: GPL-3.0-only
"""Build a deterministic corresponding-source archive; no upstream script runs."""
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[2]
PUBLIC=ROOT/'public/hyperspace-garbage-collection'
VENDOR=ROOT/'vendor/hyperspace-garbage-collection-original'

def record(p):
    data=p.read_bytes()
    return {'path':p.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def write(p,data):p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
runtime=[p for p in sorted(PUBLIC.rglob('*')) if p.is_file() and p.name not in ['source.zip','runtime-manifest.json']]
write(PUBLIC/'runtime-manifest.json',{'revision':'hgc-f5b93cbb-playgarden-1','files':[record(p) for p in runtime]})
files=[]
for directory in ['public/hyperspace-garbage-collection','vendor/hyperspace-garbage-collection-original','scripts/hyperspace-garbage-collection']:
    files += [p for p in (ROOT/directory).rglob('*') if p.is_file() and p.name not in ['source.zip','corresponding-source-manifest.json'] and '__pycache__' not in p.parts]
files += [ROOT/'src/games/HyperspaceGarbageCollection.tsx', ROOT/'src/games/hyperspaceGarbageCollection.css', ROOT/'e2e/hyperspace-garbage-collection.spec.ts']
files += list((ROOT/'docs').glob('hyperspace-garbage-collection-*'))
files=sorted(set(files))
manifest=VENDOR/'corresponding-source-manifest.json'
write(manifest,{'upstreamCommit':'f5b93cbb57f653be4455f9dd5c130463b11abe2a','scope':'All distributed game runtime, editable cleared source, own host additions, adaptation/packaging/verification scripts and targeted E2E. Shared Playgarden React/build dependencies are supplied by its root source manifest.','files':[record(p) for p in files]})
with zipfile.ZipFile(PUBLIC/'source.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(files+[manifest]):
        info=zipfile.ZipInfo(p.relative_to(ROOT).as_posix(),date_time=(2026,10,11,0,0,0)); info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
        z.writestr(info,p.read_bytes())
archive=PUBLIC/'source.zip'; digest=hashlib.sha256(archive.read_bytes()).hexdigest()
(ROOT/'PACKAGE.sha256').write_text(f'{digest}  public/hyperspace-garbage-collection/source.zip\n')
print(f'{len(files)+1} source files; source.zip {archive.stat().st_size} bytes; SHA-256 {digest}')
