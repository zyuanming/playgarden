# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import json,hashlib,zipfile
r=Path(__file__).resolve().parents[2];p=r/'public/elevator-saga';v=r/'vendor/elevator-saga-original';out=p/'source.zip';manifest=v/'distribution-manifest.json'
files=[]
for d in [p,v,Path(__file__).parent]:files.extend(x for x in d.rglob('*') if x.is_file() and x not in [out,manifest] and '__pycache__' not in x.parts)
files.extend(r/x for x in ['src/games/ElevatorSaga.tsx','src/games/elevatorSaga.css','src/games/elevatorSagaLevels.json','public/elevator-saga-card.svg','e2e/elevator-saga.spec.ts','e2e/fixtures/elevator-saga-dispatcher.js'])
files=sorted(set(files));records=[]
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in files:
  path=str(f.relative_to(r));b=f.read_bytes();info=zipfile.ZipInfo(path,(2026,10,11,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,b)
  records.append({'path':path,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
b=out.read_bytes();records.append({'path':str(out.relative_to(r)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
manifest.write_text(json.dumps({'game':'elevator-saga','sourceCommit':'e0c55bf8cf59243c32dc371b2cc7b2e3ec1664af','finiteLevels':18,'demoCounted':False,'archive':str(out.relative_to(r)),'files':records},indent=2)+'\n')
print(len(files),'source members',len(b),'archive bytes',hashlib.sha256(b).hexdigest())
