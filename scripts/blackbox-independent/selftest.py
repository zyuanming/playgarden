"""Independent selftests and a structurally separate padded-board ray model."""
from collections import Counter
from itertools import combinations
from pathlib import Path
import argparse
import json
import time
from oracle import RayCycle, Universe, d4_canonical, port_state, state_port, signature, trace


def padded_response(n, cells, port, internal=None):
    """Padded 1D cells, directional indices, sequential left/right turns.

    This model deliberately has no combined double-flank branch. It follows the
    published priority of repeated 90-degree checks, independently of trace().
    """
    stride = n+2
    padded = [False]*(stride*stride)
    for c in cells:
        padded[(c//n+1)*stride+c%n+1] = True
    steps = (-stride, 1, stride, -1)  # north, east, south, west
    coords = (list(range(1,n+1)) + [y*stride+n+1 for y in range(1,n+1)] +
              [(n+1)*stride+x for x in range(1,n+1)] + [y*stride for y in range(1,n+1)])
    exits = {value:i for i,value in enumerate(coords)}
    position = coords[port]
    direction = (2,3,0,1)[port//n]
    front = position+steps[direction]
    if internal is None:
        if padded[front]:
            return -1
        if padded[front+steps[(direction-1)%4]] or padded[front+steps[(direction+1)%4]]:
            return -2
        position = front
    else:
        x,y,direction=internal
        position=(y+1)*stride+x+1
    visited=set()
    while True:
        if position in exits:
            return -2 if exits[position] == port else exits[position]
        state=position,direction
        if state in visited:
            raise RayCycle('Repeated interior padded state')
        visited.add(state)
        front=position+steps[direction]
        if padded[front]:
            return -1
        if padded[front+steps[(direction-1)%4]]:
            direction=(direction+1)%4
        elif padded[front+steps[(direction+1)%4]]:
            direction=(direction-1)%4
        else:
            position=front


def transform(n,x,y,t):
    if t//4:
        x=n-1-x
    for _ in range(t%4):
        x,y=n-1-y,x
    return x,y


def transform_cells(n,cells,t):
    return tuple(sorted(y*n+x for x,y in (transform(n,c%n,c//n,t) for c in cells)))


def transform_port(n,p,t):
    x,y,_,_=port_state(n,p)
    return state_port(n,*transform(n,x,y,t))


def basic_tests():
    for n in range(1,8):
        for p in range(4*n):
            x,y,dx,dy=port_state(n,p)
            assert state_port(n,x,y)==p
            assert 0<=x+dx<n and 0<=y+dy<n
    assert signature(3,[]) == (6,7,8,9,10,11,0,1,2,3,4,5)
    assert trace(3,[0,1],1).result == -1  # Head-on wins at entry.
    assert trace(3,[0],1).entry_reflection
    assert trace(3,[0,2],1).entry_reflection
    assert trace(3,[3,4],1).result == -1  # Head-on wins inside.
    assert trace(3,[3],1).result == 3
    assert trace(3,[5],1).result == 9
    dual=trace(3,[3,5],1)
    assert dual.result == -2 and dual.double_reflections == 1 and not dual.entry_reflection
    assert signature(3,[0,8]) == signature(3,[2,6])
    assert [0,8] != [2,6]
    # Published 8x8 manual diagram, checking all numbered/lettered terminals.
    manual=signature(8,[2,4,46,61])
    for p,result in {0:16,1:-2,2:-1,3:-2,16:0,17:25,19:-2,20:-2,
                     25:17,9:28,28:9,30:-1}.items():
        assert manual[p] == result, (p,manual[p],result)
    # An interior cycle exists but is unreachable from the perimeter: four
    # corner stars enclose the centre. Never silently classify a cycle as R.
    try:
        padded_response(3,[0,2,6,8],0,internal=(1,1,0))
    except RayCycle:
        pass
    else:
        raise AssertionError('Interior cycle detection failed')
    assert all(type(value)==int for value in signature(3,[0,2,6,8]))
    u=Universe(3,2)
    assert len(u.candidates({})) == 36
    target=signature(3,[0,8])
    full={p:r for p,r in enumerate(target)}
    ids=u.candidates(full)
    assert [u.layouts[i] for i in ids] == [(0,8),(2,6)]
    assert u.best_probe(full,ids) is None
    assert u.facts(ids) == {'contradiction':False,'stars':[],'empty':[1,3,4,5,7]}
    assert u.facts(())['contradiction']
    assert len(u.greedy_path(target)) > 0
    # Candidate filtering is by observations only; guesses do not appear in API.
    obs={0:target[0]}
    assert all(signature(3,u.layouts[i])[0] == target[0] for i in u.candidates(obs))
    for bad in [(-1,[],0),(3,[9],0),(3,[1,1],0),(3,[],12)]:
        try:
            trace(*bad)
        except ValueError:
            pass
        else:
            raise AssertionError(f'Bad input accepted: {bad}')


def exhaustive_tests(full=False):
    counts=Counter()
    scopes=[(n,k) for n in (3,4,5) for k in range(1,5)]
    if full:
        scopes=[(n,k) for n in (1,2,3,4) for k in range(n*n+1)]+[(5,k) for k in range(1,5)]
    for n,k in scopes:
        for cells in combinations(range(n*n),k):
            sig=signature(n,cells)
            counts['layouts']+=1
            for p,result in enumerate(sig):
                other=padded_response(n,cells,p)
                assert result==other,(n,cells,p,result,other)
                assert result<0 or sig[result]==p,(n,cells,p,result)
                counts['portsCompared']+=1
            # All eight transforms for all 3x3 boards; all transforms on a
            # deterministic sample of larger boards, so coverage stays cheap.
            if n<=3 or counts['layouts']%97==0:
                canonical=d4_canonical(n,cells)
                for t in range(8):
                    transformed=transform_cells(n,cells,t)
                    tsig=signature(n,transformed)
                    assert d4_canonical(n,transformed)==canonical
                    for p,result in enumerate(sig):
                        q=transform_port(n,p,t)
                        expected=result if result<0 else transform_port(n,result,t)
                        assert tsig[q]==expected,(n,cells,p,t)
                        counts['d4PortChecks']+=1
    return dict(counts)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--all-small-boards',action='store_true')
    parser.add_argument('--output')
    args=parser.parse_args()
    start=time.monotonic()
    basic_tests()
    counts=exhaustive_tests(args.all_small_boards)
    result={'status':'passed','seconds':round(time.monotonic()-start,3),
            'allSubsetsThroughSize':4 if args.all_small_boards else None,
            'fixedCountScope':'3x3,4x4,5x5; 1–4 stars',**counts,
            'reachableCycles':0,'modelDisagreements':0,'reciprocityFailures':0}
    if args.output:
        Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result),flush=True)
