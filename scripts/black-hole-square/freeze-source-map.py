#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Record reviewable source hashes; never loads upstream code as a program."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'third_party/black-hole-square'
def record(path):
    data=path.read_bytes();return {'path':path.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def main():
    mapped=[]
    for path in sorted((SOURCE/'adapted-src').rglob('*')):
        if not path.is_file():continue
        original=SOURCE/'original/src'/path.relative_to(SOURCE/'adapted-src')
        entry=record(path);entry['original']=original.relative_to(ROOT).as_posix();entry['originalSha256']=hashlib.sha256(original.read_bytes()).hexdigest()
        entry['changed']=path.read_bytes()!=original.read_bytes();mapped.append(entry)
    new=[]
    for prefix in [SOURCE/'bridge-src',ROOT/'scripts/black-hole-square']:
        new.extend(record(p) for p in sorted(prefix.rglob('*')) if p.is_file() and '__pycache__' not in p.parts)
    for name in ['src/games/BlackHoleSquareGame.tsx','src/games/blackHoleSquareGame.css','e2e/black-hole-square.spec.ts','e2e/black-hole-square-focus.spec.ts',
        'e2e/fixtures/black-hole-square-input-plans.json','public/games/black-hole-square/index.html','public/games/black-hole-square/frame.css',
        'third_party/black-hole-square/ADAPTATION.md','third_party/black-hole-square/INTEGRATION.json']:
        new.append(record(ROOT/name))
    payload={'upstreamCommit':'8d48aae2097613782ab18d5062e8a3906741baaa','originalLicense':'MIT','newIntegrationLicense':'GPL-3.0-only',
        'runtimeStatus':'NOT_PERFORMED','adapted':mapped,'new':new}
    (SOURCE/'ADAPTED-MANIFEST.json').write_text(json.dumps(payload,indent=2)+'\n')
    print('Recorded',len(mapped),'mapped original modules/data and',len(new),'new preferred-source inputs.')
if __name__=='__main__':main()
