#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Static source, grants, data and correspondence checks; no game execution."""
from pathlib import Path
import argparse,hashlib,json,re,tarfile
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'third_party/black-hole-square'
DEST=ROOT/'public/games/black-hole-square'
COMMIT='8d48aae2097613782ab18d5062e8a3906741baaa'
def sha(data):return hashlib.sha256(data).hexdigest()
def load(path):return json.loads(path.read_text())
def check_record(item):
    data=(ROOT/item['path']).read_bytes();assert len(data)==item['bytes'] and sha(data)==item['sha256'],item['path']
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--runtime',action='store_true');ap.add_argument('--archive',action='store_true');args=ap.parse_args()
    manifest=load(SOURCE/'SOURCE-MANIFEST.json');assert manifest['commit']==COMMIT and manifest['root_tree']=='18df1cca987fdcdc0861ac25b3d194eaf8839c6f'
    entries=manifest['files'];assert len(entries)==79
    assert sorted(p.relative_to(SOURCE/'original').as_posix() for p in (SOURCE/'original').rglob('*') if p.is_file())==sorted(i['path'] for i in entries)
    for item in entries:
        blob=(SOURCE/'original'/item['path']).read_bytes();assert len(blob)==item['bytes'] and sha(blob)==item['sha256'],item['path']
        assert hashlib.sha1(b'blob '+str(len(blob)).encode()+b'\0'+blob).hexdigest()==item['git_blob_sha1'],item['path']
        assert '/'+COMMIT+'/' in item['source_url']
    assert (SOURCE/'LICENSE-MIT.txt').read_bytes()==(SOURCE/'original/LICENSE').read_bytes()
    assert 'Copyright (c) 2021 Quinten Clause' in (SOURCE/'LICENSE-MIT.txt').read_text()
    assert 'GNU GENERAL PUBLIC LICENSE' in (SOURCE/'PLAYGARDEN-COPYING.txt').read_text()
    for item in load(SOURCE/'LICENSE-MANIFEST.json'):
        blob=(SOURCE/'font-provenance'/Path(item['path']).name).read_bytes()
        assert sha(blob)==item['sha256'] and hashlib.sha1(b'blob '+str(len(blob)).encode()+b'\0'+blob).hexdigest()==item['git_blob_sha1']
    assert not list(SOURCE.rglob('*.ttf')) and not list(SOURCE.rglob('*.woff*'))
    entities=load(SOURCE/'original/src/entities.json');adapted=load(SOURCE/'adapted-src/entities.json');assert entities==adapted
    assert (SOURCE/'original/src/entities.json').read_bytes()==(SOURCE/'adapted-src/entities.json').read_bytes()
    sequence=entities['game']['levels']['sequence'];assert sequence==entities['game']['levels']['wm'] and len(sequence)==21
    assert sequence[:2]==['titlescreen','startscreen'] and sequence[-1]=='end'
    levels=[entities[name]['puzzle'] for name in sequence[2:-1]];assert len(levels)==18
    assert all(len(l['grid'])==36 and all(isinstance(t,int) and 0<=t<=8 for t in l['grid']) for l in levels)
    assert len({tuple(l['grid']) for l in levels})==18
    assert [l['taps'] for l in levels]==[4,5,6,5,6,6,15,5,10,5,9,11,9,6,8,12,14,20]
    inventory=load(SOURCE/'LEVELS.json');assert inventory['count']==18 and inventory['sequence']==sequence
    for item,name,puzzle in zip(inventory['levels'],sequence[2:-1],levels):
        assert item['id']==name and item['max_moves']==puzzle['taps'] and item['grid']==puzzle['grid']
    mapped=load(SOURCE/'ADAPTED-MANIFEST.json');assert mapped['upstreamCommit']==COMMIT
    assert sorted(i['path'] for i in mapped['adapted'])==sorted(p.relative_to(ROOT).as_posix() for p in (SOURCE/'adapted-src').rglob('*') if p.is_file())
    for item in mapped['adapted']:
        check_record(item);original=(ROOT/item['original']).read_bytes()
        assert sha(original)==item['originalSha256']
        assert item['changed']==((ROOT/item['path']).read_bytes()!=original)
    for item in mapped['new']:check_record(item)
    # Original main/overlay move, clear and failure bodies compare verbatim after
    # removing the two explicitly documented observation/storage-cap seams.
    original=(SOURCE/'original/src/systems/updates/puzzle.js').read_text();actual=(SOURCE/'adapted-src/systems/updates/puzzle.js').read_text()
    start='        let moves = {';end='    } else if (!entities.game.pointer.isDown) {'
    left=original.split(start,1)[1].split(end,1)[0];right=actual.split(start,1)[1].split(end,1)[0]
    right=right.replace("\n                    onClear(puzzleId);",'').replace(' === -1 && solutions[puzzleId].length < 64)',' === -1)')
    assert left==right,'Original move/clear/stuck operation body changed unexpectedly'
    for relative in ['systems/updates/home.js']+[str(p.relative_to(SOURCE/'original/src')) for p in (SOURCE/'original/src/systems/draws').glob('*.js')]+[str(p.relative_to(SOURCE/'original/src')) for p in (SOURCE/'original/src/systems/transforms').glob('*.js')]:
        assert (SOURCE/'original/src'/relative).read_bytes()==(SOURCE/'adapted-src'/relative).read_bytes(),relative
    runtime_sources=list((SOURCE/'adapted-src').rglob('*.js'))+list((SOURCE/'bridge-src').glob('*.js'))+list((SOURCE/'bridge-src').glob('*.ts'))
    for path in runtime_sources:
        text=path.read_text();assert 'require.context' not in text,path
        assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|eval)\s*\(',text),path
        assert not re.search(r'\b(?:localStorage|sessionStorage|serviceWorker)\b',text),path
        for target in re.findall(r'\bfrom\s+[\'\"]([^\'\"]+)[\'\"]',text):
            assert target.startswith('.') and (path.parent/target).is_file(),(path,target)
        assert not re.search(r'\b(?:parent|top)\s*\.\s*(?:document|localStorage)',text),path
    frame=(DEST/'index.html').read_text();assert "connect-src 'none'" in frame and "worker-src 'none'" in frame and 'js/runtime.js' in frame and 'type="module"' not in frame
    host=(ROOT/'src/games/BlackHoleSquareGame.tsx').read_text();assert 'sandbox="allow-scripts"' in host and 'allow-same-origin' not in host
    plans=load(ROOT/'e2e/fixtures/black-hole-square-input-plans.json');assert plans['upstreamCommit']==COMMIT and plans['status']=='STATIC_DATA_ANALYSIS_ONLY_NOT_RUNTIME_PASS'
    assert len(plans['levels'])==18
    for item,name,puzzle in zip(plans['levels'],sequence[2:-1],levels):
        assert item['id']==name and item['initial']==puzzle['grid'] and item['budget']==puzzle['taps']
        assert len(item['cells'])<=puzzle['taps'] and len(item['checkpoints'])==len(item['cells'])
        assert all(isinstance(i,int) and 0<=i<36 for i in item['cells'])
        assert all(t<2 for t in item['checkpoints'][-1])
    if args.archive or args.runtime:
        for source,name in [(SOURCE/'LICENSE-MIT.txt','LICENSE-MIT.txt'),(SOURCE/'PLAYGARDEN-COPYING.txt','PLAYGARDEN-COPYING.txt'),
            (SOURCE/'font-provenance/Gugi-author-OFL.txt','Gugi-OFL.txt'),(SOURCE/'original/scratch/title.svg','title.svg'),
            (SOURCE/'ADAPTATION.md','ADAPTATION.md'),(SOURCE/'original/README.md','ORIGINAL-README.md')]:
            assert (DEST/name).read_bytes()==source.read_bytes(),name
    if args.archive:
        with tarfile.open(DEST/'source.tar.gz','r:gz') as archive:
            archive_manifest=json.load(archive.extractfile('ARCHIVE-MANIFEST.json'))
            assert {m.name for m in archive.getmembers()}=={i['path'] for i in archive_manifest}|{'ARCHIVE-MANIFEST.json'}
            for item in archive_manifest:
                data=archive.extractfile(item['path']).read();assert sha(data)==item['sha256'] and len(data)==item['bytes']
                assert data==(ROOT/item['path']).read_bytes(),item['path']
            assert 'third_party/black-hole-square/original/scratch/title.afdesign' in archive.getnames()
    if args.runtime:
        runtime=DEST/'js/runtime.js';assert runtime.is_file()
        text=runtime.read_text();assert 'require.context' not in text and not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|eval)\s*\(',text)
        sourcemap=load(DEST/'js/runtime.js.map');assert len(sourcemap['sources'])==len(sourcemap['sourcesContent'])
        for relative,content in zip(sourcemap['sources'],sourcemap['sourcesContent']):
            original=(runtime.parent/relative).resolve();assert original.is_relative_to(SOURCE.resolve())
            assert original.read_text()==content,relative
        assert any(name.endswith('/bridge-src/bridge.js') for name in sourcemap['sources'])
        assert any(name.endswith('/adapted-src/systems/updates/puzzle.js') for name in sourcemap['sources'])
    print('Black Hole Square static source/grants/data/correspondence checks PASS; game execution NOT_PERFORMED.'+(' Built source-map correspondence checked.' if args.runtime else ' Compilation NOT_PERFORMED.'))
if __name__=='__main__':main()
