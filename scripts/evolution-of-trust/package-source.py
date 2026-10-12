# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import hashlib,json,zipfile,sys
r=Path(__file__).resolve().parents[2]
p=r/'public/evolution-of-trust';v=r/'third_party/evolution-of-trust'
out=p/'source.zip';manifest=v/'distribution-manifest.json'
files=[]
for d in [p,v,Path(__file__).parent]:
 files.extend(f for f in d.rglob('*') if f.is_file() and f not in [out,manifest] and '__pycache__' not in f.parts)
files.extend(r/f for f in ['src/games/EvolutionOfTrust.tsx','src/games/evolutionOfTrust.css','e2e/evolution-of-trust.spec.ts'])
rows=[]
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in sorted(set(files)):
  name=str(f.relative_to(r));data=f.read_bytes();info=zipfile.ZipInfo(name,(2026,10,12,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,data)
  rows.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
data=out.read_bytes();rows.append({'path':str(out.relative_to(r)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
expected={'game':'evolution-of-trust','sourceCommit':'6ec45d73befdb922bd40654dd1c1c903a953562f','finiteLevels':0,'interactiveJourneys':1,'archive':str(out.relative_to(r)),'files':rows}
if '--check-manifest' in sys.argv:
 assert json.loads(manifest.read_text())==expected,'Rebuilt source archive differs from committed manifest'
else:
 manifest.write_text(json.dumps(expected,indent=2)+'\n')
print(len(files),'source files',len(data),'archive bytes')
