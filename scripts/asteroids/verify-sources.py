"""Static provenance and distribution-boundary verification; no gameplay execution."""
from pathlib import Path
import hashlib,json,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
source=root/'vendor/asteroids-original'
m=json.loads((source/'extraction-map.json').read_text())
assert m['commit']=='930301cbda83ed3b120f64b801d937d077ee2da0'
def check(data,record):
    assert len(data)==record['bytes']
    assert hashlib.sha256(data).hexdigest()==record['sha256']
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==record['gitBlobSha1']
data=(source/m['excerpt']['path']).read_bytes();check(data,m['excerpt']);lines=data.splitlines(keepends=True)
for span in m['retainedRanges']:
    check(b''.join(lines[span['excerptStart']-1:span['excerptEnd']]),span)
for record in m['references']:
    check((source/record['savedPath']).read_bytes(),record)
assert (root/'public/asteroids-LICENSE.txt').read_bytes()==(source/'reference/LICENSE.txt').read_bytes()
assert [(x['start'],x['end']) for x in m['removedRanges']]==[(770,839),(1113,1125)]
assert 'renderGlyph' not in data.decode() and 'window.requestAnimFrame =' not in data.decode()
runtime=[root/'src/vendor/asteroidsCore.ts',root/'src/games/AsteroidsGame.tsx',root/'src/games/asteroids.css']
for path in runtime:
    text=path.read_text()
    for forbidden in ['new Audio(', 'fetch(', 'XMLHttpRequest', 'eval(', '39459__', '51467__', 'vector_battle', 'jquery-1.4.1']:
        assert forbidden not in text,(path,forbidden)
ET.parse(root/'public/asteroids-art.svg')
assert all(p.suffix in ['.txt','.json'] for p in source.rglob('*') if p.is_file())
print(json.dumps({'firstPartyExcerptBytes':len(data),'referenceFiles':len(m['references']),'borrowedBlocksRemoved':len(m['removedRanges']),'finiteLevels':0,'fontAudioLegacyRuntimeFiles':0,'runtimeBehavior':'requires targeted browser validation'}))
