"""Original MIT Tents campaign authoring v1. Deterministic, offline, Tents-only.
Run from any directory: python3 scripts/tents/generate.py [--check]
Only static clues, certificates, and provenance are shipped. The public-clue trace
uses elementary count/spacing/tree deductions; it never reads a solution.
"""
from pathlib import Path
from itertools import combinations
import collections, hashlib, json, random, re, sys
ROOT = Path(__file__).resolve().parents[2]
SEED = 202610052238
VERSION = 'tents-original-v1'

def digest(value):
    return hashlib.sha256(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()

def adjacent(n, i):
    y,x=divmod(i,n)
    return [a*n+b for a,b in [(y-1,x),(y+1,x),(y,x-1),(y,x+1)] if 0<=a<n and 0<=b<n]

def touching(n,a,b):
    return max(abs(a//n-b//n),abs(a%n-b%n))<=1

def transform(n,i,t):
    y,x=divmod(i,n)
    if t>=4:x=n-1-x
    for _ in range(t%4):y,x=x,n-1-y
    return y*n+x

def canonical(n, trees=None, rows=None, cols=None, tents=None):
    variants=[]
    for t in range(8):
        if tents is not None:v=[n,sorted(transform(n,i,t) for i in tents)]
        else:
            # Transform line labels with their full cell sets, independent of solutions.
            lines=[]
            for y in range(n):lines.append((sorted(transform(n,y*n+x,t) for x in range(n)),rows[y]))
            for x in range(n):lines.append((sorted(transform(n,y*n+x,t) for y in range(n)),cols[x]))
            v=[n,sorted(transform(n,i,t) for i in trees),sorted(lines)]
        variants.append(json.dumps(v,separators=(',',':')))
    return min(variants)

def normalized_shape(n,tents):
    """Reject a repeated tent pattern even when shifted or padded onto a bigger board."""
    variants=[]
    for t in range(8):
        points=[divmod(transform(n,i,t),n) for i in tents]
        top=min(y for y,x in points);left=min(x for y,x in points)
        variants.append(json.dumps(sorted((y-top,x-left) for y,x in points),separators=(',',':')))
    return min(variants)

def matches(n,trees,tents):
    assignment={}
    def augment(tree,seen):
        for p in adjacent(n,tree):
            if p not in tents or p in seen:continue
            seen.add(p)
            if p not in assignment or augment(assignment[p],seen):assignment[p]=tree;return True
        return False
    return all(augment(t,set()) for t in trees)

def solve(q,node_limit=50000):
    n=q['size'];trees=set(q['trees']);rows=q['rowCounts'];cols=q['columnCounts']
    candidates={p for t in trees for p in adjacent(n,t)}-trees
    opts=[[m for m in range(1<<n) if m.bit_count()==rows[y] and not m&(m<<1) and all(not(m>>x&1) or y*n+x in candidates for x in range(n))] for y in range(n)]
    count=nodes=0;budget=False;answer=None
    def visit(y,prev,totals,picked):
        nonlocal count,nodes,budget,answer
        if count>=2 or budget:return
        if nodes>=node_limit:budget=True;return
        nodes+=1
        if y==n:
            if totals==cols and matches(n,trees,set(picked)):count+=1;answer=picked
            return
        for m in opts[y]:
            if m&(prev|prev<<1|prev>>1):continue
            nt=[totals[x]+(m>>x&1) for x in range(n)]
            if any(v>cols[x] or v+sum(any(mm>>x&1 for mm in choices) for choices in opts[y+1:])<cols[x] for x,v in enumerate(nt)):continue
            visit(y+1,m,nt,picked+[y*n+x for x in range(n) if m>>x&1])
    visit(0,0,[0]*n,[])
    return dict(count=count,nodes=nodes,budget=budget,candidates=sum(map(len,opts)),answer=answer)

def human_trace(q):
    """One public deduction at a time; no certificate or uniqueness assumption.
    Tree-space: a cell conflicting with EVERY possible tent beside one tree is
    grass, unless it could itself be that tree's tent. Line-pattern: enumerate
    non-touching positions in just one row/column and take their intersection.
    """
    n=q['size'];trees=set(q['trees']);possible={p for t in trees for p in adjacent(n,t)}-trees
    state=[-1 if i in possible else 0 for i in range(n*n)];trace=[]
    lines=[('row',y,[y*n+x for x in range(n)],q['rowCounts'][y]) for y in range(n)]+[('column',x,[y*n+x for y in range(n)],q['columnCounts'][x]) for x in range(n)]
    def record(rule,changes,**reason):
        changes=[(i,v) for i,v in changes if state[i]==-1]
        if not changes:return False
        for i,v in changes:state[i]=v
        trace.append(dict(rule=rule,changes=[list(c) for c in changes],**reason));return True
    while True:
        if any(state[i]==1 and any(state[j]==1 for j in range(i) if touching(n,i,j)) for i in range(n*n)):return None
        if sum(v==1 for v in state)==len(trees):
            if not all(sum(state[i]==1 for i in cells)==target for _,_,cells,target in lines):return None
            if not matches(n,trees,{i for i,v in enumerate(state) if v==1}):return None
            counts=collections.Counter(s['rule'] for s in trace)
            return dict(steps=len(trace),rules=dict(counts),initialCandidates=len(possible),trace=trace)
        progressed=False
        for tent in [i for i,v in enumerate(state) if v==1]:
            if record('spacing',[(i,0) for i in range(n*n) if i!=tent and touching(n,i,tent)],tent=tent):progressed=True;break
        if progressed:continue
        for axis,index,cells,target in lines:
            ones=sum(state[i]==1 for i in cells);unknown=[i for i in cells if state[i]==-1]
            if ones>target or ones+len(unknown)<target:return None
            value=0 if ones==target else 1 if ones+len(unknown)==target else None
            if value is not None and record('line-count',[(i,value) for i in unknown],axis=axis,index=index,target=target):progressed=True;break
        if progressed:continue
        for tree in sorted(trees):
            domain=[p for p in adjacent(n,tree) if state[p]!=0]
            if not domain:return None
            if len(domain)==1 and record('tree-single',[(domain[0],1)],tree=tree):progressed=True;break
        if progressed:continue
        for axis,index,cells,target in lines:
            choices=[]
            for selected in combinations([i for i in cells if state[i]!=0],target):
                if any(state[i]==1 and i not in selected for i in cells):continue
                if any(touching(n,a,b) for a,b in combinations(selected,2)):continue
                choices.append(set(selected))
            if not choices:return None
            union=set.union(*choices);common=set.intersection(*choices)
            if record('line-pattern',[(i,1) for i in sorted(common)]+[(i,0) for i in cells if i not in union],axis=axis,index=index,target=target,patterns=[sorted(c) for c in choices]):progressed=True;break
        if progressed:continue
        for tree in sorted(trees):
            domain=[p for p in adjacent(n,tree) if state[p]!=0]
            removed=[i for i,v in enumerate(state) if v==-1 and i not in domain and all(touching(n,i,p) for p in domain)]
            if record('tree-space',[(i,0) for i in removed],tree=tree,domain=domain):progressed=True;break
        if not progressed:return None

def make(rng,n,k):
    order=list(range(n*n));rng.shuffle(order);tents=[]
    for p in order:
        if all(not touching(n,p,q) for q in tents):tents.append(p)
        if len(tents)==k:break
    if len(tents)!=k:return None
    trees=[]
    for p in tents:
        choices=[q for q in adjacent(n,p) if q not in tents and q not in trees]
        if not choices:return None
        trees.append(rng.choice(choices))
    return dict(size=n,trees=sorted(trees),rowCounts=[sum(i//n==r for i in tents) for r in range(n)],columnCounts=[sum(i%n==c for i in tents) for c in range(n)],solution=sorted(tents))

GROUPS=[
 dict(id=1,key='counts',title='行列与树影',count=28,sizes=[4,5],objective='先看零行列和已满的行列，再找树旁唯一的空位。'),
 dict(id=2,key='spacing',title='间距与排除',count=50,sizes=[5,6],objective='结合帐篷不能接触的规则，比较一行或一列的可行摆法。'),
 dict(id=3,key='trees',title='树旁的空间',count=50,sizes=[6,7],objective='一棵树的候选位置都需要空间；排除会同时挡住它们的格子。'),
 dict(id=4,key='challenge',title='森林综合挑战',count=60,sizes=[7],objective='交替运用行列数量、间距组合和树旁空间，完成更长的推理链。'),
]

def qualifies(g,q,m):
    r=m['rules'];n=q['size'];k=len(q['trees']);zero=sum(v==0 for v in q['rowCounts']+q['columnCounts'])
    if len(set(q['rowCounts']+q['columnCounts']))<2:return False
    if g==1:return r.get('line-pattern',0)==0 and r.get('tree-space',0)==0 and k>=4 and m['steps']>=5
    if g==2:return r.get('line-pattern',0)>=1 and r.get('tree-space',0)==0 and k>=5 and m['steps']>=9
    if g==3:return r.get('tree-space',0)>=1 and k>=6 and m['steps']>=12
    return r.get('tree-space',0)>=1 and r.get('line-pattern',0)>=2 and k>=8 and zero<=2 and m['steps']>=18

def legacy():
    raw=(ROOT/'src/games/tentsLevels.ts').read_text().split('export const tentsLevels: TentsLevel[] = [',1)[1].split('...tentsExpansion',1)[0]
    raw='['+raw.rsplit('];',1)[0].rstrip().rstrip(',')+']'
    return json.loads(re.sub(r',\s*([}\]])',r'\1',re.sub(r'\b([A-Za-z][A-Za-z0-9]*)\s*:',r'"\1":',raw)))

def generate():
    rng=random.Random(SEED);old=legacy();puzzles={canonical(q['size'],q['trees'],q['rowCounts'],q['columnCounts']) for q in old};shapes={normalized_shape(q['size'],q['solution']) for q in old};out=[];reports=[];stats=collections.Counter();group_stats=[]
    for g in GROUPS:
        pool=[];poolshapes=set();attempt=0
        while len(pool)<g['count']*3 and attempt<250000:
            attempt+=1;stats['attempted']+=1;n=rng.choice(g['sizes']);k=rng.randint({4:4,5:4,6:6,7:8}[n],{4:4,5:6,6:8,7:11}[n]);q=make(rng,n,k)
            if q is None:stats['constructionFailed']+=1;continue
            pk=canonical(n,q['trees'],q['rowCounts'],q['columnCounts']);sk=normalized_shape(n,q['solution'])
            if pk in puzzles:stats['puzzleSymmetryDuplicate']+=1;continue
            if sk in shapes or sk in poolshapes:stats['solutionSymmetryDuplicate']+=1;continue
            metrics=human_trace(q)
            if metrics is None:stats['noLogicalTrace']+=1;continue
            if not qualifies(g['id'],q,metrics):stats['outsideChapter']+=1;continue
            result=solve(q)
            if result['budget'] or result['count']!=1:stats['notProvenUnique']+=1;continue
            assert result['answer']==q['solution']
            q['authoringNodes']=result['nodes'];q['authoringCandidates']=result['candidates']
            pool.append((q,metrics,pk,sk));poolshapes.add(sk)
            if len(pool)%30==0:print(g['key'],attempt,len(pool),flush=True)
        if len(pool)<g['count']:raise RuntimeError(f"Not enough quality candidates for {g['key']}: {len(pool)} from {attempt}")
        pool.sort(key=lambda item:(item[0]['size'],item[1]['steps']+3*item[1]['rules'].get('line-pattern',0)+5*item[1]['rules'].get('tree-space',0),digest(item[0])))
        # Evenly sample the qualifying pool, retaining diverse sizes and reasoning lengths.
        chosen=[pool[round(i*(len(pool)-1)/(g['count']-1))] for i in range(g['count'])]
        for j,(q,m,pk,sk) in enumerate(chosen):
            ident=f'tents-{g["key"]}-{j+1:03d}';q.update(id=ident,contentVersion=1,chapter=g['id'],objective=g['objective'],title=f'{g["title"]} {j+1:02d}')
            puzzles.add(pk);shapes.add(sk);out.append(q)
            reports.append(dict(id=ident,index=len(old)+len(out)-1,clueHash=digest([q['size'],q['trees'],q['rowCounts'],q['columnCounts']]),puzzleD4Hash=digest(pk),shapeD4Hash=digest(canonical(q['size'],tents=q['solution'])),normalizedShapeHash=digest(sk),authoringNodes=q['authoringNodes'],metrics=m))
        group_stats.append(dict(chapter=g['id'],count=g['count'],attempts=attempt,pool=len(pool),sizes=dict(collections.Counter(q['size'] for q,_,_,_ in chosen)),stepRange=[min(m['steps'] for _,m,_,_ in chosen),max(m['steps'] for _,m,_,_ in chosen)]))
        print('CHAPTER',group_stats[-1],flush=True)
    report=dict(generator=VERSION,seed=SEED,total=200,legacyHash=digest(old),expansionHash=digest(out),rejections=dict(stats),chapters=group_stats,levels=reports)
    return out,report

if __name__=='__main__':
    out,report=generate();outputs={'src/games/tentsExpansionData.json':json.dumps(out,ensure_ascii=False,indent=2)+'\n','docs/tents/authoring-report.json':json.dumps(report,ensure_ascii=False,indent=2)+'\n'}
    for path,text in outputs.items():
        if '--check' in sys.argv:assert (ROOT/path).read_text()==text,f'Stale generated file: {path}'
        else:(ROOT/path).parent.mkdir(parents=True,exist_ok=True);(ROOT/path).write_text(text)
    print(json.dumps({k:v for k,v in report.items() if k!='levels'},ensure_ascii=False,indent=2))
