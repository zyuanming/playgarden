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
    # Preserve the complete seeded release as a prefix. Curated append input
    # is kept outside the runtime and independently re-solved here.
    append=json.loads(pathlib.Path(__file__).with_name('append-037-100.json').read_text())
    chapters=['灯线初织','交汇之光','扩建夜园','万灯归位']
    mask=lambda board: ''.join('.' if cell=='.' else '#' for cell in board)
    layouts={(p['size'],canonical(p['size'],mask(p['board']))) for p in levels}
    assert len(append)==64
    for i,p in enumerate(append):
        chapter=4+i//16
        n=6 if chapter<6 else 7
        board=p['board']
        assert len(board)==n*n and all(c in '.#01234' for c in board)
        key=(n,canonical(n,mask(board)))
        assert key not in layouts, f'Duplicate wall layout at level {len(levels)+1}'
        layouts.add(key)
        answers,_=solve(n,board)
        assert answers==[p['solution']], f'Wrong or ambiguous certificate at level {len(levels)+1}'
        levels.append(dict(id=f'akari-{len(levels)+1:03}',title=f'{chapters[chapter-4]} · {i%16+1}',chapter=chapter,size=n,board=board,solution=p['solution']))
    return dict(seed=9102026,levels=levels)

def runtime(levels):
    lines=['import type { AkariLevel } from "./akariLogic";','export const akariLevels: AkariLevel[] = [']
    for level in levels:
        lines.append('  {')
        for k,v in level.items():
            if k!='solution':
                lines.append(f'    {k}: {json.dumps(v,ensure_ascii=False)},')
        lines.append('  },')
    return '\n'.join([*lines,'];',''])

if __name__=='__main__':
    result=generate()
    outputs={
        ROOT/'docs/akari/campaign.json':json.dumps(result,ensure_ascii=False,indent=2)+'\n',
        ROOT/'src/games/akariLevels.ts':runtime(result['levels']),
    }
    for path,content in outputs.items():
        if '--check' in sys.argv: assert path.read_text()==content, f'Stale generated file: {path}'
        else: path.write_text(content)
    print('Verified',len(result['levels']),'unique Akari puzzles')
