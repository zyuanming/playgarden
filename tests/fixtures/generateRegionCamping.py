"""Original MIT level authoring tool. Offline deterministic; no downloaded puzzle data.
Run from repository root. Runtime ships only the resulting static TypeScript data.
"""
import random, json
from pathlib import Path
rng = random.Random(202610041647)

def rect_cells(n, r):
    a,b,c,d=r
    return [y*n+x for y in range(a,c+1) for x in range(b,d+1)]

def shikaku_count(n, clues):
    opts=[]
    for index,area in clues:
        y,x=divmod(index,n); rows=[]
        for h in range(1,n+1):
            if area%h: continue
            w=area//h
            if w>n: continue
            for a in range(max(0,y-h+1),min(y,n-h)+1):
                for b in range(max(0,x-w+1),min(x,n-w)+1):
                    r=[a,b,a+h-1,b+w-1]; cells=rect_cells(n,r)
                    if sum(i in cells for i,_ in clues)==1:
                        rows.append((r,sum(1<<i for i in cells)))
        opts.append(rows)
    count=nodes=0
    def visit(used,remaining):
        nonlocal count,nodes
        nodes+=1
        if count>=2:return
        if not remaining:
            count+=1;return
        ci=min(remaining,key=lambda j:sum(not m&used for _,m in opts[j]))
        for r,m in opts[ci]:
            if not m&used:visit(used|m,[j for j in remaining if j!=ci])
    visit(0,list(range(len(clues))))
    return count,nodes,sum(map(len,opts))

def make_shikaku(n,k):
    rs=[[0,0,n-1,n-1]]
    while len(rs)<k:
        possible=[]
        for j,(a,b,c,d) in enumerate(rs):
            for t in range(a,c):
                x=[a,b,t,d];y=[t+1,b,c,d]
                if min(len(rect_cells(n,x)),len(rect_cells(n,y)))>=2:possible.append((j,x,y))
            for t in range(b,d):
                x=[a,b,c,t];y=[a,t+1,c,d]
                if min(len(rect_cells(n,x)),len(rect_cells(n,y)))>=2:possible.append((j,x,y))
        if not possible:return None
        j,x,y=rng.choice(possible);rs[j:j+1]=[x,y]
    pairs=sorted([(rng.choice(rect_cells(n,r)),len(rect_cells(n,r)),r) for r in rs])
    clues=[[i,a] for i,a,_ in pairs]
    count,nodes,domains=shikaku_count(n,clues)
    if count!=1:return None
    return dict(size=n,clues=[dict(index=i,area=a) for i,a in clues],solution=[r for _,_,r in pairs],authoringNodes=nodes,authoringCandidates=domains)

