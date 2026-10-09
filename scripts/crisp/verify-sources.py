#!/usr/bin/env python3
"""Static integrity and shipping-boundary audit; does not run any game."""
from pathlib import Path
import hashlib, json, re
ROOT=Path(__file__).resolve().parents[2]
V=ROOT/'vendor/crisp-original'
def digest(data): return hashlib.sha256(data).hexdigest()
count=0
for record in json.loads((V/'source-manifest.json').read_text())['files']:
    p=V/record['dest']; data=p.read_bytes()
    assert len(data)==record['expected_bytes'],p
    assert digest(data)==record['sha256'],p
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==record['git_blob_sha1'],p
    count+=1
for record in json.loads((ROOT/'docs/crisp-mml-source-addendum.json').read_text())['files']:
    data=(ROOT/record['path']).read_bytes()
    assert len(data)==record['bytes'] and digest(data)==record['sha256']
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==record['git_blob_sha1']
    count+=1
for game in ['castn','bamboo','parking']:
    assert (ROOT/f'public/crisp-original/{game}/main.js').read_bytes()==(V/f'upstream/games/docs/{game}/main.js').read_bytes()
runtime=list((ROOT/'public/crisp-original').rglob('*.js'))
for file in runtime:
    source=file.read_text()
    for pattern in [r'\beval\s*\(',r'\bnew\s+Function\s*\(',r'\bfetch\s*\(',r'\bXMLHttpRequest\b',r'\bWebSocket\b',r'\bsendBeacon\s*\(',r'\bimportScripts\s*\(',r'\bhttps?://']:
        assert not re.search(pattern,source),(file,pattern)
for html in (ROOT/'public/crisp-original').rglob('index.html'):
    source=html.read_text()
    for url in re.findall(r'(?:src|href)="([^"]+)"',source):
        assert not re.match(r'(?:\w+:|//)',url),(html,url)
        assert (html.parent/url).is_file(),(html,url)
    assert "connect-src 'none'" in source and "script-src 'self'" in source
assert 'new Function' not in (ROOT/'public/crisp-original/audio.js').read_text()
assert 'new AudioContext()' not in (ROOT/'public/crisp-original/audio.js').read_text()
report={'status':'PASS_STATIC_ONLY','verifiedOriginalFiles':count,'byteIdenticalCompleteGameFiles':3,'finiteLevelsAdded':0,'runtimeJavaScriptFiles':len(runtime),'networkAndDynamicEvaluationPatterns':'none in shipped JS','iframeScriptReferences':'all local and present','browserValidation':'PENDING parent GitHub desktop/mobile CI','screenshots':'PENDING real browser evidence'}
(ROOT/'docs/crisp-static-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
