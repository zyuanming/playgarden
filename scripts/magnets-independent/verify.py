#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
import argparse, collections, hashlib, json, pathlib, time
from oracle import solve_integer, direct, brute

KEYS=('id','title','chapter','width','height','dominoes','rowPlus','rowMinus','colPlus','colMinus')
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def canonical(p, include_clues=True, include_solution=False):
    """Transform physical cell sets and line sets, not author's signature format."""
    w,h=p['width'],p['height']; variants=[]
    for transpose in (False,True):
        W,H=(h,w) if transpose else (w,h)
        for flipx in (False,True):
            for flipy in (False,True):
                def cell(i):
                    x,y=i%w,i//w
                    if transpose: x,y=y,x
                    if flipx: x=W-1-x
                    if flipy: y=H-1-y
                    return y*W+x
                pairs=sorted(tuple(sorted((cell(a),cell(b)))) for a,b in p['dominoes'])
                for invert in (False,True):
                    lines=[]
                    if include_clues:
                        for axis, length, span in [('row',h,w),('col',w,h)]:
                            for k in range(length):
                                ids=tuple(sorted(cell(k*w+j if axis=='row' else j*w+k) for j in range(span)))
                                plus=p[axis+'Plus'][k]; minus=p[axis+'Minus'][k]
                                lines.append((ids,minus if invert else plus,plus if invert else minus))
                    solution=[]
                    if include_solution:
                        values=direct(p,p['solution'])['cells']
                        solution=[0]*(w*h)
                        for i,v in enumerate(values): solution[cell(i)]=(3-v if invert and v else v)
                    variants.append(json.dumps([W,H,pairs,sorted(lines),solution],separators=(',',':')))
    return min(variants)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--repo',default='.');ap.add_argument('--output',default='/tmp/magnets-independent.json');args=ap.parse_args()
    repo=pathlib.Path(args.repo); start=time.perf_counter()
    campaign=json.loads((repo/'docs/magnets/campaign.json').read_text())['levels']
    text=(repo/'src/games/magnetsLevels.ts').read_text()
    public=json.loads(text.split('export const magnetsLevels: MagnetsLevel[] = ',1)[1].strip().removesuffix(';'))
    assert len(campaign)==len(public)==36
    assert [{k:p[k] for k in KEYS} for p in campaign]==public
    assert all(set(p)==set(KEYS) for p in public), 'answer/metadata in public levels'
    results=[]; keys=set(); solved_keys=set(); tilings=set()
    for p in campaign:
        n=p['width']*p['height']; w=p['width']
        assert sorted(i for pair in p['dominoes'] for i in pair)==list(range(n))
        assert all(len(pair)==2 and abs(pair[0]//w-pair[1]//w)+abs(pair[0]%w-pair[1]%w)==1 for pair in p['dominoes'])
        for field,length,maximum in [('rowPlus',p['height'],w),('rowMinus',p['height'],w),('colPlus',w,p['height']),('colMinus',w,p['height'])]:
            assert len(p[field])==length and all(type(v)==int and -1<=v<=maximum for v in p[field])
        sols,exhausted,nodes=solve_integer(p)
        assert len(sols)==1 and exhausted,(p['id'],len(sols),exhausted)
        assert sols[0]==p['solution'],p['id']
        assert all(v in sols[0] for v in [0,1,2])
        horizontal=sum(a//w==b//w for a,b in p['dominoes'])
        assert 2<=horizontal<=len(p['dominoes'])-2
        key=canonical(p); skey=canonical(p,include_clues=False,include_solution=True)
        assert key not in keys,('D4/polarity duplicate',p['id'])
        assert skey not in solved_keys
        keys.add(key);solved_keys.add(skey);tilings.add(canonical(p,False))
        c=[x for field in ('rowPlus','rowMinus','colPlus','colMinus') for x in p[field]]
        item={'id':p['id'],'solutions':1,'exhausted':True,'milpNodes':nodes,'solution':sols[0],
              'canonicalSha256':hashlib.sha256(key.encode()).hexdigest(),'clues':sum(v>=0 for v in c),'zeroClues':c.count(0),
              'neutralDominoes':sols[0].count(0),'horizontalDominoes':sum(a//w==b//w for a,b in p['dominoes'])}
        results.append(item);print(f"{p['id']}: unique; neutral={item['neutralDominoes']}; MILP nodes={nodes}",flush=True)
    source=json.loads((repo/'vendor/sgtatham-magnets/source.json').read_text())
    for f in source['files']:
        path=repo/'vendor/sgtatham-magnets'/f['path'];data=path.read_bytes()
        assert digest(path)==f['sha256']
        assert hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()==f['gitBlob']
    assert (repo/'public/magnets-LICENCE.txt').read_bytes()==(repo/'vendor/sgtatham-magnets/LICENCE').read_bytes()
    summary={'levels':36,'uniquePuzzleOrbitsD4Polarity':len(keys),'uniqueTilingOrbitsD4':len(tilings),'uniqueSolvedTilingOrbitsD4Polarity':len(solved_keys),
             'dimensions':dict(collections.Counter(f"{p['width']}x{p['height']}" for p in campaign)),
             'chapters':dict(collections.Counter(p['chapter'] for p in campaign)),
             'clueRange':[min(x['clues'] for x in results),max(x['clues'] for x in results)],
             'neutralRange':[min(x['neutralDominoes'] for x in results),max(x['neutralDominoes'] for x in results)],
             'zeroClueLevels':sum(x['zeroClues']>0 for x in results),
             'seconds':round(time.perf_counter()-start,3)}
    hashes={str(path):digest(repo/path) for path in map(pathlib.Path,['docs/magnets/campaign.json','src/games/magnetsLevels.ts','src/games/magnetsLogic.ts','src/games/MagnetsGarden.tsx','vendor/sgtatham-magnets/magnets.c','vendor/sgtatham-magnets/LICENCE'])}
    report={'method':'Independent SciPy/HiGHS binary-per-cell MILP; solve then Hamming exclusion/infeasibility; no author search imported','regeneration':'Optional dependency: scipy. Run OPENBLAS_NUM_THREADS=1 python3 scripts/magnets-independent/verify.py --repo . --output docs/magnets/independent-campaign.json. Routine fixture/runtime checks need no SciPy.','summary':summary,'hashes':hashes,'levels':results}
    pathlib.Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary))
if __name__=='__main__': main()
