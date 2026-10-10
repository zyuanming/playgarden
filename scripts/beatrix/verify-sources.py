#!/usr/bin/env python3
"""Static source/data/asset audit. Does not execute upstream or gameplay code."""
import hashlib,json,pathlib,re,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parents[2]
vendor=root/'vendor/beatrix-original'
record=json.loads((vendor/'source-records.json').read_text())
for entry in record['files']:
    data=(vendor/'upstream'/(entry['path']+'.txt')).read_bytes()
    assert len(data)==entry['size'],entry['path']
    assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']
    assert hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()==entry['sha'],entry['path']
assert (root/'public/beatrix-LICENSE.txt').read_bytes()==(vendor/'upstream/LICENSE.txt').read_bytes()
text=(root/'src/vendor/beatrixLevelData.ts').read_text()
adapted=json.loads(text[text.index('['):text.rindex(']')+1])
original={}
for name in ['1','2','3']:
    text=(vendor/f'upstream/scripts/levels/{name}.js.txt').read_text()
    for identifier,body in re.findall(r'var (level\w+) = \{(.*?)\n\};',text,re.S):
        original[identifier]=body
assert len(adapted)==len(original)==12
for level in adapted:
    body=original[level['id']]
    for key,source in [('cells','cells'),('targetRows','solution')]:
        array=re.search(source+r'\s*:\s*(\[.*?\])',body,re.S)
        assert array and level[key]==json.loads(array.group(1)),(level['id'],key)
    bpm=re.search(r'BPM\s*:\s*(\d+)',body)
    assert level['bpm']==(int(bpm.group(1)) if bpm else 120)
    symbols={}
    for key,instrument,extra in re.findall(r'(\w)\s*:\s*\{drum:\s*DrumDefs\.(\w+)(.*?)\}',body):
        item={'instrument':instrument}
        bounce=re.search(r'bounce:\s*"(\w+)"',extra)
        if bounce:item['direction']=bounce.group(1)
        beat=re.search(r'beat:\s*(\[.*?\])',extra)
        if beat:item['emitterDirections']=json.loads(beat.group(1))
        period=re.search(r'period:\s*(\d+)',extra)
        if period:item['period']=int(period.group(1))
        symbols[key]=item
    assert level['symbols']==symbols,level['id']
    assert len(level['cells'])==32 and all(len(r)==32 for r in level['cells'])
assert all(p.suffix in ['.txt','.json'] for p in vendor.rglob('*') if p.is_file())
for name in ['src/vendor/beatrixCore.ts','src/vendor/beatrixAudio.ts','src/games/BeatrixGame.tsx']:
    text=(root/name).read_text()
    assert not re.search(r'\b(?:fetch|eval|XMLHttpRequest|WebSocket)\s*\(',text),name
assert not list((root/'public').glob('beatrix*/*.mp3'))
ET.parse(root/'public/beatrix-art.svg')
print(json.dumps({'sourceFiles':len(record['files']),'exactOriginalPuzzles':len(adapted),'grid':[32,32],'upstreamAudioImagesPhaserFiles':0,'runtimeValidation':'requires targeted browser journey'}))
