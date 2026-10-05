"""Original MIT Shikaku authoring pipeline v1. No network or third-party banks.
Writes only the Shikaku expansion and its report. Legacy levels are read, never rewritten.
Run: python3 scripts/shikaku/generate.py [--check]
"""
from pathlib import Path
import collections, hashlib, json, random, re, sys
ROOT = Path(__file__).resolve().parents[2]
SEED = 202610051610
VERSION = 'shikaku-original-v1'
rng = random.Random(SEED)

def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()

def cells(n, r):
    a,b,c,d=r
    return [y*n+x for y in range(a,c+1) for x in range(b,d+1)]

def transformed(n, index, symmetry):
    y,x=divmod(index,n)
    if symmetry>=4:x=n-1-x
    for _ in range(symmetry%4):y,x=x,n-1-y
    return y*n+x

def canonical(n, clues=None, rectangles=None):
    variants=[]
    for t in range(8):
        if clues is not None:
            out=sorted((transformed(n,c['index'],t),c['area']) for c in clues)
        else:
            out=sorted(tuple(sorted(transformed(n,i,t) for i in cells(n,r))) for r in rectangles)
        variants.append(json.dumps([n,out],separators=(',',':')))
    return min(variants)

def candidates(n, clues):
    domains=[]
    for clue in clues:
        y,x=divmod(clue['index'],n); area=clue['area']; domain=[]
        for h in range(1,n+1):
            if area%h:continue
            w=area//h
            if w>n:continue
            for a in range(max(0,y-h+1),min(y,n-h)+1):
                for b in range(max(0,x-w+1),min(x,n-w)+1):
                    rect=[a,b,a+h-1,b+w-1]; mask=sum(1<<i for i in cells(n,rect))
                    if sum(bool(mask&(1<<c['index'])) for c in clues)==1:domain.append((rect,mask))
        domains.append(domain)
    return domains

def count_solutions(n, domains):
    count=nodes=0; budget=False
    def visit(used, remaining):
        nonlocal count,nodes,budget
        if count>=2 or budget:return
        if nodes>=50000:budget=True;return
        nodes+=1
        if not remaining:
            if used.bit_count()==n*n:count+=1
            return
        available=[(j,[(r,m) for r,m in domains[j] if not m&used]) for j in remaining]
        j,options=min(available,key=lambda v:len(v[1]))
        for r,m in options:visit(used|m,[k for k in remaining if k!=j])
    visit(0,list(range(len(domains))))
    return count,nodes,budget

def human_trace(n, original):
    """Only public candidate domains: singleton, sole covering clue, shared cells.
    No guessing, certificate, uniqueness assumption, or search-node difficulty score.
    One placement/propagation step at a time exposes the actual deduction chain.
    """
    domains=[list(d) for d in original]; selected=set(); used=0; trace=[]
    initial_singles=sum(len(d)==1 for d in domains)
    while len(selected)<len(domains):
        if any(not d for d in domains):return None
        forced=next((j for j,d in enumerate(domains) if j not in selected and len(d)==1),None)
        if forced is not None:
            r,m=domains[forced][0]; selected.add(forced);used|=m
            removed=0
            for k in range(len(domains)):
                if k in selected:continue
                old=len(domains[k]);domains[k]=[(a,b) for a,b in domains[k] if not b&m];removed+=old-len(domains[k])
            trace.append(dict(rule='single',clue=forced,rectangle=r,removed=removed));continue
        progress=False
        for i in range(n*n):
            if used>>i&1:continue
            owners=[(j,k) for j,d in enumerate(domains) if j not in selected for k,(_,m) in enumerate(d) if m>>i&1]
            if not owners:return None
            clue_owners={j for j,k in owners}
            if len(clue_owners)==1:
                j=next(iter(clue_owners));kept=[option for option in domains[j] if option[1]>>i&1]
                removed=len(domains[j])-len(kept)
                if removed:
                    domains[j]=kept
                    trace.append(dict(rule='coverage',cell=i,clue=j,removed=removed));progress=True;break
        if progress:continue
        # Every candidate of a clue contains these cells, even when its final rectangle is unknown.
        for j,domain in enumerate(domains):
            if j in selected:continue
            common=domain[0][1]
            for _,m in domain[1:]:common&=m
            removed=0
            for k in range(len(domains)):
                if k==j or k in selected:continue
                old=len(domains[k]);domains[k]=[(a,b) for a,b in domains[k] if not b&common];removed+=old-len(domains[k])
            if removed:
                trace.append(dict(rule='intersection',clue=j,cells=[i for i in range(n*n) if common>>i&1],removed=removed));progress=True;break
        if not progress:return None
    counts=collections.Counter(s['rule'] for s in trace)
    return dict(initialSingles=initial_singles,candidates=sum(map(len,original)),singles=counts['single'],coverage=counts['coverage'],intersection=counts['intersection'],eliminated=sum(s['removed'] for s in trace),steps=len(trace),trace=trace)

