#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import json,hashlib,zipfile
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public/gridland-original';VENDOR=ROOT/'vendor/gridland-original';ZIP=PUBLIC/'source.zip';MANIFEST=VENDOR/'distribution-manifest.json'
files=[]
for d in [PUBLIC,VENDOR,ROOT/'scripts/gridland']:
 files += [p for p in d.rglob('*') if p.is_file() and p not in [ZIP,MANIFEST] and '__pycache__' not in p.parts]
files += [ROOT/x for x in ['src/games/GridlandOriginal.tsx','src/games/gridlandOriginal.css','e2e/gridland.spec.ts','e2e/fixtures/gridland-earned-round2.json','e2e/fixtures/gridland-earned-round4.json','e2e/fixtures/gridland-earned-round5.json','e2e/fixtures/gridland-earned-round6.json','e2e/fixtures/gridland-earned-round7.json','e2e/fixtures/gridland-earned-round8.json','e2e/fixtures/gridland-earned-round9.json','e2e/fixtures/gridland-earned-round10.json','e2e/fixtures/gridland-earned-round11.json','e2e/fixtures/gridland-earned-round12.json','e2e/fixtures/gridland-earned-round13.json','e2e/fixtures/gridland-earned-round14.json','e2e/fixtures/gridland-earned-round15.json','e2e/fixtures/gridland-earned-round16.json','e2e/fixtures/gridland-earned-round17.json','e2e/fixtures/gridland-earned-round18.json','docs/gridland-adaptation.md']]
files=sorted(set(files));records=[]
for p in files:
 rel=str(p.relative_to(ROOT));b=p.read_bytes();license='GPL-3.0-only'
 if '/upstream/' in rel or ('public/gridland-original/js/app/' in rel and p.name!='zh.js') or rel.endswith('/css/main.css') or '/img/' in rel:license='MPL-2.0'
 if '/dependencies/' in rel or rel.endswith('/lib/jquery.js') or rel.endswith('/lib/require.js'):license='MIT'
 if p.name in ['LICENSES.txt','NOTICE.txt']:license='Component license/attribution collection'
 records.append({'path':rel,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'license':license})
with zipfile.ZipFile(ZIP,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in files:
  info=zipfile.ZipInfo(str(p.relative_to(ROOT)),(2026,10,11,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,p.read_bytes())
b=ZIP.read_bytes();MANIFEST.write_text(json.dumps({'game':'gridland','commit':'06af02c3af7062aead04a1e6f67b6e59f3e4b6a1','levelCount':0,'campaign':True,'archive':str(ZIP.relative_to(ROOT)),'files':records+[{'path':str(ZIP.relative_to(ROOT)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'license':'MPL-2.0 / MIT / GPL-3.0-only per member'}]},indent=2)+'\n');print('Gridland source archive',len(files),'files',len(b),'bytes',hashlib.sha256(b).hexdigest())
