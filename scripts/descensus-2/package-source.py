# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public/descensus-2';VENDOR=ROOT/'vendor/descensus2-original'
def record(p):
 data=p.read_bytes();return {'path':p.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def write(p,data):p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
runtime=[p for p in sorted(PUBLIC.rglob('*')) if p.is_file() and p.name not in ['source.zip','runtime-manifest.json']]
write(PUBLIC/'runtime-manifest.json',{'revision':'descensus2-750003f-playgarden-1','files':[record(p) for p in runtime]})
files=[]
for directory in ['public/descensus-2','vendor/descensus2-original','scripts/descensus-2']:
 files.extend(p for p in (ROOT/directory).rglob('*') if p.is_file() and p.name not in ['source.zip','corresponding-source-manifest.json'] and '__pycache__' not in p.parts)
files.extend([ROOT/'src/games/Descensus2.tsx',ROOT/'src/games/descensus2.css',ROOT/'e2e/descensus-2.spec.ts',ROOT/'docs/descensus-2-source-map.json'])
manifest=VENDOR/'corresponding-source-manifest.json';files=sorted(set(files));write(manifest,{'upstreamCommit':'750003f12815a756ebd18634e88620c1050a1ec5','scope':'Complete editable original and adapted game, cleared assets, exact licensed vendor binaries and bounded patch, host, targeted test and build/packaging tools. Shared framework source is mapped in repository root.','files':[record(p) for p in files]})
with zipfile.ZipFile(PUBLIC/'source.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
 for p in sorted(files+[manifest]):
  info=zipfile.ZipInfo(p.relative_to(ROOT).as_posix(),(2026,10,11,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;archive.writestr(info,p.read_bytes())
print('Descensus2 source archive:',len(files)+1,'files', (PUBLIC/'source.zip').stat().st_size,'bytes',hashlib.sha256((PUBLIC/'source.zip').read_bytes()).hexdigest())
