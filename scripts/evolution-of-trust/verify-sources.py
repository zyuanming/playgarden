# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import hashlib,json,re,zipfile
r=Path(__file__).resolve().parents[2];p=r/'public/evolution-of-trust';v=r/'third_party/evolution-of-trust'
sha=lambda b:hashlib.sha256(b).hexdigest()
s=json.loads((v/'source-manifest.json').read_text());assert s['commit']=='6ec45d73befdb922bd40654dd1c1c903a953562f'
for row in s['immutableFiles']:
 b=(r/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==row['gitBlobSha1']
assert (p/'js/sims/PD.js').read_bytes()==(v/'original/js/sims/PD.js').read_bytes()
def paragraph_ids(path):
 text=re.sub(r'<!--.*?-->','',path.read_text(),flags=re.S)
 ids=re.findall(r'<p\s+id="([^"]+)"',text)
 assert len(ids)==len(set(ids))==231
 return set(ids)
assert paragraph_ids(p/'words.html')==paragraph_ids(v/'original/words.html')
for name in ['button1.mp3','button2.mp3','button3.mp3','bonk.mp3','machine_start.mp3','scratch_in.mp3','scratch_out.mp3','FuturaHandwritten.ttf','truce.jpg']:
 assert not list(p.rglob(name)),name
for name in ['Iterated.js','Splash.js','Tournament.js']:
 t=(p/'js/sims'/name).read_text();assert 'resolution:2}, true)' in t and 'TrustLifecycle.registerApp(app)' in t
html=(p/'index.html').read_text();assert "script-src 'self'" in html and 'unsafe-eval' not in html
assert 'sharing.js' not in html and 'FuturaHandwritten' not in (p/'css/slides.css').read_text()
for rel in re.findall(r'(?:src|href)="([^"#?]+)',html):
 assert not rel.startswith(('http:','https:','//'));assert (p/rel).is_file(),rel
notice=(p/'NOTICE.txt').read_text()
for name in ['Nicky Case','吴桐','唐鳳','CC0','GPL-3.0-only','Komiku','THIRD-PARTY']:
 assert name in notice,name
assert (p/'THIRD-PARTY-NOTICES.txt').read_bytes()==(v/'licenses/THIRD-PARTY-NOTICES.txt').read_bytes()
assert (p/'Playgarden-GPL-3.0.txt').read_bytes()==(r/'LICENSE').read_bytes()
d=json.loads((v/'distribution-manifest.json').read_text())
for row in d['files']:
 b=(r/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
with zipfile.ZipFile(r/d['archive']) as z:
 assert z.testzip() is None
 assert set(z.namelist())=={row['path'] for row in d['files'] if row['path']!=d['archive']}
 for name in z.namelist():assert z.read(name)==(r/name).read_bytes(),name
print('Trust: fixed original resources, unchanged strategies, complete notices and corresponding-source closure verified; no gameplay executed')
