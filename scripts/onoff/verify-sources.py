#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Bounded provenance/resource checks, not a gameplay test or campaign sweep."""
from pathlib import Path
import hashlib, json, sys, tarfile
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'third_party/onoff'
PIN='cb1e2e4615af6195aeb0dade06c08738511dd3b6'
tree=json.loads((BASE/'upstream-tree.json').read_text())
assert tree['sha']==PIN
entries={e['path']:e for e in tree['tree'] if e['type']=='blob'}
for path in (BASE/'original').rglob('*'):
 if not path.is_file():continue
 name=path.relative_to(BASE/'original').as_posix();data=path.read_bytes()
 actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
 assert actual==entries[name]['sha'],f'Upstream mismatch: {name}'
assert (BASE/'adapted/src/levels.js').read_bytes()==(BASE/'original/src/levels.js').read_bytes(), 'Original 25-level definitions changed'
for path in (BASE/'adapted').rglob('*'):
 if not path.is_file():continue
 text=path.read_text()
 for token in ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'navigator.clipboard', 'new WebSocket', 'eval(', 'new Function']:
  assert token not in text,f'Unexpected runtime capability {token}: {path}'
for name in ['LICENSE-MIT.txt','TinyMusic-MIT.txt','PLAYGARDEN-COPYING.txt']:
 assert len((BASE/'licenses'/name).read_text())>1000
if '--runtime' in sys.argv:
 manifest=json.loads((ROOT/'public/games/onoff/files.json').read_text())
 for name, expected in manifest['files'].items():
  assert hashlib.sha256((ROOT/'public/games/onoff'/name).read_bytes()).hexdigest()==expected,name
if '--archive' in sys.argv:
 with tarfile.open(ROOT/'public/games/onoff/source.tar.gz','r:gz') as archive:
  for item in archive:
   if not item.isfile():continue
   assert '..' not in Path(item.name).parts and not item.name.startswith('/')
   assert archive.extractfile(item).read()==(ROOT/item.name).read_bytes(),item.name
print('ONOFF fixed upstream source, original levels, local assets and complete licenses verified.')
