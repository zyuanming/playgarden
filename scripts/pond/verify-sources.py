from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parents[2];v=p/'vendor/pond-original'
m=json.loads((v/'source-records.json').read_text())
assert m['commit']=='68fa8b542bff6c405cce83a6bd433e16e7b4e7f6'
for r in m['files']:
 b=(v/'upstream'/(r['path']+'.txt')).read_bytes()
 assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],r['path']
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['gitBlob'],r['path']
assert len(m['files'])==14
notice=(p/'public/pond-LICENSE.txt').read_text()
assert (v/'upstream/LICENSE.txt').read_text() in notice
assert (v/'upstream/COPYING.txt').read_text() in notice
assert not (v/'upstream/index.html.txt').exists()
print('Pond:14 exact first-party source/license files verified; no finite levels.')
