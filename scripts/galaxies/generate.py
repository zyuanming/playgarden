# SPDX-License-Identifier: GPL-3.0-only
# Original deterministic symmetric-polyomino campaign generator and CSP checker.
import random, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
SEED=9202026

def adjacent(n,i):
 x,y=i%n,i//n
 return [b*n+a for a,b in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)) if 0<=a<n and 0<=b<n]
def opposite(n,c,i):
 x,y=c[0]-1-i%n,c[1]-1-i//n
 return y*n+x if 0<=x<n and 0<=y<n else -1

def core(n,c):
 return sorted(set(y*n+x for x in ((c[0]-1)//2,c[0]//2) for y in ((c[1]-1)//2,c[1]//2)))

def solve(n,cs,limit=2,budget=100000):
 domains=[set(range(len(cs))) for _ in range(n*n)]
 for g,c in enumerate(cs):
  for i in core(n,c):domains[i]={g}
 for i in range(n*n):
  domains[i]={g for g in domains[i] if opposite(n,cs[g],i)>=0}
 nodes=0; solutions=[]
 def search(ds):
  nonlocal nodes
  nodes+=1
  if nodes>budget:raise RuntimeError('budget')
  changed=True
  while changed:
   changed=False
   for g,c in enumerate(cs):
    start=core(n,c)[0]; seen={start}; todo=[start]
    if g not in ds[start]:return
    for i in todo:
     for j in adjacent(n,i):
      k=opposite(n,c,j)
      if j not in seen and k>=0 and g in ds[j] and g in ds[k]:seen.add(j);todo.append(j)
    for i in range(n*n):
     k=opposite(n,c,i)
     if g in ds[i] and (i not in seen or k<0 or g not in ds[k]):ds[i].remove(g);changed=True
   if any(not d for d in ds):return
   for i,d in enumerate(ds):
    if len(d)==1:
     g=next(iter(d));k=opposite(n,cs[g],i)
     if g not in ds[k]:return
     if len(ds[k])!=1:ds[k]={g};changed=True
  choices=[i for i,d in enumerate(ds) if len(d)>1]
  if not choices:
   solutions.append([next(iter(d)) for d in ds]);return
  i=min(choices,key=lambda i:len(ds[i]))
  for g in sorted(ds[i]):
   dd=[d.copy() for d in ds];dd[i]={g};search(dd)
   if len(solutions)>=limit:return
 search(domains)
 return solutions,nodes

def canonical(n,cs):
 variants=[]
 for mirror in range(2):
  for turn in range(4):
   points=[]
   for a,b in cs:
    x,y=(2*n-a if mirror else a),b
    for _ in range(turn):x,y=2*n-y,x
    points.append((x,y))
   variants.append(tuple(sorted(points)))
 return min(variants)

def generate():
 rng=random.Random(SEED); levels=[];seen=set()
 for chapter,n in enumerate((4,5,6,7)):
  found=[];attempt=0
  while len(found)<9:
   attempt+=1;free=set(range(n*n));regions=[];cs=[]
   while free:
    candidates=[]
    for y in range(1,2*n):
     for x in range(1,2*n):
      c=(x,y);cells=set(core(n,c))
      if not cells<=free:continue
      for _ in range(rng.randrange(1,7+chapter)):
       options=[]
       for i in cells:
        for j in adjacent(n,i):
         k=opposite(n,c,j)
         if k>=0 and j not in cells and {j,k}<=free:options.append({j,k})
       if not options:break
       cells|=rng.choice(options)
      # Prefer meaningful areas while retaining varied centres and irregular shapes.
      candidates.append((len(cells)*rng.uniform(.6,1.5),c,cells))
    _,c,cells=max(candidates)
    free-=cells;cs.append(c);regions.append(cells)
   if len(cs)<3 or len(cs)>n*2 or sum(len(r)==1 for r in regions)>max(1,n//2):continue
   if chapter>=1 and not any(len(r)!=(max(i%n for i in r)-min(i%n for i in r)+1)*(max(i//n for i in r)-min(i//n for i in r)+1) for r in regions):continue
   key=(n,canonical(n,cs))
   if key in seen:continue
   order=sorted(range(len(cs)),key=lambda g:(cs[g][1],cs[g][0]));cs=[cs[g] for g in order]
   try:solutions,nodes=solve(n,cs)
   except RuntimeError:continue
   if len(solutions)!=1:continue
   fixed={i for c in cs for i in core(n,c)}
   if n*n-len(fixed)<max(5,n*n//3):continue
   seen.add(key);found.append({'size':n,'centers':cs,'solution':solutions[0],'searchNodes':nodes,'editableCells':n*n-len(fixed)})
  found.sort(key=lambda p:(p['searchNodes'],p['editableCells'],len(p['centers'])))
  for p in found:
   p.update(id=f'galaxies-{len(levels)+1:03}',chapter=chapter,title=f'{["初识星心","双星之间","旋臂生长","群星成图"][chapter]} · {len(levels)%9+1}')
   levels.append(p)
  print(n,attempt,[p['searchNodes'] for p in found],file=sys.stderr)
 return {'seed':SEED,'levels':levels}
if __name__=='__main__':
 data=generate();cert=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
 runtime='// SPDX-License-Identifier: GPL-3.0-only\n// Original campaign. Solutions remain in offline certificates only.\nimport type { GalaxiesLevel } from "./galaxiesLogic";\nexport const galaxiesLevels: GalaxiesLevel[] = '+json.dumps([{k:v for k,v in p.items() if k not in ('solution','searchNodes','editableCells')} for p in data['levels']],ensure_ascii=False,indent=2)+';\n'
 for name,text in [('docs/galaxies/campaign.json',cert),('src/games/galaxiesLevels.ts',runtime)]:
  path=ROOT/name
  if '--check' in sys.argv:assert path.read_text()==text,name+' differs'
  else:path.write_text(text)
 print('36 unique, D4-distinct Galaxies puzzles verified')
