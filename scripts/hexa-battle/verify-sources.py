# SPDX-License-Identifier: GPL-3.0-only
"""Static source/provenance audit. No game execution or puzzle sweeps."""
from pathlib import Path
import hashlib,json,re,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2];vendor=root/'vendor/hexa-battle-original'
manifest=json.loads((vendor/'source-manifest.json').read_text())
for row in manifest['files']:
 data=(vendor/'upstream'/row['path']).read_bytes()
 assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['git_blob_sha1'],row['path']
 assert hashlib.sha256(data).hexdigest()==row['sha256']
runtime=root/'src/vendor/hexaBattle'
unit_files=[p for p in (runtime/'engine/units').glob('*.ts') if p.stem not in ['index','races','traits']]
action_files=[p for p in (runtime/'engine/actions').glob('*.ts') if p.stem not in ['index','action']]
assert len(unit_files)==16 and len(action_files)==13
for p in runtime.rglob('*.ts'):
 text=p.read_text();assert not re.search(r'\beval\s*\(|new\s+Function|fetch\(|XMLHttpRequest|WebSocket|localStorage',text),p
 assert not re.search(r"from ['\"](?:lodash|store|aphrodite|animejs|color)",text),p
assert (root/'public/hexa-battle-LICENSE.txt').read_bytes()==(vendor/'upstream/LICENSE').read_bytes()
assert not (vendor/'upstream/src/ui/assets').exists()
ET.parse(root/'public/hexa-battle-art.svg')
report={'commit':manifest['commit'],'original_source_files_verified':len(manifest['files']),'unit_types':16,'concrete_action_families':13,'finite_levels':0,'progression':'original procedural depth/recruitment/survivors','external_runtime_assets':False,'original_icon_assets_shipped':False,'executed_upstream_code':False}
print(json.dumps(report))
