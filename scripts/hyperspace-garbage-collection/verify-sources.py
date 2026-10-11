# SPDX-License-Identifier: GPL-3.0-only
"""Static provenance, closure, transform, archive and syntax checks, not tests."""
from pathlib import Path
import hashlib,json,re,subprocess,sys,zipfile
ROOT=Path(__file__).resolve().parents[2]
PUBLIC=ROOT/'public/hyperspace-garbage-collection'
VENDOR=ROOT/'vendor/hyperspace-garbage-collection-original'
CLEARED=VENDOR/'cleared'
commit='f5b93cbb57f653be4455f9dd5c130463b11abe2a'
allow=json.loads((VENDOR/'input-publication-manifest.json').read_text())
assert allow['commit']==commit and allow['count']==64
assert {p.relative_to(CLEARED).as_posix() for p in CLEARED.rglob('*') if p.is_file()}=={f['path'] for f in allow['files']}
for f in allow['files']:
    data=(CLEARED/f['path']).read_bytes()
    assert len(data)==f['bytes'] and hashlib.sha256(data).hexdigest()==f['sha256'], f['path']
for number,count in [(1,26),(2,21),(3,20),(4,35)]:
    path=f'json/level-0{number}.json'
    assert (PUBLIC/path).read_bytes()==(CLEARED/path).read_bytes()
    assert sum(len(x['data']) for x in json.loads((PUBLIC/path).read_text()))==count
    module=(PUBLIC/f'js/maps/level-0{number}.js').read_text()
    payload=module.split('define(function() { return ',1)[1].rsplit('; });',1)[0]
    assert json.loads(payload)==(PUBLIC/path).read_text()
    level=(PUBLIC/f'js/levels/level-0{number}.js').read_text()
    assert f'game.stageCleared( {number-1}, ' in level
levels='\n'.join((PUBLIC/f'js/levels/level-0{n}.js').read_text() for n in range(1,5))
for entity,count in [('Laser',12),('Emitter',7),('TractorBeam',3),('Trigger',6),('Door',4)]:
    assert len(re.findall(r'new '+entity+r'\(',levels))==count
assert (PUBLIC/'js/levels/level-end.js').read_bytes()==(CLEARED/'js/levels/level-end.js').read_bytes()
assert (PUBLIC/'js/Box2dWeb/Box2dWeb-2.1.a.3.js').read_bytes()==(CLEARED/'js/Box2dWeb/Box2dWeb-2.1.a.3.js').read_bytes()
html=(PUBLIC/'index.html').read_text();host=(ROOT/'src/games/HyperspaceGarbageCollection.tsx').read_text();adapter=(PUBLIC/'adapter.js').read_text()
assert 'sandbox="allow-scripts"' in host and 'allow-same-origin' not in host
assert "event.origin !== 'null'" in host and 'event.source !== target' in host
assert 'event.source !== parent' in adapter and 'event.origin !== parentOrigin' in adapter
assert "connect-src 'none'" in html and 'unsafe-eval' not in html and 'unsafe-inline' not in html
assert 'new URL(\'./hyperspace-garbage-collection/index.html\', document.baseURI)' in host
assert '__hgcRead' in adapter and 'originalNext(game); phase = \'ending\'' in adapter
assert "phase === 'playing' && blurPaused" in adapter
assert 'window.setTimeout =' not in adapter and 'window.setInterval =' not in adapter
assert 'localStorage' not in adapter
assert 'playgarden.hyperspace-garbage-collection.v1.state' in host
for p in PUBLIC.rglob('*'):
    assert not any(x in p.parts for x in ['audit-input','audit-only','node_modules']),p
    assert p.suffix.lower() not in ['.mp3','.ogg','.woff','.woff2','.png','.jpg','.jpeg'],p
for p in PUBLIC.rglob('*.js'):
    text=p.read_text()
    assert not re.search(r'\beval\s*\(',text),p
    assert 'deviceorientation' not in text and 'localStorage' not in text,p
    if p.name not in ['require.js','playgarden-clock.js']:
        assert not re.search(r'(?<!Clock\.)\b(?:setTimeout|setInterval)\s*\(',text),p
    if p.name not in ['adapter.js','require.js']:
        assert not re.search(r'(?:window\.)?requestAnimationFrame\s*\(',text),p
    subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
# Only local scripts/styles are loaded; links to upstream in notices are attribution.
for ref in re.findall(r'(?:src|href)="([^"]+)"',html):
    assert not ref.startswith(('http:','https:','//','/')),ref
    assert (PUBLIC/ref).is_file(),ref
for manifest_path in [PUBLIC/'runtime-manifest.json',VENDOR/'corresponding-source-manifest.json']:
    for f in json.loads(manifest_path.read_text())['files']:
        data=(ROOT/f['path']).read_bytes();assert len(data)==f['bytes'] and hashlib.sha256(data).hexdigest()==f['sha256'],f['path']
source=json.loads((VENDOR/'corresponding-source-manifest.json').read_text())
with zipfile.ZipFile(PUBLIC/'source.zip') as z:
    expected={f['path'] for f in source['files']}|{'vendor/hyperspace-garbage-collection-original/corresponding-source-manifest.json'}
    assert set(z.namelist())==expected
    for name in z.namelist():assert z.read(name)==(ROOT/name).read_bytes(),name
subprocess.run([sys.executable,str(Path(__file__).with_name('adapt.py')),'--check'],check=True)
spec=ROOT/'e2e/hyperspace-garbage-collection.spec.ts'
assert len(list((ROOT/'e2e').glob('hyperspace-garbage-collection*.spec.ts')))==1
subprocess.run(['node','--experimental-transform-types','--check',str(spec)],check=True,capture_output=True)
print('HGC static checks passed: exact 64-file cleared input, four unchanged maps, original engine/ending, local opaque-frame runtime, manifests/archive bytes and JS/TypeScript-spec syntax. Browser/typechecked build/E2E and actual screenshots remain unverified.')
