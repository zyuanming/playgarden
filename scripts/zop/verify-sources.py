from pathlib import Path
import json, hashlib
root=Path(__file__).resolve().parents[2]
manifest=json.loads((root/'vendor/zop-original/source-manifest.json').read_text())
assert manifest['commit']=='fafaa4751df64634aee48d942062617c21acfb26'
for entry in manifest['files']:
    data=(root/'vendor/zop-original/upstream'/entry['path']).read_bytes()
    assert len(data)==entry['bytes'],entry['path']
    assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==entry['gitBlob'],entry['path']
original=(root/'vendor/zop-original/upstream/src/components/game/index.js').read_text()
adapted=(root/'src/vendor/zopOriginal.ts').read_text()
initial=original[original.index('    ctx = c'):original.index('    window.gameRestart = function')]
restart=original[original.index('    window.gameRestart = function'):original.index('    window.gameRestart()')].replace('window.gameRestart = function','gameRestart = function')
render=original[original.index('    render = function()'):original.index('    isBelow = function')].replace('Date.now()','frameTime').replace("'px Roboto'","'px sans-serif'").replace('      window.requestAnimFrame(render)','')
geometry=original[original.index('    isBelow = function'):original.index("    a.addEventListener('mousedown'")]
release=original[original.index('    function touchend(e)'):original.index("    a.addEventListener('mousemove'")].replace('      e.preventDefault()','      if (e && e.preventDefault) e.preventDefault()')
move=original[original.index('    function onmove (e)'):original.index('\n    render()')]
begin=move.index('      if (e.preventDefault)');end=move.index('      if (isSelecting && time != 0)')
move=move[:begin]+'      mouseX = e.x\n      mouseY = e.y\n\n'+move[end:]
for label,body in [('initialization',initial),('restart',restart),('render/gravity',render),('geometry',geometry),('clear/refill',release),('selection/loop',move)]:
    assert body in adapted,'Original gameplay body changed: '+label
license=(root/'vendor/zop-original/upstream/LICENSE').read_bytes()
assert (root/'vendor/zop-original/LICENSE').read_bytes()==license
assert license in (root/'public/zop-LICENSE.txt').read_bytes()
for forbidden in ['require(', 'window.', 'setInterval(', 'setTimeout(', 'eval(', 'fetch(', 'XMLHttpRequest', 'location.']:
    assert forbidden not in adapted,'Unexpected external/lifecycle dependency: '+forbidden
print('Zop: 4 pinned source/license files, 6 retained original core sections, license and boundary verified')
