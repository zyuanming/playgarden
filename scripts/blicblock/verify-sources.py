# SPDX-License-Identifier: GPL-3.0-only
"""Static provenance/body audit only. Does not execute upstream or game rules."""
from pathlib import Path
import hashlib,json,re
root=Path(__file__).resolve().parents[2]
vendor=root/'vendor/blicblock-original'
manifest=json.loads((vendor/'manifest.json').read_text())
assert manifest['commit']=='05bafeedb8684e478cda9061e98406acff8d9a83'
for record in manifest['files']:
 data=(vendor/'upstream'/record['path']).read_bytes()
 assert hashlib.sha256(data).hexdigest()==record['sha256'],record['path']
 assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==record['git_blob_sha1'],record['path']
compiled=(vendor/'upstream/public/scripts/scripts.433fc63d.js').read_text()
adapted=(root/'src/vendor/blicblockOriginal.ts').read_text()
needles=['function(){var a;a=function(){function a(a){this.color','function(){"use strict";angular.module("blicblockApp").service("Tetromino"','function(){"use strict";angular.module("blicblockApp").controller("MainCtrl"']
for needle in needles:
 start=compiled.index(needle);end=compiled.index('}.call(this)',start)
 body=compiled[start:end]
 assert body in adapted,'Original compiled gameplay body changed: '+needle
assert (root/'public/blicblock-LICENSE.txt').read_bytes()==(vendor/'upstream/LICENSE.txt').read_bytes()
assert "@colors = ['magenta', 'orange', 'yellow', 'green', 'blue', 'white']" in (vendor/'upstream/client/app/scripts/services/tetromino.coffee').read_text()
for p in [root/'src/vendor/blicblockRuntime.ts',root/'src/vendor/blicblockOriginal.ts',root/'src/games/BlicblockGame.tsx',root/'src/games/blicblock.css']:
 text=p.read_text()
 assert not re.search(r'\beval\s*\(|new\s+Function|\bfetch\s*\(|XMLHttpRequest|WebSocket|url\s*\(',text),p
assert not any(p.suffix.lower() in ['.png','.jpg','.svg','.woff','.woff2','.ttf','.eot','.mp3','.ogg'] for p in vendor.rglob('*'))
print(json.dumps({'game':'blicblock','commit':manifest['commit'],'verified_upstream_files':len(manifest['files']),'verbatim_gameplay_bodies':3,'colors':6,'tetromino_families':7,'finite_levels':0,'network_runtime':False,'third_party_assets':False}))
