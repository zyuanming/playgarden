#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Bounded source, rights and map-identity checks, not a gameplay solver."""
import hashlib,json,re,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'third_party/rollermaze'
m=json.loads((SRC/'SOURCE-MANIFEST.json').read_text())
assert m['commit']=='2a08f83fa3935fc981ac6efce26e2b9d6d34a5ed'
for entry in m['files']:
 b=(SRC/'original'/entry['path']).read_bytes()
 assert len(b)==entry['bytes'] and hashlib.sha256(b).hexdigest()==entry['sha256'],entry['path']
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==entry['gitBlob'],entry['path']
assert (SRC/'LICENSE-MIT.txt').read_bytes()==(SRC/'original/LICENSE').read_bytes()
assert (SRC/'PLAYGARDEN-COPYING.txt').read_bytes()==(ROOT/'LICENSE').read_bytes()
assert 'license: public domain' in (SRC/'MicroW-PUBLIC-DOMAIN.md').read_text()
assert (SRC/'adapted-src/levels.js').read_bytes()==(SRC/'original/levels.js').read_bytes()
assert (SRC/'adapted-src/models.js').read_bytes()==(SRC/'original/models.js').read_bytes()
levels=re.findall(r'\{width:(\d+),height:(\d+),title:"([^"]*)",tiles:\[([^\]]*)\]',(SRC/'original/levels.js').read_text())
assert len(levels)==25
for i,(w,h,title,encoded) in enumerate(levels,1):
 chunks=encoded.split(',')
 if chunks[-1]=='':chunks.pop()
 tiles=[int(t) if t else 0 for t in chunks]
 # Original sparse JS omits trailing empty cells; native loadlevel uses value||0.
 assert len(tiles)<=int(w)*int(h)
 tiles += [0]*(int(w)*int(h)-len(tiles))
 tree=ET.parse(SRC/f'original/assets/level{i}.tmx');el=tree.getroot()
 original=[int(t) for t in el.find('layer/data').text.strip().split(',')]
 assert (int(w),int(h))==(int(el.attrib['width']),int(el.attrib['height']))
 assert len(tiles)==len(original)==int(w)*int(h) and tiles==original,(i,'map data')
 assert el.find('properties/property').attrib['value']==title
 assert tiles.count(3)==1 and 2 in tiles
for excluded in ['font.js','music.js','trout.mid','big_screenshot.png','small_screenshot.png','tilemap.png']:
 assert not list(SRC.rglob(excluded)) and not list((ROOT/'public/games/rollermaze').rglob(excluded)),excluded
print('Rollermaze: exact MIT source hashes, full notices, exclusions and all 25 original TMX/runtime map identities verified.')
