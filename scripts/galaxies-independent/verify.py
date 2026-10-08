#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Independent Galaxies oracle: enumerate connected symmetric regions, exact cover.
No import of author logic or generator; public clues are parsed from TS data.
"""
import argparse, hashlib, itertools, json, pathlib, statistics, time

def bits(mask):
    while mask:
        b = mask & -mask
        yield b.bit_length()-1
        mask ^= b

def adjacent(n, i):
    x,y=i%n,i//n
    return [b*n+a for a,b in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)) if 0<=a<n and 0<=b<n]

def touches(n,c):
    # Geometric test: doubled star coordinate lies in closed unit cell square.
    return {i for i in range(n*n) if 2*(i%n)<=c[0]<=2*(i%n+1) and 2*(i//n)<=c[1]<=2*(i//n+1)}

def reflected(n,c,i):
    px,py=2*(i%n)+1,2*(i//n)+1
    qx,qy=2*c[0]-px,2*c[1]-py
    if not(0<qx<2*n and 0<qy<2*n): return None
    return ((qy-1)//2)*n+(qx-1)//2

def valid(n, centers, cells):
    if len(cells)!=n*n or any(type(g)!=int or not 0<=g<len(centers) for g in cells): return False
    for g,c in enumerate(centers):
        region={i for i,v in enumerate(cells) if v==g}
        if not region or not touches(n,c)<=region: return False
        if any(touches(n,d)&region for h,d in enumerate(centers) if h!=g): return False
        if any(reflected(n,c,i) not in region for i in region): return False
        found={next(iter(region))}; queue=list(found)
        for i in queue:
            for j in adjacent(n,i):
                if j in region and j not in found: found.add(j); queue.append(j)
        if found!=region: return False
    return True

def candidates(n,centers,g):
    c=centers[g]; core=touches(n,c)
    forbidden=set.union(set(),*(touches(n,d) for h,d in enumerate(centers) if h!=g))
    if core & forbidden: return []
    allowed=set()
    for i in range(n*n):
        j=reflected(n,c,i)
        if j is not None and not {i,j}&forbidden: allowed.add(i)
    if not core<=allowed: return []
    base=sum(1<<i for i in core)
    orbits=set((1<<i)|(1<<reflected(n,c,i)) for i in allowed if i not in core)
    pairlist=[(m,sum(1<<j for j in set(itertools.chain.from_iterable(adjacent(n,i) for i in bits(m))))) for m in orbits]
    # Grow whole half-turn orbits from the star core. Quotient connectivity is
    # equivalent to region connectivity because each frontier pair touches its
    # two reflected sides of an already connected symmetric region.
    seen={base}; stack=[base]
    while stack:
        cur=stack.pop()
        for mask,frontier in pairlist:
            if not cur&mask and cur&frontier:
                new=cur|mask
                if new not in seen: seen.add(new); stack.append(new)
    return sorted(seen)

def solve(n,centers,limit=2):
    shapes=[candidates(n,centers,g) for g in range(len(centers))]
    nodes=0; answers=[]; full=(1<<(n*n))-1
    def visit(todo, occupied, picked):
        nonlocal nodes
        nodes+=1
        if not todo:
            if occupied==full:
                state=[-1]*(n*n)
                for g,mask in picked:
                    for i in bits(mask):state[i]=g
                assert valid(n,centers,state)
                answers.append(state)
            return
        filtered={g:[mask for mask in shapes[g] if not mask&occupied] for g in todo}
        if any(not a for a in filtered.values()): return
        possible=occupied
        for a in filtered.values():
            for m in a: possible|=m
        if possible!=full: return
        # Exact cover columns include every cell plus exactly one region per star.
        options=[[(g,m) for m in a] for g,a in filtered.items()]
        for i in bits(full^occupied):
            opts=[(g,m) for g,a in filtered.items() for m in a if m&(1<<i)]
            if not opts:return
            options.append(opts)
        branch=min(options,key=len)
        for g,m in branch:
            visit(tuple(h for h in todo if h!=g), occupied|m, picked+[(g,m)])
            if len(answers)>=limit:return
    visit(tuple(range(len(centers))),0,[])
    return answers,nodes,[len(a) for a in shapes]

def canonical(n, points):
    allkeys=[]
    for flip in (False,True):
        for turns in range(4):
            pts=[]
            for a,b in points:
                x,y=(2*n-a if flip else a),b
                for _ in range(turns):x,y=2*n-y,x
                pts.append((x,y))
            allkeys.append(tuple(sorted(pts)))
    return n,min(allkeys)

def shape_canonical(n,indices):
    # Translation and all D4 transforms, independent of star IDs and board position.
    pts=[(i%n,i//n) for i in indices]; reps=[]
    for flip in (False,True):
        for turns in range(4):
            out=[]
            for a,b in pts:
                x,y=(-a if flip else a),b
                for _ in range(turns): x,y=-y,x
                out.append((x,y))
            minx=min(x for x,y in out);miny=min(y for x,y in out)
            reps.append(tuple(sorted((x-minx,y-miny) for x,y in out)))
    return min(reps)

def selftests():
    cases=0
    # Exhaustive 2x2 center sets, all cell labels, versus generated exact cover.
    points=list(itertools.product(range(1,4),repeat=2))
    for k in range(1,4):
        for cs in itertools.combinations(points,k):
            expected=[list(s) for s in itertools.product(range(k),repeat=4) if valid(2,cs,s)]
            actual,_,_=solve(2,cs,1000)
            assert sorted(actual)==sorted(expected),(cs,actual,expected)
            cases+=1
    # Independently compare every region subset on 3x3 for all center positions.
    for c in itertools.product(range(1,6),repeat=2):
        want=[]
        for mask in range(1,1<<9):
            region=set(bits(mask))
            if not touches(3,c)<=region or any(reflected(3,c,i) not in region for i in region):continue
            seen={next(iter(region))};q=list(seen)
            for i in q:
                for j in adjacent(3,i):
                    if j in region and j not in seen: seen.add(j);q.append(j)
            if seen==region:want.append(mask)
        assert candidates(3,[c],0)==want,c
        cases+=1
    return cases

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--repo',required=True);ap.add_argument('--output',required=True);args=ap.parse_args()
    repo=pathlib.Path(args.repo);start=time.time()
    raw=(repo/'src/games/galaxiesLevels.ts').read_text()
    levels=json.loads(raw.split('export const galaxiesLevels: GalaxiesLevel[] = ',1)[1].strip().removesuffix(';'))
    offline=json.loads((repo/'docs/galaxies/campaign.json').read_text())['levels']
    assert len(levels)==len(offline)==36
    assert len({p['id'] for p in levels})==36
    assert len({canonical(p['size'],p['centers']) for p in levels})==36,'D4 duplicate clues'
    checked=selftests(); report=[];global_shapes=set()
    for p,proof in zip(levels,offline):
        n,cs=p['size'],p['centers'];begin=time.time()
        assert all(type(v)==int and 0<v<2*n for c in cs for v in c)
        assert len(set(map(tuple,cs)))==len(cs)
        fixed=[touches(n,c) for c in cs]
        assert all(not a&b for a,b in itertools.combinations(fixed,2)),'overlapping center cores'
        assert {k:proof[k] for k in p}==p
        answers,nodes,counts=solve(n,cs)
        assert len(answers)==1,(p['id'],'solution count',len(answers))
        assert valid(n,cs,proof['solution']) and answers[0]==proof['solution']
        solution=answers[0];regs=[{i for i,v in enumerate(solution) if v==g} for g in range(len(cs))]
        shapes=[shape_canonical(n,a) for a in regs];global_shapes.update(shapes)
        nonrect=sum(len(a)!=(max(i%n for i in a)-min(i%n for i in a)+1)*(max(i//n for i in a)-min(i//n for i in a)+1) for a in regs)
        editable=n*n-sum(map(len,fixed))
        info={'id':p['id'],'chapter':p['chapter'],'size':n,'centers':len(cs),'fixedCells':n*n-editable,'editableCells':editable,'solutionCount':len(answers),'exactCoverNodes':nodes,'regionCandidates':counts,'areaProfile':sorted(map(len,regs)),'nonrectangularRegions':nonrect,'centerTypes':{'cell':sum(x%2==y%2==1 for x,y in cs),'edge':sum((x+y)%2==1 for x,y in cs),'vertex':sum(x%2==y%2==0 for x,y in cs)},'seconds':round(time.time()-begin,4)}
        report.append(info);print(p['id'], 'unique',nodes,'nodes',counts,flush=True)
    chapter=[]
    for ch in range(4):
        rows=[r for r in report if r['chapter']==ch];assert len(rows)==9
        chapter.append({'chapter':ch,'count':len(rows),'size':sorted({r['size'] for r in rows}),'editableMin':min(r['editableCells'] for r in rows),'editableMax':max(r['editableCells'] for r in rows),'editableMedian':statistics.median(r['editableCells'] for r in rows),'exactCoverNodeMedian':statistics.median(r['exactCoverNodes'] for r in rows),'exactCoverNodeMax':max(r['exactCoverNodes'] for r in rows),'nonrectangularRegions':sum(r['nonrectangularRegions'] for r in rows),'areaProfiles':len({tuple(r['areaProfile']) for r in rows})})
    result={'method':'independent region-orbit enumeration + exact cover; direct geometric BFS validator','selftestCases':checked,'count':36,'allUnique':True,'d4Unique':True,'distinctRegionShapesD4Translation':len(global_shapes),'chapters':chapter,'levels':report,'inputsSha256':{str(p.relative_to(repo)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [repo/'src/games/galaxiesLogic.ts',repo/'src/games/galaxiesLevels.ts',repo/'docs/galaxies/campaign.json']},'seconds':round(time.time()-start,3)}
    pathlib.Path(args.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='levels'},indent=2))
if __name__=='__main__':main()
