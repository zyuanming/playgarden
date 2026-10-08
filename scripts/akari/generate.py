"""Original seeded Akari campaign. Exact binary constraint search, D4 dedup."""
import json, random, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
def topology(n,board):
    whites=[i for i,c in enumerate(board) if c=='.']; sight={}; adj={}
    for i in range(n*n):
        x,y=i%n,i//n
        adj[i]=[yy*n+xx for xx,yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)] if 0<=xx<n and 0<=yy<n and board[yy*n+xx]=='.']
        if i not in whites: continue
        ray={i}
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            xx,yy=x+dx,y+dy
            while 0<=xx<n and 0<=yy<n and board[yy*n+xx]=='.':
                ray.add(yy*n+xx); xx+=dx; yy+=dy
        sight[i]=ray
    return whites,sight,adj

def solve(n,board,limit=2):
    whites,sight,adj=topology(n,board); clues=[(adj[i],int(c)) for i,c in enumerate(board) if c.isdigit()]
    found=[]; nodes=0
    def rec(yes,no):
        nonlocal nodes
        nodes+=1
        if nodes>200000: raise RuntimeError('budget')
        while True:
            old=(len(yes),len(no))
            for p in yes:
                if (sight[p]-{p}) & yes: return
                no |= sight[p]-{p}
            if yes & no: return
            for cells,target in clues:
                got=len(set(cells)&yes); rest=set(cells)-yes-no
                if got>target or got+len(rest)<target:return
                if got==target:no|=rest
                elif got+len(rest)==target:yes|=rest
            for p in whites:
                if sight[p]&yes:continue
                can=sight[p]-no
                if not can:return
                if len(can)==1:yes|=can
            if yes & no:return
            if old==(len(yes),len(no)):break
        unknown=set(whites)-yes-no
        if not unknown:
            found.append(sorted(yes));return
        # Select a cell from the tightest unmet lighting/clue constraint.
        sets=[sight[p]-no for p in whites if not sight[p]&yes]
        sets += [set(a)-no-yes for a,k in clues if len(set(a)&yes)<k]
        choice=min((s for s in sets if s),key=len,default=unknown)
        p=max(choice,key=lambda p:len(sight[p]))
        rec(yes|{p},set(no))
        if len(found)<limit:rec(set(yes),no|{p})
    rec(set(),set()); return found,nodes

def canonical(n,b):
    variants=[]
    for flip in [False,True]:
        for turn in range(4):
            out=['']*(n*n)
            for i,c in enumerate(b):
                x,y=i%n,i//n
                if flip:x=n-1-x
                for _ in range(turn):x,y=n-1-y,x
                out[y*n+x]=c
            variants.append(''.join(out))
    return min(variants)

def generate():
    rng=random.Random(9102026); levels=[]; seen=set()
    for chapter,n in enumerate([4,5,6,7]):
        count=0
        while count<9:
            board=['#' if rng.random()<.29 else '.' for _ in range(n*n)]
            if board.count('.')<n*n*.55:continue
            try: answers,_=solve(n,board,1)
            except RuntimeError:continue
            if not answers or len(answers[0])<3:continue
            solution=set(answers[0]); whites,sight,adj=topology(n,board)
            for i,c in enumerate(board):
                if c=='#':board[i]=str(len(set(adj[i])&solution))
            try: answers,_=solve(n,board)
            except RuntimeError:continue
            if len(answers)!=1:continue
            walls=[i for i,c in enumerate(board) if c.isdigit()];rng.shuffle(walls)
            for i in walls:
                previous=board[i];board[i]='#'
                try: trial,_=solve(n,board)
                except RuntimeError:trial=[]
                if len(trial)!=1:board[i]=previous
            key=canonical(n,board)
            if key in seen:continue
            seen.add(key);count+=1
            levels.append(dict(id=f'akari-{len(levels)+1:03}',title=f'{["初见灯光","隔墙相望","交错光径","夜园全亮"][chapter]} · {count}',chapter=chapter,size=n,board=''.join(board),solution=sorted(solution)))
    return dict(seed=9102026,levels=levels)
if __name__=='__main__':
    result=generate(); path=ROOT/'docs/akari/campaign.json'; content=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if '--check' in sys.argv:assert path.read_text()==content
    else:
        path.write_text(content)
        public=[{k:v for k,v in p.items() if k!='solution'} for p in result['levels']]
        (ROOT/'src/games/akariLevels.ts').write_text('import type { AkariLevel } from "./akariLogic";\nexport const akariLevels: AkariLevel[] = '+json.dumps(public,ensure_ascii=False,indent=2)+';\n')
    print('Verified',len(result['levels']),'unique Akari puzzles')
