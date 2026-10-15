# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
from html.parser import HTMLParser
import json,hashlib,zipfile,re,base64
r=Path(__file__).resolve().parents[2];p=r/'public/elevator-saga';v=r/'vendor/elevator-saga-original'
sha=lambda b:hashlib.sha256(b).hexdigest()
source=json.loads((v/'source-manifest.json').read_text())
assert source['commit']=='e0c55bf8cf59243c32dc371b2cc7b2e3ec1664af'
for row in source['files']:
 b=(v/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'];assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==row['gitBlobSha1']
for n in ['movable.js','floor.js','user.js','elevator.js','interfaces.js','world.js','challenges.js']:
 assert (p/n).read_bytes()==(v/'upstream'/n).read_bytes()
challenges=(p/'challenges.js').read_text();assert len(re.findall(r'condition: require(?!Demo)',challenges))==18 and challenges.count('condition: requireDemo()')==1
assert 'requireUserCountWithinTimeWithMaxWaitTime(2675, 1800, 45)' in challenges
assert len(json.loads((r/'src/games/elevatorSagaLevels.json').read_text()))==18
class Page(HTMLParser):
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);assert all(not k.lower().startswith('on') for k in a)
  if tag in ['script','link']:
   url=a.get('src') or a.get('href');assert url and not re.match(r'^(?:[a-z]+:|//)',url);assert (p/url).is_file()
Page().feed((p/'index.html').read_text())
index=(p/'index.html').read_text()
for text in ["default-src 'none'","connect-src 'none'","worker-src blob:","frame-src 'none'","object-src 'none'","form-action 'none'","font-src data:"]:assert text in index
worker=(p/'worker-bootstrap.js').read_text();generated=(p/'worker-source.js').read_text().split('window.ELEVATOR_WORKER_SOURCE = ',1)[1].strip();assert json.loads(generated[:-1])==worker
assert worker.index('Object.defineProperty(self, key')<worker.index('self.getCodeObjFromCode(data.code)')
assert "Object.getPrototypeOf(self)" in worker and "!controller.isPaused && result === null" in worker
adapter=(p/'adapter.js').read_text()
for text in ['worker.terminate()','URL.revokeObjectURL','lastHeartbeat > 2500','messageCount > 240','code.length > 64000','d.users.length <= 6000',"event.source !== parent",'event.origin !== parentOrigin',"data.type === 'init'"]:
 assert text in (adapter+'\n'+worker),text
host=(r/'src/games/ElevatorSaga.tsx').read_text();assert 'sandbox="allow-scripts"' in host and 'allow-same-origin' not in host and "event.origin !== 'null'" in host and "element.src = 'about:blank'" in host
css=(p/'font-awesome-embedded.css').read_text();b64=re.search(r'data:font/ttf;base64,([^\'\)]+)',css).group(1);assert base64.b64decode(b64)==(p/'fonts/fontawesome-webfont.ttf').read_bytes()
notice=(p/'LICENSES.txt').read_text()
for f in (p/'licenses').glob('*.txt'):assert f.read_text().strip() in notice
assert (p/'LICENSE.txt').read_text().strip() in notice
for row in json.loads((v/'dependency-manifest.json').read_text()):
 b=(p/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
d=json.loads((v/'distribution-manifest.json').read_text());expected={row['path'] for row in d['files'] if row['path']!=d['archive']}
for row in d['files']:
 b=(r/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
with zipfile.ZipFile(r/d['archive']) as z:
 assert z.testzip() is None and set(z.namelist())==expected
 for name in z.namelist():assert z.read(name)==(r/name).read_bytes()
print('Elevator Saga: original 18 predicates, identity, notices, source closure and static isolation checks passed; no gameplay executed')
