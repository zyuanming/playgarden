#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Read-only source/asset identity, import closure and runtime checks."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, re, tarfile
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'third_party/ghosted'
def sha(data): return hashlib.sha256(data).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--runtime',action='store_true');args=parser.parse_args()
    manifest=json.loads((SOURCE/'SOURCE-MANIFEST.json').read_text())
    assert manifest['commit']=='846454c3b2f7509515cbcbf8852b09f7b7d98b24'
    assert manifest['rootTree']=='83ff106812650c02d8138d93a7073575965695ed'
    originals=manifest['original'];assert len(originals)==52
    assert sorted(p.relative_to(SOURCE/'original').as_posix() for p in (SOURCE/'original').rglob('*') if p.is_file())==sorted(x['path'] for x in originals)
    for item in originals:
        data=(SOURCE/'original'/item['path']).read_bytes()
        assert len(data)==item['bytes'] and sha(data)==item['sha256'],item['path']
        assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==item['gitBlob'],item['path']
    entries={x['path']:{'sha':x['gitBlob'],'mode':x['mode'],'tree':False} for x in originals}
    entries.update({x['path']:{'sha':x['sha'],'mode':'40000','tree':True} for x in manifest['trees']})
    hashes={}
    for directory in sorted({str(PurePosixPath(p).parent) for p in entries}|{'.'},key=lambda p:(p.count('/'),len(p)),reverse=True):
        children=[]
        for name,item in entries.items():
            if str(PurePosixPath(name).parent)!=directory:continue
            leaf=PurePosixPath(name).name
            objecthash=hashes[name] if item['tree'] else item['sha']
            if item['tree']:assert objecthash==item['sha']
            children.append((leaf+('/' if item['tree'] else ''),item['mode'].encode()+b' '+leaf.encode()+b'\0'+bytes.fromhex(objecthash)))
        data=b''.join(value for _,value in sorted(children))
        hashes[directory]=hashlib.sha1(b'tree '+str(len(data)).encode()+b'\0'+data).hexdigest()
    assert hashes['.']==manifest['rootTree']
    assert len(manifest['lfs'])==4 and {x['path'] for x in manifest['lfs']}=={'f.png','g.png','misc/rgb333.png','tiled/editor_tiles.png'}
    for item in manifest['lfs']:
        data=(SOURCE/'lfs'/item['path']).read_bytes();pointer=(SOURCE/'original'/item['path']).read_text()
        assert data.startswith(b'\x89PNG\r\n\x1a\n') and len(data)==item['bytes'] and sha(data)==item['sha256']
        assert 'oid sha256:'+item['sha256'] in pointer and 'size '+str(item['bytes']) in pointer
    ts=list((SOURCE/'adapted-src').glob('*.ts'));assert len(ts)==26
    for p in ts:
        for target in re.findall(r'from\s+[\'"]([^\'"]+)[\'"]',p.read_text()):
            assert target.startswith('./') and (p.parent/(target[2:-3]+'.ts')).is_file(),(p.name,target)
    assert (SOURCE/'original/src/leveldata.ts').read_bytes()==(SOURCE/'adapted-src/leveldata.ts').read_bytes()
    maps=sorted((SOURCE/'original/levels').glob('*.tmx'));assert len(maps)==13
    packed=json.loads((SOURCE/'original/src/leveldata.ts').read_text().split('=',1)[1].strip().rstrip(';'))
    alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUV'
    for index,p in enumerate(maps):
        doc=ET.parse(p).getroot();data=doc.findall('.//data');assert len(data)==1 and data[0].attrib['encoding']=='csv'
        w,h=int(doc.attrib['width']),int(doc.attrib['height']);values=[int(v.strip()) for v in data[0].text.strip().split(',')]
        assert len(values)==w*h and values.count(2)==1
        assert alphabet[w]+alphabet[h]+''.join(alphabet[v] for v in values)==packed[index]
    assert '(c) 2024 Jani Nykänen' in (SOURCE/'LICENSE-MIT.txt').read_text()
    assert 'THE SOFTWARE IS PROVIDED "AS IS"' in (SOURCE/'LICENSE-MIT.txt').read_text()
    dest=ROOT/'public/games/ghosted'
    for name in ['f.png','g.png']:assert (dest/name).read_bytes()==(SOURCE/'lfs'/name).read_bytes()
    with tarfile.open(dest/'source.tar.gz','r:gz') as archive:
        entries=json.load(archive.extractfile('ARCHIVE-MANIFEST.json'))
        for item in entries:
            data=archive.extractfile(item['path']).read()
            assert sha(data)==item['sha256'] and data==(ROOT/item['path']).read_bytes(),item['path']
    if args.runtime:
        files=list((dest/'js').rglob('*.js'));assert len(files)==29,len(files)
        for p in files:
            for target in re.findall(r'(?:from\s+|import\s*)[\'"]([^\'"]+)[\'"]',p.read_text()):
                assert target.startswith('./') and (p.parent/target).is_file(),(p,target)
            assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|eval)\s*\(',p.read_text()),p
        assert (dest/'js/bridge.js').is_file()
    print('Ghosted source/asset checks PASS'+('; runtime import closure PASS' if args.runtime else '; compilation/runtime NOT_PERFORMED'))
if __name__=='__main__':main()
