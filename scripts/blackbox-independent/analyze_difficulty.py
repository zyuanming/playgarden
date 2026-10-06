"""Exhaustive deterministic expected-remaining-probe decision-tree statistics."""
import json
from collections import Counter,defaultdict
from pathlib import Path
from oracle import Universe,d4_canonical


def decision_tree(u):
    """Return per-layout evidence paths without running a solver per target."""
    paths={}
    def visit(ids,path):
        if len({u.signatures[i] for i in ids})==1:
            for i in ids: paths[i]=path
            return
        choice=u.best_probe({},ids)
        assert choice is not None
        p=choice['port']
        bins=defaultdict(list)
        for i in ids: bins[u.signatures[i][p]].append(i)
        for result,subset in bins.items():
            visit(tuple(subset),path+[{'port':p,'result':result,'candidates':len(subset)}])
    visit(tuple(range(len(u.layouts))),[])
    return paths


def report(n,k):
    u=Universe(n,k)
    paths=decision_tree(u)
    all_counts=Counter()
    unique_counts=Counter()
    canonical_counts=Counter()
    examples={}
    for i,cells in enumerate(u.layouts):
        depth=len(paths[i]);all_counts[depth]+=1
        if len(u.groups[u.signatures[i]]) != 1: continue
        unique_counts[depth]+=1
        if cells==d4_canonical(n,cells):
            canonical_counts[depth]+=1
            examples.setdefault(depth,{'atoms':cells,'signature':u.signatures[i],'probeTrace':paths[i]})
    return {'size':n,'starCount':k,'allGreedyProbeCounts':dict(sorted(all_counts.items())),
            'uniqueGreedyProbeCounts':dict(sorted(unique_counts.items())),
            'canonicalUniqueGreedyProbeCounts':dict(sorted(canonical_counts.items())),
            'canonicalExampleByDepth':examples}


if __name__=='__main__':
    output=[]
    for n,k in [(3,1),(3,2),(3,3),(4,1),(4,2),(4,3),(4,4),(5,1),(5,2),(5,3),(5,4)]:
        r=report(n,k);output.append(r)
        print(json.dumps({key:value for key,value in r.items() if key!='canonicalExampleByDepth'}),flush=True)
    Path(__file__).with_name('difficulty-report.json').write_text(json.dumps(output,indent=2)+'\n')
