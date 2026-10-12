# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import hashlib,json,zipfile
r=Path(__file__).resolve().parents[2];p=r/'public/sql-mystery';v=r/'vendor/sql-mystery-original';out=p/'source.zip';manifest=v/'distribution-manifest.json'
files=[]
for d in [p,v,Path(__file__).parent]:files.extend(x for x in d.rglob('*') if x.is_file() and x not in [out,manifest] and '__pycache__' not in x.parts)
files.extend(r/x for x in ['src/games/SqlMystery.tsx','src/games/sqlMystery.css','e2e/sql-mystery.spec.ts'])
files=sorted(set(files));rows=[]
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in files:
  path=str(f.relative_to(r));b=f.read_bytes();i=zipfile.ZipInfo(path,(2026,10,12,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=0o644<<16;z.writestr(i,b)
  rows.append({'path':path,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
b=out.read_bytes();rows.append({'path':str(out.relative_to(r)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
manifest.write_text(json.dumps({'game':'sql-mystery','sourceCommit':'a7aa22701bd41b24e905be387fb17326db982df9','finiteLevels':0,'completeCases':1,'originalInvestigationStages':2,'archive':str(out.relative_to(r)),'files':rows},indent=2)+'\n')
print(len(files),'source members',len(b),'archive bytes',hashlib.sha256(b).hexdigest())
