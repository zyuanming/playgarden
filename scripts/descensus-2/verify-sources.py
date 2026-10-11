# SPDX-License-Identifier: GPL-3.0-only
# Static publication/source checks. No game or upstream package script is executed.
from pathlib import Path
from html.parser import HTMLParser
import base64,hashlib,json,re,subprocess,zipfile
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'public/descensus-2';VENDOR=ROOT/'vendor/descensus2-original'
allow=json.loads((VENDOR/'upstream-allowlist.json').read_text())['files'];allow=[r for r in allow if r['path']!='PREFLIGHT-NOTES.txt']
assert {p.relative_to(VENDOR/'upstream').as_posix() for p in (VENDOR/'upstream').rglob('*') if p.is_file()}=={r['path'] for r in allow}
for r in allow:
 data=(VENDOR/'upstream'/r['path']).read_bytes();assert len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256'],r['path'];assert hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()==r['git_blob_sha1'],r['path']
# All ten original terrain factories and their exact thresholds, dimensions and forces.
for p in (VENDOR/'upstream/src/js/Terrain').rglob('*.ts'):
 relative=p.relative_to(VENDOR/'upstream/src/js');expected=p.read_text(encoding='utf-8-sig');expected=re.sub(r'import (I\w+|ShapeOptions) from ',r'import type \1 from ',expected)
 if relative.as_posix()=='Terrain/Objects/Snake.ts':expected="import gameClock from '../../Utility/gameClock';\n"+expected.replace('performance.now()','gameClock.now()')
 assert (VENDOR/'adapted'/relative).read_text()==expected,relative
for name in ['p2/createWorld.ts','p2/materials.ts','p2/p2Util.ts','ground.ts','Utility/randomUtil.ts']:
 expected=(VENDOR/'upstream/src/js'/name).read_text(encoding='utf-8-sig');expected=re.sub(r'import (I\w+|ShapeOptions) from ',r'import type \1 from ',expected);assert (VENDOR/'adapted'/name).read_text()==expected,name
assert (PUBLIC/'lib/p2.min.js').read_bytes()==(VENDOR/'upstream/src/js/lib/p2/p2.min.js').read_bytes()
assert (PUBLIC/'lib/MersenneTwister.js').read_bytes()==(VENDOR/'upstream/replacements/MersenneTwister.js').read_bytes()
patch=json.loads((VENDOR/'pixi-csp-patch.json').read_text());original=(VENDOR/'upstream/src/js/lib/pixi/pixi.min.js').read_text();assert hashlib.sha256(original.encode()).hexdigest()==patch['originalSha256'];assert original.count(patch['original'])==1;assert (PUBLIC/'lib/pixi.min.js').read_text()==original.replace(patch['original'],patch['replacement'])
assert not re.search(r'\b(?:eval\s*\(|new\s+Function\s*\()', '\n'.join(p.read_text() for p in PUBLIC.rglob('*.js')))
images=list((VENDOR/'upstream/src/img').iterdir());assert len(images)==16
for image in images:assert (PUBLIC/'img'/image.name).read_bytes()==image.read_bytes(),image.name
assert len(list((PUBLIC/'img').iterdir()))==19
embedded=json.loads((PUBLIC/'assets.js').read_text().split('window.DESCENSUS_IMAGES=',1)[1].removesuffix(';\n'))
for name,url in embedded.items():assert base64.b64decode(url.split(',',1)[1])==(PUBLIC/'img'/name).read_bytes()
assert len(embedded)==19
loop=(VENDOR/'adapted/Game/gameLoop.ts').read_text();assert 'const startingHeight = 1000;' in loop and 'const startingLives = 5;' in loop and 'timeSinceLastCheckpoint / (30000)' in loop and 'timeSinceInvincible > (3000)' in loop
for text in ['state !== GameState.Active','bar.reset()','gameClock.advance(deltaTime)','cancelAnimationFrame(raf)','GameState.Won'] :assert text in loop,text
host=(ROOT/'src/games/Descensus2.tsx').read_text();assert 'sandbox="allow-scripts"' in host and "event.origin!=='null'" in host and "event.source!==target" in host and "d.session!==session" in host;assert 'onComplete(' not in host
class LocalHTML(HTMLParser):
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs);assert all(not key.lower().startswith('on') for key in attrs)
  if tag in ['script','link']:
   path=attrs.get('src') or attrs.get('href');assert path and not re.match(r'^(?:[a-z]+:|//)',path);assert (PUBLIC/path).is_file()
LocalHTML().feed((PUBLIC/'index.html').read_text());html=(PUBLIC/'index.html').read_text();assert "connect-src 'none'" in html and 'unsafe-eval' not in html and "font-src 'none'" in html
notice=(PUBLIC/'NOTICE.txt').read_text()
for p in (PUBLIC/'licenses').iterdir():assert p.read_text() in notice,p.name
assert len(list((PUBLIC/'licenses').iterdir()))==27
subprocess.run(['node',str(Path(__file__).with_name('build-runtime.mjs')),'--check'],check=True)
manifest=json.loads((VENDOR/'corresponding-source-manifest.json').read_text());expected={r['path'] for r in manifest['files']}|{'vendor/descensus2-original/corresponding-source-manifest.json'}
with zipfile.ZipFile(PUBLIC/'source.zip') as archive:
 assert set(archive.namelist())==expected and archive.testzip() is None
 for path in expected:
  assert not any(x in Path(path).parts for x in ['audit-only','checks','.git','__pycache__']);assert archive.read(path)==(ROOT/path).read_bytes(),path
for r in manifest['files']:
 data=(ROOT/r['path']).read_bytes();assert len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256'],r['path']
actual={p.relative_to(ROOT).as_posix() for p in PUBLIC.rglob('*') if p.is_file()};assert actual=={x for x in expected if x.startswith('public/descensus-2/')}|{'public/descensus-2/source.zip'}
spec=(ROOT/'e2e/descensus-2.spec.ts').read_text();assert spec.count('\ntest(')==1;assert 'INPUT_JOURNEY_PENDING' not in spec and 'Incomplete authoring:' not in spec
print('Descensus2 static source and license verification passed; 1000m finite campaign, zero numbered levels. Runtime acceptance is separate.')
