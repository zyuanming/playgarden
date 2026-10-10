#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Static source/level/license integrity; no execution of the original runtime.
from pathlib import Path
import hashlib,json,re,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
base=root/'vendor/hexahedral-original'
manifest=json.loads((base/'source-manifest.json').read_text())
for row in manifest['files']:
 data=(base/'upstream'/row['path']).read_bytes()
 assert len(data)==row['bytes']
 assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['git_blob']
 assert hashlib.sha256(data).hexdigest()==row['sha256']
assert (root/'public/hexahedral-LICENSE.txt').read_bytes()==(base/'upstream/LICENSE').read_bytes()
original=(base/'upstream/src/levels.js').read_text()
pattern=r'maxMoves:\s*(\d+),\s*playerPosition:\s*\{ row:\s*(\d+), column:\s*(\d+) \},\s*tiles:\s*createLevelTiles\(\[(.*?)\]\)'
levels=[]
for i,m in enumerate(re.finditer(pattern,original,re.S)):
 rows=re.findall(r"'([0_x]+)'",m[4]);n=len(rows)
 levels.append({'id':f'hexahedral-{i+1:02}','maxMoves':int(m[1]),'start':int(m[2])*n+int(m[3]),'rows':rows,'chapter':['初阶','进阶','高阶'][i//10]})
generated=(root/'src/games/hexahedralLevels.ts').read_text().split('export const hexahedralLevels:readonly HexahedralLevel[]=',1)[1].strip().rstrip(';')
assert len(levels)==30 and levels==json.loads(generated)
for path in [root/'src/vendor/hexahedralCore.ts',root/'src/games/HexahedralGame.tsx']:
 assert not re.search(r'\b(?:eval|fetch|XMLHttpRequest|WebSocket)\s*\(',path.read_text())
ET.parse(root/'public/hexahedral-art.svg')
print(json.dumps({'verified_upstream_texts':len(manifest['files']),'unchanged_original_levels':30,'chapters':3,'audio_assets_redistributed':False,'browser_validation':'pending'},ensure_ascii=False))
