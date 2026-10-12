# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
import hashlib,json,zipfile
r=Path(__file__).resolve().parents[2];v=r/'vendor/sql-mystery-original';p=r/'public/sql-mystery'
sha=lambda b:hashlib.sha256(b).hexdigest()
s=json.loads((v/'source-manifest.json').read_text())
assert s['commit']=='a7aa22701bd41b24e905be387fb17326db982df9'
for f in s['immutableFiles']:
 b=(r/f['path']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['path']
 if f.get('gitBlobSha1'):assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==f['gitBlobSha1']
assert (p/'case.db').read_bytes()==(v/'upstream/sql-murder-mystery.db').read_bytes()
assert sha((p/'case.db').read_bytes())=='b8a9e0ff65c73fb790544240805309dd938ff2bd6993ec0e671e4a4c228e740b'
for n in ['sqlite-src-3540000.zip','sqlite-amalgamation-3540000.zip']:
 with zipfile.ZipFile(v/'sqlite'/n) as z:assert z.testzip() is None
js=(p/'sqlite3.js').read_text();assert 'be8d059e9a49089ab2dce5ed26dd87aaf598fdc5fbe0b107c0dd758464bcd5e3' in js
notice=(p/'LICENSES.txt').read_text();assert (v/'upstream/LICENSE').read_text().strip() in notice
for n in ['emscripten-LICENSE','emscripten-AUTHORS','emscripten-musl-COPYRIGHT','emscripten-compiler-rt-LICENSE']:assert (v/'sqlite'/n).read_text().strip() in notice
for t in ['CC BY-SA 4.0','creativecommons.org/licenses/by-sa/4.0/legalcode','Joon Park','Cathy He','GPL-3.0-only']:assert t in notice,t
worker=(p/'worker.js').read_text();host=(r/'src/games/SqlMystery.tsx').read_text()
for t in ["importScripts('./sqlite3.js')","fetch('./case.db')",'sqlite3_set_authorizer','SQLITE_DENY', 'sqlite3_stmt_readonly', 'sqlite3_sql(stmt)','load_extension','sqlite3_progress_handler','maximum: 1024',"'opfs-sahpool': true"]:assert t in worker,t
for t in ['w.terminate()','d.session !== session','d.id !== current.current','worker.current !== w','playgarden.sql-mystery.v1','3500','32000']:assert t in host,t
assert 'dangerouslySetInnerHTML' not in host and 'innerHTML' not in host
assert 'eval(' not in worker and 'new Function' not in worker
for n in ['sql-wasm.wasm','sql-wasm.js','extension-functions.c','174092-clue-illustration.png']:assert not list(p.rglob(n))
d=json.loads((v/'distribution-manifest.json').read_text());expected={f['path'] for f in d['files'] if f['path']!=d['archive']}
for f in d['files']:
 b=(r/f['path']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256'],f['path']
with zipfile.ZipFile(r/d['archive']) as z:
 assert z.testzip() is None and set(z.namelist())==expected
 for n in z.namelist():assert z.read(n)==(r/n).read_bytes(),n
print('SQL Mystery: fixed original case, exact official SQLite and source archives, licenses and source closure verified; no gameplay executed')
