#!/usr/bin/env python3
"""Bounded first-path input preparation. Reads map literals only; never imports game code.
Not an engine/runtime test, proof of campaign solvability, or shortest-path claim.
"""
import argparse, heapq, itertools, json, pathlib, time

ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = ROOT.parent/'original/src/leveldata.ts'
DIRECTIONS = [('R',1,0),('U',0,-1),('L',-1,0),('D',0,1)]
SOLID = {1,11}
SPECIAL = {6,9,17}


def boards():
    source = SOURCE.read_text()
    return json.loads(source[source.index('=')+1:].strip().removesuffix(';'))


def unpack(packed, level):
    w,h = int(packed[0])+2,int(packed[1])+2
    b = [1]*(w*h); rocks=[]; p=None
    for i,c in enumerate(packed[2:]):
        at=(i//(w-2)+1)*w+i%(w-2)+1
        v=int(c,32)
        if v == 2: p=at; b[at]=0
        elif v == 3: rocks.append(at); b[at]=0
        else: b[at]=v
    assert p is not None
    return w,h,(p,0 if level==13 else 13,bytes(b),tuple(sorted(rocks)))


def advance(state, action, w):
    """Independent discrete movement model of one short input and resulting conveyors.
    State excludes animation, rendering, audio, orientation and undo history.
    Never used to mutate the live game: browser assertions must independently agree.
    """
    p,turns,bottom,rocks=state
    b=list(bottom); pieces=[p,*rocks]
    seen=set()
    for cycle in range(96):
        stamp=(tuple(pieces),turns,bytes(b))
        if stamp in seen:return None
        seen.add(stamp)
        occupancy={p:i for i,p in enumerate(pieces) if p is not None}
        moves={}; auto={}
        # Original redraw orders objects by y. Repeated control passes permit a
        # pushed boulder to vacate its old square before the player starts moving.
        order=sorted(range(len(pieces)),key=lambda i:pieces[i]//w if pieces[i] is not None else -1)
        changed=True
        while changed:
            changed=False
            for i in order:
                old=pieces[i]
                if old is None or i in moves:continue
                tile=b[old]
                arrow=tile-13 if 13<=tile<=16 and (i!=0 or turns>0) else None
                options=[(arrow,True),(action,False)] if arrow is not None else [(action,False)]
                for direction,is_auto in options:
                    if direction is None:continue
                    _,dx,dy=DIRECTIONS[direction]; dest=old+dx+dy*w
                    if not is_auto and i!=0 and (turns<=0 or occupancy.get(old-dx-dy*w)!=0):continue
                    ignore_special=i!=0 or turns<=0 or (is_auto and b[dest]!=4)
                    if dest in occupancy or b[dest] in SOLID or (not ignore_special and b[dest]==4) or (ignore_special and b[dest] in SPECIAL):continue
                    # Simultaneous movement into one target is not modeled as a
                    # viable trace; reject it rather than assume an object order.
                    if dest in moves.values():return None
                    moves[i]=dest;auto[i]=is_auto;occupancy.pop(old,None)
                    if i==0:
                        if turns>0 and b[old]==5:b[old]=4
                        elif turns<=0 and b[old]==0:b[old]=6
                    changed=True
                    break
        if not moves:
            result=(pieces[0],turns,bytes(b),tuple(sorted(x for x in pieces[1:] if x is not None)))
            return None if result==state else result
        for i,dest in moves.items():pieces[i]=dest
        # First remove boulders that filled holes, then apply player contacts.
        for i in range(1,len(pieces)):
            q=pieces[i]
            if q is not None and b[q]==4:b[q]=0;pieces[i]=None
        occupied={x for x in pieces if x is not None}
        def contact():
            nonlocal turns
            q=pieces[0];tile=b[q]
            if turns>0 and tile in SPECIAL:
                b[q]=0 if tile==6 else tile+1
                pairs={11:12,12:11} if tile==9 else ({13:15,15:13,14:16,16:14} if tile==17 else {})
                for at,v in enumerate(b):
                    if at not in occupied and v in pairs:b[at]=pairs[v]
            elif turns<=0 and tile==7:b[q]=0
            elif turns<=0 and tile==8:b[q]=0;turns=14
        contact()
        old=turns
        if 0 in moves and not auto[0]:turns=max(0,turns-1)
        if old>0 and turns==0:contact()
        # The native engine checks victory after each movement batch.
        if 7 not in b:return (pieces[0],turns,bytes(b),tuple(sorted(x for x in pieces[1:] if x is not None)))
        action=None
    return None


def heuristic(state,w):
    p,t,b,_=state
    coins=[i for i,v in enumerate(b) if v==7]
    if not coins:return 0
    def d(a,b):return abs(a%w-b%w)+abs(a//w-b//w)
    # Prim tree ignores walls and transformations; it guides first-path planning
    # without claiming admissibility/optimality under conveyor rules.
    tree=0; connected=[p];pending=set(coins)
    while pending:
        length,a=min((min(d(a,c) for c in connected),a) for a in pending)
        tree+=length;connected.append(a);pending.remove(a)
    return tree+max(0,t)


def solve(packed,level,max_nodes,seconds):
    w,h,initial=unpack(packed,level)
    serial=itertools.count();heap=[(heuristic(initial,w)*3,0,next(serial),initial)]
    previous={initial:None};best={initial:0};expanded=0;start=time.monotonic()
    while heap and expanded<max_nodes and time.monotonic()-start<seconds:
        _,g,_,s=heapq.heappop(heap)
        if g!=best[s]:continue
        if 7 not in s[2]:
            states=[];moves=[];cur=s
            while previous[cur] is not None:
                states.append(cur);old,action=previous[cur];moves.append(DIRECTIONS[action][0]);cur=old
            moves.reverse();states.reverse()
            def checkpoint(s):return {'x':s[0]%w,'y':s[0]//w,'turnsLeft':s[1],'coins':s[2].count(7),'bottom':list(s[2]),'rocks':list(s[3])}
            return {'level':level,'status':'planned-not-runtime-verified','inputs':''.join(moves),'width':w,'height':h,'expanded':expanded,'planningSeconds':round(time.monotonic()-start,3),'initial':checkpoint(initial),'checkpoints':[checkpoint(s) for s in states]}
        expanded+=1
        for a in range(4):
            nxt=advance(s,a,w)
            if nxt is None:continue
            cost=g+1
            if cost>=best.get(nxt,10**9):continue
            best[nxt]=cost;previous[nxt]=(s,a)
            heapq.heappush(heap,(cost+3*heuristic(nxt,w),cost,next(serial),nxt))
    return {'level':level,'status':'unresolved','expanded':expanded,'queued':len(heap),'planningSeconds':round(time.monotonic()-start,3),'limits':{'nodes':max_nodes,'seconds':seconds}}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('levels',nargs='+',type=int);parser.add_argument('--nodes',type=int,default=250000);parser.add_argument('--seconds',type=float,default=20)
    args=parser.parse_args(); data=boards()
    out=ROOT/'planned-traces';out.mkdir(exist_ok=True)
    for n in args.levels:
        assert 1<=n<=13
        result=solve(data[n-1],n,args.nodes,args.seconds)
        (out/f'level-{n:02}.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps({k:v for k,v in result.items() if k not in ('initial','checkpoints')}),flush=True)

if __name__=='__main__':main()
