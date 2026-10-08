"""Original finite arrow-ray puzzles. No upstream generator or level data.
Generation is deterministic; certificates live outside the runtime payload.
"""
import random, json, pathlib, argparse, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
D=[(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1)]
def direction(a,b,w):
    x,y=b%w-a%w,b//w-a//w
    if x and y and abs(x)!=abs(y): return -1
    return D.index(((x>0)-(x<0),(y>0)-(y<0))) if x or y else -1
def rays(p):
    w,h=p['width'],p['height']; n=w*h
    return [[j for j in range(n) if i!=j and direction(i,j,w)==d] if d>=0 else [] for i,d in enumerate(p['arrows'])]
def solutions(p, limit=2, budget=500000):
    edges=rays(p); n=len(edges); clues=p['clues']; anchors={v:i for i,v in enumerate(clues) if v}; found=[]; nodes=0
    def visit(path,used):
        nonlocal nodes
        nodes+=1
        if nodes>budget: raise TimeoutError()
        if len(path)==n:
            found.append(path[:]); return
        k=len(path)+1
        for j in edges[path[-1]]:
            if used>>j&1 or (clues[j] and clues[j]!=k) or (k in anchors and anchors[k]!=j): continue
            visit(path+[j],used|1<<j)
            if len(found)>=limit:return
    visit([anchors[1]],1<<anchors[1]);return found,nodes

def canonical(p):
    w,h=p['width'],p['height']; forms=[]
    for swap in (False,True):
      for fx in (False,True):
       for fy in (False,True):
        nw,nh=(h,w) if swap else (w,h); a=[0]*(w*h); c=a.copy()
        for i,d in enumerate(p['arrows']):
            x,y=i%w,i//w; dx,dy=D[d] if d>=0 else (0,0)
            if swap:x,y,dx,dy=y,x,dy,dx
            if fx:x,dx=nw-1-x,-dx
            if fy:y,dy=nh-1-y,-dy
            j=y*nw+x;a[j]=D.index((dx,dy)) if d>=0 else -1;c[j]=p['clues'][i]
        forms.append(json.dumps([nw,nh,a,c],separators=(',',':')))
    return min(forms)
def make_path(w,h,rng):
    n=w*h; edges=[[j for j in range(n) if direction(i,j,w)>=0] for i in range(n)]; calls=0
    def dfs(path,used):
        nonlocal calls
        calls+=1
        if calls>20000:return None
        if len(path)==n:return path
        opts=[j for j in edges[path[-1]] if j not in used];rng.shuffle(opts)
        opts.sort(key=lambda j:sum(k not in used for k in edges[j]))
        for j in opts:
            r=dfs(path+[j],used|{j})
            if r:return r
    s=rng.randrange(n);return dfs([s],{s})
def generate():
    rng=random.Random(940810); levels=[]; seen=set(); chapters=['顺着路标','远近之间','数字驿站','交错岔路','完整旅途']
    for chapter,(w,h,anchors) in enumerate([(3,3,3),(4,3,3),(4,4,4),(5,4,4),(5,5,5)]):
        batch=[];attempt=0
        while len(batch)<6:
            attempt+=1; path=make_path(w,h,rng)
            if not path:continue
            n=w*h;a=[-1]*n;c=[0]*n
            for k,i in enumerate(path):
                c[i]=k+1
                if k+1<n:a[i]=direction(i,path[k+1],w)
            p={'width':w,'height':h,'arrows':a,'clues':c}
            order=path[1:-1].copy();rng.shuffle(order)
            for i in order:
                if sum(v>0 for v in c)<=anchors:break
                old=c[i];c[i]=0
                try: sols,_=solutions(p)
                except TimeoutError:sols=[]
                if len(sols)!=1:c[i]=old
            if sum(v>0 for v in c)>anchors+1:continue
            sols,nodes=solutions(p)
            if len(sols)!=1:continue
            edges=rays(p); used=set();decisions=0;long=0;diag=0
            for k,i in enumerate(path[:-1]):
                used.add(i); opts=[j for j in edges[i] if j not in used and (not c[j] or c[j]==k+2)]
                decisions+=len(opts)>1
                j=path[k+1];long+=max(abs(i%w-j%w),abs(i//w-j//w))>1;diag+=i%w!=j%w and i//w!=j//w
            if decisions<max(2,chapter+1) or long<2 or diag<2:continue
            key=canonical(p)
            if key in seen:continue
            seen.add(key);batch.append((nodes,p,path,{'nodes':nodes,'choicePoints':decisions,'longJumps':long,'diagonals':diag,'canonicalSha256':hashlib.sha256(key.encode()).hexdigest()}))
        batch.sort(key=lambda x:x[0])
        for j,(_,p,path,metrics) in enumerate(batch):
            idx=len(levels)+1
            levels.append({'id':f'signpost-{idx:02}','title':f'{chapters[chapter]} · {j+1}','chapter':chapter,**p,'solution':path,'metrics':metrics})
    return levels

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args();levels=generate()
    corpus=json.dumps({'origin':'Playgarden original deterministic campaign; not upstream levels','seed':940810,'levels':levels},ensure_ascii=False,indent=2)+'\n'
    runtime='// Original campaign. Certificates are deliberately outside the runtime bundle.\nimport type { SignpostLevel } from "./signpostLogic";\nexport const signpostLevels: SignpostLevel[] = '+json.dumps([{k:v for k,v in p.items() if k not in ('solution','metrics')} for p in levels],ensure_ascii=False,indent=2)+';\n'
    for file,data in [('docs/signpost/campaign.json',corpus),('src/games/signpostLevels.ts',runtime)]:
        dest=ROOT/file
        if args.check:assert dest.read_text()==data,file+' differs'
        else:dest.write_text(data)
    print(json.dumps({'levels':len(levels),'sizes':sorted({str((p['width'],p['height'])) for p in levels}),'maxNodes':max(p['metrics']['nodes'] for p in levels),'minChoicePoints':min(p['metrics']['choicePoints'] for p in levels)}))
if __name__=='__main__':main()
