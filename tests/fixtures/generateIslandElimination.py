"""Original MIT deterministic level authoring and independent uniqueness certificates.
No production imports. Hitori uses row masks; Nurikabe enumerates connected island sets.
Run python3 tests/fixtures/generateIslandElimination.py to reproduce the authored set.
"""
import json, random
from pathlib import Path
R=random.Random(2026100417)
ROOT=Path(__file__).resolve().parents[2]
def adj(n,i):
 return [j for j in [i-n,i+n,i-1,i+1] if 0<=j<n*n and abs(i//n-j//n)+abs(i%n-j%n)==1]
def groups(n,cells):
 rest=set(cells); out=[]
 while rest:
  todo=[rest.pop()]; g=set(todo)
  while todo:
   for j in adj(n,todo.pop()):
    if j in rest: rest.remove(j);g.add(j);todo.append(j)
  out.append(g)
 return out
def sea_ok(n,sea):
 return bool(sea) and len(groups(n,sea))==1 and not any({i,i+1,i+n,i+n+1}<=sea for i in range(n*n) if i//n<n-1 and i%n<n-1)
def hitori(n,nums):
 rows=[]
 for y in range(n):
  masks=[]
  for mask in range(1<<n):
   vals=[nums[y*n+x] for x in range(n) if not mask>>x&1]
   if not(mask&(mask<<1)) and len(set(vals))==len(vals):masks.append(mask)
  rows.append(masks)
 sols=[];nodes=0
 def rec(y,chosen,cols):
  nonlocal nodes
  nodes+=1
  if nodes>200000:raise RuntimeError('Hitori certificate budget')
  if len(sols)>1:return
  if y==n:
   white={i for i in range(n*n) if not chosen[i//n]>>(i%n)&1}
   if white and len(groups(n,white))==1:sols.append([int(i not in white) for i in range(n*n)])
   return
  for mask in rows[y]:
   if y and mask&chosen[-1]:continue
   if any(not mask>>x&1 and nums[y*n+x] in cols[x] for x in range(n)):continue
   rec(y+1,chosen+[mask],[cols[x]|({nums[y*n+x]} if not mask>>x&1 else set()) for x in range(n)])
 rec(0,[],[set() for _ in range(n)])
 return sols,nodes

def nurikabe(n,clues):
 seeds={c['index'] for c in clues};opts=[]
 for c in clues:
  sets={frozenset([c['index']])}
  for _ in range(c['area']-1):
   sets={s|{j} for s in sets for i in s for j in adj(n,i) if j not in s and j not in seeds and not any(k in seeds-{c['index']} for k in adj(n,j))}
  opts.append(list(sets))
 order=sorted(range(len(clues)),key=lambda k:len(opts[k]));sols=[];nodes=0
 def rec(d,land,halo):
  nonlocal nodes
  nodes+=1
  if nodes>200000:raise RuntimeError('Nurikabe certificate budget')
  if len(sols)>1:return
  if d==len(order):
   sea=set(range(n*n))-land
   if sea_ok(n,sea):sols.append([int(i in sea) for i in range(n*n)])
   return
  for option in opts[order[d]]:
   if option&halo:continue
   rec(d+1,land|option,halo|option|{j for i in option for j in adj(n,i)})
 rec(0,set(),set())
 return sols,nodes

hlevels=[];hcert=[]
for n,want in [(3,2),(4,3),(5,4),(6,3)]:
 found=0;tries=0
 while found<want:
  tries+=1
  vals=list(range(1,n+1));R.shuffle(vals);rows=list(range(n));cols=list(range(n));R.shuffle(rows);R.shuffle(cols)
  nums=[vals[(rows[i//n]+cols[i%n])%n] for i in range(n*n)]
  black=set()
  for i in R.sample(range(n*n),n*n):
   if R.random()<.36 and not any(j in black for j in adj(n,i)):
    trial=black|{i}
    if len(groups(n,set(range(n*n))-trial))==1:black=trial
  if len(black)<n-1:continue
  for i in black:
   candidates=[nums[j] for j in range(n*n) if j not in black and (j//n==i//n or j%n==i%n)]
   nums[i]=R.choice(candidates)
  sol,nodes=hitori(n,nums)
  if len(sol)!=1:continue
  if any(l['numbers']==nums for l in hlevels):continue
  hlevels.append({'size':n,'numbers':nums});hcert.append({'board':sol[0],'nodes':nodes});found+=1
 print('Hitori',n,'attempts',tries,flush=True)

nlevels=[];ncert=[]
for n,want in [(3,2),(4,3),(5,4),(6,3)]:
 found=0;tries=0
 while found<want:
  tries+=1
  sea={R.randrange(n*n)}
  for _ in range(n*n*2):
   frontier=list({j for i in sea for j in adj(n,i)}-sea)
   R.shuffle(frontier)
   for j in frontier:
    trial=sea|{j}
    if not any({i,i+1,i+n,i+n+1}<=trial for i in range(n*n) if i//n<n-1 and i%n<n-1):
     sea=trial;break
   if len(sea)>=round(n*n*R.uniform(.45,.57)):break
  islands=groups(n,set(range(n*n))-sea)
  if not 2<=len(islands)<=max(3,n+1) or max(map(len,islands))>min(n,6):continue
  if sum(len(s)>1 for s in islands)<(1 if n<5 else 2):continue
  clues=sorted([{'index':R.choice(sorted(s)),'area':len(s)} for s in islands],key=lambda c:c['index'])
  try:sol,nodes=nurikabe(n,clues)
  except RuntimeError:continue
  if len(sol)!=1:continue
  if any(l['clues']==clues for l in nlevels):continue
  nlevels.append({'size':n,'clues':clues});ncert.append({'board':sol[0],'nodes':nodes});found+=1
 print('Nurikabe',n,'attempts',tries,flush=True)

htitles=['溪边初识','双影留白','竹影相间','数列岔路','石径回环','晨雾庭院','青瓦小巷','花窗寻踪','林间回声','暮色山路','星光长廊','留白之境']
ntitles=['两座小岛','潮间漫步','浅湾灯塔','沙洲相望','海湾分界','远帆小港','碧海回廊','群岛信风','潮汐花园','珊瑚迷航','海图深处','群岛之心']
for levels,titles in [(hlevels,htitles),(nlevels,ntitles)]:
 for i,l in enumerate(levels):l['title']=titles[i]
(ROOT/'src/games/hitoriLevels.ts').write_text('/** Original MIT levels. Authored with a fixed seed; independently certified in tests. */\nexport type HitoriLevel = { title: string; size: number; numbers: number[] };\nexport const hitoriLevels: HitoriLevel[] = '+json.dumps(hlevels,ensure_ascii=False,indent=2)+';\n')
(ROOT/'src/games/nurikabeLevels.ts').write_text('/** Original MIT levels. Authored with a fixed seed; independently certified in tests. */\nexport type NurikabeLevel = { title: string; size: number; clues: { index: number; area: number }[] };\nexport const nurikabeLevels: NurikabeLevel[] = '+json.dumps(nlevels,ensure_ascii=False,indent=2)+';\n')
(ROOT/'tests/fixtures/islandEliminationCertificates.ts').write_text('/** Independent row-mask / connected-island certificates, generated without production code. */\nexport const hitoriCertificates = '+json.dumps(hcert,indent=2)+';\nexport const nurikabeCertificates = '+json.dumps(ncert,indent=2)+';\n')
