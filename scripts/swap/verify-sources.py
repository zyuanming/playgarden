# SPDX-License-Identifier: GPL-3.0-only
"""Static byte/data/provenance checks, never an engine or campaign solver run."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'vendor/swap-original'
manifest=json.loads((BASE/'source-manifest.json').read_text())
for f in manifest['files']:
    if not f['approved']: continue
    data=(BASE/f['path']).read_bytes()
    assert len(data)==f['bytes'], f['path']
    assert hashlib.sha256(data).hexdigest()==f['sha256'],f['path']
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==f['gitSha1'],f['path']
original=(BASE/'upstream/js/levels.js').read_text()
adapted=(ROOT/'src/vendor/swapMaps.ts').read_text()
assert adapted.endswith(original.replace('var levels = [','export const swapMaps = [',1)+';\n')
data=re.sub(r'/\*.*?\*/|//[^\n]*','',original,flags=re.S)
data=data[data.index('['):]
data=re.sub(r'(\b\w+)\s*:',r'"\1":',data)
data=re.sub(r',\s*([}\]])',r'\1',data)
levels=json.loads(data)
assert len(levels)==25
assert all(any(2 in row for row in level['tiles']) for level in levels[:24])
assert not any(2 in row for row in levels[24]['tiles'])
assert all(len(p['tiles'])==p['sizeY'] and all(len(row)==p['sizeX'] for row in p['tiles']) for p in levels)
assert (ROOT/'public/swap-LICENSE.txt').read_bytes()==(BASE/'upstream/LICENSE').read_bytes()
for file in ['src/vendor/swapRuntime.ts','src/vendor/swapMaps.ts','src/vendor/swapState.ts']:
    text=(ROOT/file).read_text()
    assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|eval)\s*\(',text),file
print('Swap fixed-source bytes verified; all 24 playable maps and exact credits preserved. No upstream execution.')
