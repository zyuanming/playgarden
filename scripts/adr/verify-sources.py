# SPDX-License-Identifier: GPL-3.0-only
"""Source/license/data checks only. Does not execute any game or solve a campaign."""
import hashlib,json,re
from pathlib import Path
root=Path.cwd();vendor=root/'vendor/adr-original';runtime=root/'public/adr-original'
manifest=json.loads((vendor/'source-manifest.json').read_text())
for row in manifest['files']:
 data=(vendor/'upstream'/row['path']).read_bytes()
 assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['git_blob_sha1'],row['path']
 assert hashlib.sha256(data).hexdigest()==row['sha256']
for row in json.loads((vendor/'jquery-3.7.1/source-manifest.json').read_text()):
 data=(vendor/'jquery-3.7.1'/Path(row['path']).name).read_bytes()
 assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['sha']
assert (runtime/'lib/jquery.js').read_bytes()==(vendor/'jquery-3.7.1/jquery.min.js').read_bytes()
for row in json.loads((vendor/'jquery-color-2.1.2/source-manifest.json').read_text())['files']:
 data=(vendor/'jquery-color-2.1.2'/row['path']).read_bytes()
 assert len(data)==row['size']
 assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['sha']
assert (runtime/'lib/jquery.color.js').read_bytes()==(vendor/'jquery-color-2.1.2/jquery.color.js').read_bytes()
assert (vendor/'licenses/jquery-color-2.1.2-MIT.txt').read_bytes()==(vendor/'jquery-color-2.1.2/MIT-LICENSE.txt').read_bytes()
modified={'engine.js','space.js','state_manager.js'};unchanged=[]
for p in (runtime/'script').rglob('*.js'):
 rel=p.relative_to(runtime)
 if p.name not in modified:
  assert p.read_bytes()==(vendor/'upstream'/rel).read_bytes(),str(rel);unchanged.append(str(rel))
 else:
  assert 'SPDX-License-Identifier: MPL-2.0' in p.read_text()
 text=p.read_text()
 assert not re.search(r'\beval\s*\(|new\s+Function\s*\(|\blocalStorage\b|window\.open\s*\(',text),str(rel)
assert len(list((runtime/'script').rglob('*.js')))==19
assert len(unchanged)==16
assert len(json.loads((vendor/'zh-cn-original-dictionary.json').read_text()))==786
for p in (runtime/'css').glob('*.css'):assert not re.search(r'url\(\s*[\'"]?https?://',p.read_text())
html=(runtime/'index.html').read_text();assert "connect-src 'none'" in html and "script-src 'self'" in html and 'unsafe-eval' not in html
for url in re.findall(r'(?:src|href)="([^"]+)"',html):assert not url.startswith(('http:','https:','//')) and (runtime/url).is_file(),url
for required in ['script/room.js','script/outside.js','script/path.js','script/world.js','script/ship.js','script/space.js','script/events/encounters.js','script/events/setpieces.js','script/prestige.js','script/scoring.js']:
 assert (runtime/required).is_file()
assert 'RADIUS: 30' in (runtime/'script/world.js').read_text()
assert 'FTB_SPEED: 60000' in (runtime/'script/space.js').read_text()
assert 'ADRBridge.recordEnding(Score.calculateScore(), Prestige.get().score)' in (runtime/'script/space.js').read_text()
assert (vendor/'upstream/LICENSE.md').read_text() in (runtime/'LICENSES.txt').read_text()
assert (vendor/'jquery-3.7.1/LICENSE.txt').read_text() in (runtime/'LICENSES.txt').read_text()
report={'original_commit':manifest['commit'],'verified_original_files':len(manifest['files']),'runtime_gameplay_modules':19,'byte_identical_gameplay_modules':unchanged,'modified_modules':sorted(modified),'world_dimensions':[61,61],'original_ending_ascent_ms':60000,'original_translation_entries':786,'finite_levels':0,'campaign':True,'pure_endless':False,'jquery':'3.7.1','network':'local resources only; CSP denies connections and inline/eval scripts','game_execution':'not part of these static checks'}
(root/'docs/adr-static-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