def neighbors(n,i):
    y,x=divmod(i,n)
    return [j for j in range(n*n) if abs(y-j//n)+abs(x-j%n)==1]

def matching(n,trees,tents):
    match={}
    def aug(t,seen):
        for p in neighbors(n,t):
            if p not in tents or p in seen:continue
            seen.add(p)
            if p not in match or aug(match[p],seen):match[p]=t;return True
        return False
    return all(aug(t,set()) for t in trees)

def tents_count(n,trees,rows,cols):
    candidates={i for t in trees for i in neighbors(n,t)}-set(trees)
    opts=[[m for m in range(1<<n) if m.bit_count()==rows[y] and not m&(m<<1) and all(not(m>>x&1) or y*n+x in candidates for x in range(n))] for y in range(n)]
    count=nodes=0
    def visit(y,prev,totals,picked):
        nonlocal count,nodes
        if count>=2:return
        nodes+=1
        if y==n:
            if totals==cols and matching(n,trees,set(picked)):count+=1
            return
        for m in opts[y]:
            if m&(prev|prev<<1|prev>>1):continue
            next_totals=[totals[x]+(m>>x&1) for x in range(n)]
            if any(v>cols[x] or v+n-y-1<cols[x] for x,v in enumerate(next_totals)):continue
            visit(y+1,m,next_totals,picked+[y*n+x for x in range(n) if m>>x&1])
    visit(0,0,[0]*n,[])
    return count,nodes,sum(map(len,opts))

def make_tents(n,k):
    order=list(range(n*n));rng.shuffle(order);tents=[]
    for i in order:
        if all(max(abs(i//n-j//n),abs(i%n-j%n))>1 for j in tents):tents.append(i)
        if len(tents)==k:break
    if len(tents)!=k:return None
    trees=[]
    for i in tents:
        opts=[j for j in neighbors(n,i) if j not in tents+trees]
        if not opts:return None
        trees.append(rng.choice(opts))
    trees.sort();tents.sort()
    rows=[sum(i//n==y for i in tents) for y in range(n)]
    cols=[sum(i%n==x for i in tents) for x in range(n)]
    count,nodes,domains=tents_count(n,trees,rows,cols)
    if count!=1:return None
    return dict(size=n,trees=trees,rowCounts=rows,columnCounts=cols,solution=tents,authoringNodes=nodes,authoringCandidates=domains)

if __name__=='__main__':
    out=[];seen=set()
    titles=['三块苗圃','花床转角','方与长','交错小径','五格春光','横竖相逢','花园拼图','矩形回廊','层叠庭院','藏在角落','七彩地块','园艺规划师']
    for idx,(n,k) in enumerate([(3,3),(3,4),(4,5),(4,6),(5,7),(5,8),(5,9),(6,9),(6,10),(6,11),(7,12),(7,13)]):
        choices=[]
        for _ in range(240):
            q=make_shikaku(n,k)
            if q and json.dumps(q['clues']) not in seen:choices.append(q)
        assert choices,(n,k)
        q=sorted(choices,key=lambda q:(q['authoringNodes'],q['authoringCandidates']))[0 if idx<2 else -1]
        seen.add(json.dumps(q['clues']));q['title']=titles[idx];out.append(q)
    text='/** Original MIT puzzles, authored with deterministic rectangular partitions. Certificates are not used by solving/hints. */\nexport type ShikakuRect = [number, number, number, number];\nexport type ShikakuClue = { index: number; area: number };\nexport type ShikakuLevel = { title: string; size: number; clues: ShikakuClue[]; solution: ShikakuRect[]; authoringNodes: number; authoringCandidates: number };\nexport const shikakuLevels: ShikakuLevel[] = '+json.dumps(out,ensure_ascii=False,indent=2)+';\n'
    Path('src/games/shikakuLevels.ts').write_text(text)
    print('SHIKAKU',[(q['size'],len(q['clues']),q['authoringNodes'],q['authoringCandidates']) for q in out])
    out=[];seen=set()
    titles=['林间初营','树荫相伴','四角晨风','小径扎营','溪畔帐篷','相邻的树','六格林地','星光营地','连夜细雨','七行松林','交错树影','森林露营家']
    for idx,(n,k) in enumerate([(4,3),(4,3),(4,4),(5,4),(5,5),(5,5),(6,6),(6,7),(6,7),(7,8),(7,9),(7,10)]):
        choices=[]
        for _ in range(700):
            q=make_tents(n,k)
            if q and json.dumps([q['trees'],q['rowCounts'],q['columnCounts']]) not in seen:choices.append(q)
        assert choices,(n,k)
        q=sorted(choices,key=lambda q:(q['authoringNodes'],q['authoringCandidates']))[0 if idx<2 else -1]
        seen.add(json.dumps([q['trees'],q['rowCounts'],q['columnCounts']]));q['title']=titles[idx];out.append(q)
    text='/** Original MIT puzzles. Certificates are never read by solving, validation, or hints. */\nexport type TentsLevel = { title: string; size: number; trees: number[]; rowCounts: number[]; columnCounts: number[]; solution: number[]; authoringNodes: number; authoringCandidates: number };\nexport const tentsLevels: TentsLevel[] = '+json.dumps(out,ensure_ascii=False,indent=2)+';\n'
    Path('src/games/tentsLevels.ts').write_text(text)
    print('TENTS',[(q['size'],len(q['trees']),q['authoringNodes'],q['authoringCandidates']) for q in out])
