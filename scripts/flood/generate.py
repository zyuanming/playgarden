"""Original deterministic campaign, independently solved by region-mask BFS.
Runtime is a cell recolouring queue; this generator contracts fixed components.
Run with --check to compare the two checked-in campaign files.
"""
import json, random, pathlib, sys
from collections import deque
ROOT=pathlib.Path(__file__).resolve().parents[2]
def neighbors(p,n):
    x,y=p%n,p//n
    return [yy*n+xx for xx,yy in [(x+1,y),(x,y+1),(x-1,y),(x,y-1)] if 0<=xx<n and 0<=yy<n]
def graph(board,n):
    ids=[-1]*len(board); colors=[]; regions=[]
    for p,c in enumerate(board):
        if ids[p]>=0:continue
        idx=len(colors);colors.append(c);ids[p]=idx;region=[p]
        for q in region:
            for v in neighbors(q,n):
                if ids[v]<0 and board[v]==c:ids[v]=idx;region.append(v)
        regions.append(region)
    adjacent=[]
    for i,region in enumerate(regions):
        adjacent.append(sum(1<<j for j in {ids[v] for q in region for v in neighbors(q,n)} if j!=i))
    return colors,adjacent

def solve(board,n,limit=6000,initial=None):
    colors,adj=graph(board,n);allmask=(1<<len(colors))-1
    masks=[sum(1<<i for i,c in enumerate(colors) if c==color) for color in range(max(colors)+1)]
    def expand(mask,color):
        border=0
        for i,a in enumerate(adj):
            if mask>>i&1:border|=a
        return mask|(border&masks[color])
    start=1 if initial is None else expand(1,initial)
    queue=deque([(start,[])]);seen={start}
    while queue:
        mask,path=queue.popleft()
        if mask==allmask:return path,len(seen),len(colors)
        for c in range(len(masks)):
            new=expand(mask,c)
            if new==mask or new in seen:continue
            if len(seen)>=limit:return None,len(seen),len(colors)
            seen.add(new);queue.append((new,path+[c]))
    raise RuntimeError('unreachable')

def canonical(board,n):
    variants=[]
    for reflect in range(2):
        for rotation in range(4):
            result=[]
            for y in range(n):
                for x in range(n):
                    xx,yy=(n-1-x,y) if reflect else (x,y)
                    for _ in range(rotation):xx,yy=n-1-yy,xx
                    result.append(board[yy*n+xx])
            ids={};mapped=[]
            for c in result:
                if c not in ids:ids[c]=len(ids)
                mapped.append(ids[c])
            variants.append(''.join(map(str,mapped)))
    return str(n)+':'+min(variants)

def generate():
    randomizer=random.Random(901007);seen=set();levels=[];proofs=[]
    # Gradual spatial and planning load, all boards require choices.
    chapters=[(4,3,3,4),(5,3,4,5),(6,4,5,6),(7,4,6,7),(8,5,7,9)]
    titles=['初染一角','跨过色带','连起远方','绕路汇合','全园同色']
    for chapter,(n,colors,low,high) in enumerate(chapters):
        candidates=[];attempts=0
        while len(candidates)<20:
            attempts+=1
            if attempts>10000:raise RuntimeError(('generation budget',chapter))
            board=[randomizer.randrange(colors) for _ in range(n*n)]
            # Organic connected patches, not enlarged copies of small boards.
            for _ in range(n*n//2):
                p=randomizer.randrange(n*n);board[p]=board[randomizer.choice(neighbors(p,n))]
            key=canonical(board,n)
            if key in seen:continue
            path,nodes,regions=solve(board,n)
            if path is None or not low<=len(path)<=high or len(set(board))!=colors:continue
            opening=[]
            for c in range(colors):
                if c==board[0]:continue
                tail,_,_=solve(board,n,initial=c)
                if tail is None:break
                opening.append({'color':c,'distance':1+len(tail)})
            else:
                if chapter>0 and not any(o['distance']>len(path) for o in opening):continue
                seen.add(key);candidates.append((len(path),nodes,board,path,opening,regions));continue
        candidates.sort(key=lambda t:(t[0],t[1]))
        for k,(optimum,nodes,board,path,opening,regions) in enumerate(candidates):
            idx=len(levels)+1;id=f'flood-{idx:03}'
            levels.append(dict(id=id,title=f'{titles[chapter]} · {k+1:02}',chapter=chapter,size=n,colors=colors,board=board,limit=optimum+(1 if chapter<2 else 0),optimum=optimum))
            proofs.append(dict(id=id,solution=path,openingDistances=opening,visited=nodes,regions=regions,canonical=canonical(board,n)))
        print(chapter+1,'attempts',attempts,'optimal',[min(t[0] for t in candidates),max(t[0] for t in candidates)],'max states',max(t[1] for t in candidates))
    return levels,proofs
levels,proofs=generate()
outputs={ROOT/'src/games/floodLevels.ts':'// Original Playgarden campaign. Regenerate: python3 scripts/flood/generate.py\nimport type { FloodLevel } from "./floodLogic";\nexport const floodLevels: FloodLevel[] = '+json.dumps(levels,ensure_ascii=False,separators=(',',':'))+';\n',ROOT/'docs/flood/campaign.json':json.dumps({'generator':'flood-original-901007-v1','levels':proofs},ensure_ascii=False,indent=2)+'\n'}
for path,data in outputs.items():
    if '--check' in sys.argv:
        assert path.read_text()==data,path
    else:path.write_text(data)
print('Verified' if '--check' in sys.argv else 'Wrote',len(levels),'nonisomorphic boards and exact certificates')
