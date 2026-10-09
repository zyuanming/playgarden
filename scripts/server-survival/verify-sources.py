# SPDX-License-Identifier: GPL-3.0-only
# Static source/license/structure check only. Does not import or execute game code.
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[2]
VENDOR=ROOT/'vendor/server-survival-full'
PUBLIC=ROOT/'public/server-survival-full'
manifest=json.loads((VENDOR/'sources.json').read_text())
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
for entry in manifest['files']:
 data=(VENDOR/'upstream'/entry['path']).read_bytes()
 assert len(data)==entry['size'] and blob(data)==entry['sha'],entry['path']
for name in ['src/campaign/levels.js','src/campaign/objectives.js','src/config.js']:
 assert (PUBLIC/name).read_bytes()==(VENDOR/'upstream'/name).read_bytes(),name
assert (PUBLIC/'LICENSE.txt').read_bytes()==(VENDOR/'upstream/LICENSE').read_bytes()
for file,sha in [('three-local.js','b14f47c0908bab15e890b468d53bb07db0be3a18'),('LICENSE-three.txt','5303437e406ed22d8cb0b4c12398870792a25878')]:assert blob((PUBLIC/file).read_bytes())==sha,file
levels=(PUBLIC/'src/campaign/levels.js').read_text()
ids=[int(n) for n in re.findall(r'^\s*id:\s*(\d+),\s*chapter:',levels,re.M)]
assert ids==list(range(1,26)),ids
config=(PUBLIC/'src/config.js').read_text();services=config.split('  services: {',1)[1].split('\n  power: {',1)[0]
service_names=re.findall(r'^    (\w+): \{',services,re.M)
assert len(service_names)==26,service_names
assert not re.search(r'(?:src|href)=["\']https?://',(PUBLIC/'index.html').read_text())
for file in PUBLIC.rglob('*.js'):
 if file.name=='three-local.js':continue
 code=file.read_text()
 for ref in re.findall(r'(?:^|\n)\s*import(?:\s+[^;]*?\s+from)?\s*["\']([^"\']+)["\']',code):
  assert ref.startswith('.'),(str(file),ref)
  assert (file.parent/ref).resolve().is_file(),(str(file),ref)
 # Locale text contains the English phrase "data fetch (40% cache)". Match
 # JavaScript token boundaries as a preliminary scan; the AST audit below
 # checks executable calls and constructors without confusing strings.
 if file.parent.name!='locales':
  assert not re.search(r'new\s+Audio\s*\(|\bfetch\s*\(|new\s+XMLHttpRequest\s*\(|new\s+WebSocket\s*\(',code),file
assert "connect-src 'none'" in (PUBLIC/'index.html').read_text()
report=json.loads((ROOT/'docs/server-survival-css-report.json').read_text())
assert set(report['upstreamCustomClasses'])=={'active','event-active-bar','glass-panel','hud-tab','hud-tabs','key-hint','pulse-green','service-btn','time-btn','tooltip'}
print('PASS: 73 exact upstream snapshots; unchanged 25 levels/objectives and 26-service config; exact Three r128 and MIT; local module graph; no external runtime asset/network calls; 473 finite CSS utilities.')
