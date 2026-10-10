# Source/data correspondence only; no gameplay or solver suite.
from pathlib import Path
import hashlib,json,re
p=Path(__file__).resolve().parents[2]
v=p/'vendor/viking-original'
m=json.loads((v/'source-records.json').read_text())
for e in m['files']:
 d=(v/'upstream'/(e['path']+'.txt')).read_bytes()
 assert len(d)==e['bytes']
 assert hashlib.sha256(d).hexdigest()==e['sha256'],e['path']
 assert hashlib.sha1(b'blob '+str(len(d)).encode()+b'\0'+d).hexdigest()==e['sha'],e['path']
s=(p/'src/vendor/vikingLevelData.ts').read_text()
arrays=re.findall(r'(Background|Walls|Broken|Good|Bed|Decor):\s*\[([^]]*)\]',s)
assert len(arrays)==42
for i in range(7):
 original=json.loads((v/'upstream'/f'scripts/levels/level{i+1}.json.txt').read_text())
 assert original['width']==20 and original['height']==15
 layers={e['name']:e['data'] for e in original['layers']}
 for name,values in arrays[i*6:(i+1)*6]:
  assert [int(n) for n in re.findall(r'\d+',values)]==layers[name],(i,name)
assert (p/'public/viking-LICENSE.txt').read_bytes()==(v/'upstream/LICENSE.txt').read_bytes()
print(json.dumps({'sourceFiles':len(m['files']),'originalLevels':7,'exactLayers':42,'shape':[20,15],'originalAudioImagesFontsPhaser':0,'runtimeValidation':'requires targeted browser journey'}))