def partition(n):
    """Random exact tiling by first-uncovered-cell growth, not recursive guillotine cuts.
    Small bounded backtracking permits non-slicing/pinwheel floor plans.
    """
    full=(1<<(n*n))-1; attempts=0
    def tile(used, rectangles):
        nonlocal attempts
        attempts+=1
        if attempts>300:return None
        if used==full:return rectangles
        if len(rectangles)>n*n//2:return None
        i=next(j for j in range(n*n) if not used>>j&1);a,b=divmod(i,n); opts=[]
        for h in range(1,n-a+1):
            for w in range(1,n-b+1):
                area=h*w
                if area<2 or area>min(16,n*n//2):continue
                r=[a,b,a+h-1,b+w-1];m=sum(1<<j for j in cells(n,r))
                if not m&used:
                    # Vary shape and region scale without favouring full-board strips.
                    score=rng.random()*(1.4 if h>1 and w>1 else 1.0)/(1+max(0,area-8)*.08)
                    opts.append((score,r,m))
        for _,r,m in sorted(opts,reverse=True):
            result=tile(used|m,rectangles+[r])
            if result is not None:return result
        return None
    return tile(0,[])

def non_slicing(n, rectangles):
    return not any(all(not (r[0]<line<=r[2]) for r in rectangles) for line in range(1,n)) and not any(all(not (r[1]<line<=r[3]) for r in rectangles) for line in range(1,n))

GROUPS=[
 dict(id='factors',title='因数与边界',count=28,sizes=[4,5],objective='列出面积的长宽组合，再用边界与其他数字排除。'),
 dict(id='coverage',title='覆盖与排除',count=50,sizes=[5,6],objective='关注只能由一个数字所属区域覆盖的格子，逐步排除冲突区域。'),
 dict(id='intersections',title='组合约束',count=50,sizes=[6,7],objective='找出某个数字所有候选共同占用的格子，约束相邻区域。'),
 dict(id='challenge',title='综合挑战',count=60,sizes=[7],objective='交替运用面积、唯一覆盖与共同占格，完成较长推理链。'),
]

def qualifies(group,metrics,rectangles,n):
    k=len(rectangles); nonstrips=sum(r[2]>r[0] and r[3]>r[1] for r in rectangles)
    if len(set((r[2]-r[0]+1)*(r[3]-r[1]+1) for r in rectangles))<3:return False
    if nonstrips<(1 if n<=5 else 2):return False
    if sum(r[0]==r[2] or r[1]==r[3] for r in rectangles)>k*.8:return False
    if metrics['candidates']-k<3:return False
    if group=='factors':return 4<=k<=8 and metrics['initialSingles']>=1 and metrics['intersection']==0
    if group=='coverage':return 6<=k<=11 and metrics['coverage']>=2 and metrics['intersection']==0
    if group=='intersections':return 7<=k<=13 and metrics['intersection']>=1 and metrics['coverage']>=1
    return 8<=k<=14 and metrics['intersection']>=2 and metrics['coverage']>=2 and metrics['initialSingles']<=2

def legacy_levels():
    raw=(ROOT/'src/games/shikakuLevels.ts').read_text()
    # The original twelve are deliberately kept as source data in the same order.
    text=raw.split('export const shikakuLevels: ShikakuLevel[] = [',1)[1].split('...shikakuExpansion',1)[0]
    text='['+text.rsplit('];',1)[0].rstrip().rstrip(',')+']'
    return json.loads(re.sub(r',\s*([}\]])',r'\1',re.sub(r'\b([A-Za-z][A-Za-z0-9]*)\s*:',r'"\1":',text)))

def generate():
    legacy=legacy_levels(); clue_keys={canonical(l['size'],clues=l['clues']) for l in legacy}; shape_keys={canonical(l['size'],rectangles=l['solution']) for l in legacy}
    levels=[]; reports=[]; statistics=collections.Counter(); group_stats=[]
    for gi,group in enumerate(GROUPS):
        pool=[]; local_shapes=set();attempt=0
        while len(pool)<group['count']*3 and attempt<150000:
            attempt+=1;statistics['attempted']+=1;n=rng.choice(group['sizes']);rs=partition(n)
            if rs is None:statistics['tilingFailed']+=1;continue
            if len(rs)<4:statistics['tooFewRegions']+=1;continue
            pairs=sorted((rng.choice(cells(n,r)),len(cells(n,r)),r) for r in rs)
            clues=[dict(index=i,area=area) for i,area,r in pairs];rs=[r for _,_,r in pairs]
            ck=canonical(n,clues=clues);sk=canonical(n,rectangles=rs)
            if ck in clue_keys:statistics['d4Duplicate']+=1;continue
            if sk in shape_keys or sk in local_shapes:statistics['structureDuplicate']+=1;continue
            domains=candidates(n,clues); metrics=human_trace(n,domains)
            if metrics is None:statistics['notDeductionSolved']+=1;continue
            if not qualifies(group['id'],metrics,rs,n):statistics['qualityOrGroup']+=1;continue
            count,nodes,budget=count_solutions(n,domains)
            if budget or count!=1:statistics['budgetOrNonUnique']+=1;continue
            l=dict(size=n,clues=clues,solution=rs,authoringNodes=nodes,authoringCandidates=sum(map(len,domains)))
            report=dict(metrics=metrics,clueHash=digest(ck),structureHash=digest(sk),nonSlicing=non_slicing(n,rs),attempt=statistics['attempted'])
            pool.append((l,report,ck,sk));local_shapes.add(sk)
        if len(pool)<group['count']:raise RuntimeError(f'Insufficient quality: {group["id"]} {len(pool)}/{group["count"]}; {statistics}')
        # Round-robin diversity buckets by size, region count and inference mix.
        buckets=collections.defaultdict(list)
        for item in pool:
            l,r,_,_=item;m=r['metrics'];buckets[(l['size'],len(l['clues']),min(3,m['intersection']),min(4,m['coverage']),r['nonSlicing'])].append(item)
        picked=[];keys=sorted(buckets)
        while len(picked)<group['count']:
            for key in keys:
                if buckets[key] and len(picked)<group['count']:picked.append(buckets[key].pop(0))
        picked.sort(key=lambda item:(item[0]['size'],item[1]['metrics']['intersection'],item[1]['metrics']['coverage'],item[1]['metrics']['eliminated']))
        start=len(legacy)+len(levels)
        for j,(l,r,ck,sk) in enumerate(picked):
            index=len(legacy)+len(levels);ident=f'shikaku-{index+1:03d}';l.update(id=ident,contentVersion=1,chapter=gi+1,title=f'{group["title"]} {j+1:02d}',objective=group['objective']);r.update(id=ident,index=index,chapter=group['id'],seed=SEED,generatorVersion=VERSION,contentVersion=1)
            levels.append(l);reports.append(r);clue_keys.add(ck);shape_keys.add(sk)
        group_stats.append(dict(id=group['id'],start=start,count=group['count'],attempts=attempt,qualified=len(pool)))
        print(group['id'],group_stats[-1],flush=True)
    content_hash=digest([dict(size=l['size'],clues=l['clues']) for l in legacy+levels])
    statistics['qualified']=sum(g['qualified'] for g in group_stats)
    statistics['selected']=len(levels)
    statistics['diversityNotSelected']=statistics['qualified']-len(levels)
    report=dict(generatorVersion=VERSION,seed=SEED,legacyCount=len(legacy),addedCount=len(levels),count=len(legacy)+len(levels),contentHash=content_hash,statistics=dict(statistics),groups=group_stats,levels=reports)
    ts='/** Original MIT puzzles. Generated by scripts/shikaku/generate.py; do not edit by hand. */\nimport type { ShikakuLevel } from "./shikakuLevels";\nexport const shikakuExpansion: ShikakuLevel[] = '+json.dumps(levels,ensure_ascii=False,indent=2)+';\n'
    outputs={ROOT/'src/games/shikakuExpansion.ts':ts,ROOT/'docs/shikaku/authoring-report.json':json.dumps(report,ensure_ascii=False,indent=2)+'\n'}
    for p,text in outputs.items():
        if '--check' in sys.argv:
            if not p.exists() or p.read_text()!=text:raise RuntimeError(f'Regeneration mismatch: {p}')
        else:p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
    print(json.dumps(dict(count=report['count'],hash=content_hash,statistics=report['statistics']),indent=2))
if __name__=='__main__':generate()
