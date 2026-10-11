#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
from html.parser import HTMLParser
import json,hashlib,zipfile,re
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public/gridland-original';VENDOR=ROOT/'vendor/gridland-original'
source=json.loads((VENDOR/'source-manifest.json').read_text())
for row in source['files']:
 b=(ROOT/row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'];assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==row['gitBlob'],row['path']
for name in ['buildings','dragonsprite','expbar','icons','magic','monsters','select-border','tiles','title']:assert (PUBLIC/'img'/f'{name}.png').read_bytes()==(VENDOR/'upstream/www/img'/f'{name}.png').read_bytes()
for lib in ['jquery','requirejs']:assert (PUBLIC/'lib'/('jquery.js' if lib=='jquery' else 'require.js')).read_bytes()==(VENDOR/'dependencies'/lib/('jquery.js' if lib=='jquery' else 'require.js')).read_bytes()
notice=(PUBLIC/'LICENSES.txt').read_text()
for p in [VENDOR/'upstream/LICENSE',VENDOR/'dependencies/jquery/MIT-LICENSE.txt',VENDOR/'dependencies/requirejs/LICENSE']:assert p.read_text() in notice
assert (PUBLIC/'Playgarden-GPL-3.0.txt').read_bytes()==(ROOT/'LICENSE').read_bytes()
app='\n'.join(p.read_text() for p in (PUBLIC/'js/app').rglob('*.js'))
for forbidden in ['https://','http://','localStorage','sessionStorage','eval(', 'new Function(', 'XMLHttpRequest','fetch(', 'sendBeacon','google-analytics','app/audio']:assert forbidden not in app,forbidden
class Page(HTMLParser):
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);assert not any(k.lower().startswith('on') for k in a)
  if tag in ['script','link','img']:
   url=a.get('src') or a.get('href');assert url and not re.match(r'^(?:[a-z]+:|//)',url);assert (PUBLIC/url).is_file(),url
Page().feed((PUBLIC/'index.html').read_text())
html=(PUBLIC/'index.html').read_text();assert "connect-src 'none'" in html and "script-src 'self'" in html and 'unsafe-eval' not in html
storage=(PUBLIC/'storage.js').read_text();assert 'playgarden:gridland:v1:' in storage and 'localStorage.clear' not in storage
for p in [PUBLIC/'lifecycle.js',PUBLIC/'bridge.js']:assert 'Math.random =' not in p.read_text()
d=json.loads((VENDOR/'distribution-manifest.json').read_text());assert d['campaign'] and d['levelCount']==0
for row in d['files']:
 b=(ROOT/row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
with zipfile.ZipFile(ROOT/d['archive']) as z:
 names={r['path']for r in d['files']if r['path']!=d['archive']};assert set(z.namelist())==names and len(z.namelist())==len(names);assert z.testzip() is None
 for p in names:assert z.read(p)==(ROOT/p).read_bytes();assert not p.startswith('/') and '..' not in Path(p).parts and 'audit-only' not in p
expected={r['path']for r in d['files']if r['path'].startswith('public/gridland-original/')};assert expected=={str(p.relative_to(ROOT))for p in PUBLIC.rglob('*')if p.is_file()}
print('Gridland exact original inputs, full licenses, local runtime references and complete corresponding-source archive verified. No browser PASS implied.')
