from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parents[2];v=p/'vendor/crisp-original'
m=json.loads((v/'cardq-source-manifest.json').read_text())
for r in m['files']:
 b=(v/r['dest']).read_bytes()
 assert len(b)==r['expected_bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],r['path']
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['git_blob_sha1'],r['path']
assert (p/'public/crisp-original/cardq/main.js').read_bytes()==(v/'upstream/games/docs/cardq/main.js').read_bytes()
assert (v/'cardq-LICENSE.txt').read_text().strip() in (p/'public/crisp-original/LICENSES.txt').read_text()
print('CARD Q: exact original main and MIT source notice verified; zero finite levels.')
