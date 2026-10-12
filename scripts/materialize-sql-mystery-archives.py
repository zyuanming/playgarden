# SPDX-License-Identifier: GPL-3.0-only
"""Reassemble exact source archives from local Git transport parts; no network."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
TRANSPORT=ROOT/'vendor/sql-mystery-transport'
ALLOWED={'public/sql-mystery/source.zip','vendor/sql-mystery-original/sqlite/sqlite-src-3540000.zip'}
manifest=json.loads((TRANSPORT/'manifest.json').read_text())
assert manifest['schema']==1 and {r['target'] for r in manifest['archives']}==ALLOWED
verified=[]
for row in manifest['archives']:
 target=ROOT/row['target'];assert 0<row['bytes']<=32*1024*1024
 pieces=[]
 for index,part in enumerate(row['parts']):
  assert re.fullmatch(r'(source|sqlite-src)-\d{2}\.part',part['file'])
  assert part['file']==row['prefix']+'-'+str(index).zfill(2)+'.part'
  b=(TRANSPORT/part['file']).read_bytes()
  assert len(b)==part['bytes']<=3*1024*1024
  assert hashlib.sha256(b).hexdigest()==part['sha256']
  pieces.append(b)
 b=b''.join(pieces)
 assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
 verified.append((target,b))
for target,b in verified:
 if target.is_file() and target.read_bytes()==b:continue
 target.parent.mkdir(parents=True,exist_ok=True)
 temp=target.with_suffix(target.suffix+'.transport.tmp');temp.write_bytes(b);temp.replace(target)
print('SQL Mystery: two exact source archives materialized from verified local parts.')
