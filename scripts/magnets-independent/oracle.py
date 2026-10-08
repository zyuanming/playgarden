#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Independent cell-binary MILP oracle. Never imports author generator/runtime.

There are two binary variables per cell, indicating positive and negative.
A neutral cell sets both to zero. Domino endpoints exchange the two indicators.
HiGHS searches this linear integer model; an exclusion inequality proves uniqueness.
"""
from itertools import product


def cells_of(p, state):
    cells = [-1] * (p['width'] * p['height'])
    for (a, b), value in zip(p['dominoes'], state):
        cells[a] = value
        cells[b] = {-1: -1, 0: 0, 1: 2, 2: 1}[value]
    return cells


def direct(p, state):
    """Literal grid rule evaluator, including deliberately permissive partial bounds."""
    c = cells_of(p, state)
    w, h = p['width'], p['height']
    bad = set()
    def line(ids, sign, target):
        count = sum(c[i] == sign for i in ids)
        possible = count + sum(c[i] == -1 for i in ids)
        impossible = target != -1 and not count <= target <= possible
        if impossible:
            bad.update(ids)
        return dict(count=count, target=target, impossible=impossible,
                    exact=target == -1 or count == target)
    rows = [[line(list(range(y*w,(y+1)*w)), sign, p[key][y])
             for sign,key in ((1,'rowPlus'),(2,'rowMinus'))] for y in range(h)]
    cols = [[line(list(range(x,w*h,w)), sign, p[key][x])
             for sign,key in ((1,'colPlus'),(2,'colMinus'))] for x in range(w)]
    for i in range(w*h):
        for j in range(i+1,w*h):
            if abs(i//w-j//w)+abs(i%w-j%w) == 1 and c[i] in (1,2) and c[i] == c[j]:
                bad.update((i,j))
    missing=state.count(-1)
    return dict(cells=c, rows=rows, cols=cols, conflicts=sorted(bad), missing=missing,
                won=missing == 0 and not bad and all(v['exact'] for row in rows+cols for v in row))


def solve_integer(p, limit=2, initial=None):
    # Optional proof dependency. Literal evaluation/runtime fixtures use stdlib only.
    import numpy as np
    from scipy.optimize import milp, Bounds, LinearConstraint
    from scipy.sparse import lil_matrix
    n=p['width']*p['height']; w=p['width']; h=p['height']
    constraints=[]
    def add(terms, low=-np.inf, high=np.inf):
        constraints.append((terms,low,high))
    for i in range(n):
        add({2*i:1,2*i+1:1}, high=1)
    for a,b in p['dominoes']:
        add({2*a:1,2*b+1:-1},0,0)
        add({2*a+1:1,2*b:-1},0,0)
    for i in range(n):
        for j in range(i+1,n):
            if abs(i//w-j//w)+abs(i%w-j%w)==1:
                for sign in (0,1): add({2*i+sign:1,2*j+sign:1},high=1)
    for axis, size, length, names in [('row',h,w,('rowPlus','rowMinus')),('col',w,h,('colPlus','colMinus'))]:
        for r in range(size):
            ids=[r*w+c if axis=='row' else c*w+r for c in range(length)]
            for sign,name in enumerate(names):
                if p[name][r]>=0: add({2*i+sign:1 for i in ids},p[name][r],p[name][r])
    if initial is not None:
        for d,value in enumerate(initial):
            if value == -1: continue
            a=p['dominoes'][d][0]
            for sign in range(2): add({2*a+sign:1},int(value==sign+1),int(value==sign+1))
    solutions=[]; total_nodes=0
    while len(solutions)<limit:
        a=lil_matrix((len(constraints),2*n)); lo=[]; hi=[]
        for row,(terms,l,u) in enumerate(constraints):
            for col,value in terms.items(): a[row,col]=value
            lo.append(l); hi.append(u)
        result=milp(np.zeros(2*n),integrality=np.ones(2*n),bounds=Bounds(0,1),
                    constraints=LinearConstraint(a.tocsr(),np.array(lo),np.array(hi)),
                    options={'time_limit':60,'mip_rel_gap':0})
        if result.status==2: return solutions,True,total_nodes
        if result.status!=0: raise RuntimeError(f"HiGHS status {result.status}: {result.message}")
        total_nodes+=getattr(result,'mip_node_count',0)
        bits=[int(round(x)) for x in result.x]
        assert all(abs(x-y)<1e-7 for x,y in zip(result.x,bits))
        state=[bits[2*a]+2*bits[2*a+1] for a,b in p['dominoes']]
        assert direct(p,state)['won'], ('MILP result failed literal rules',p['id'],state)
        assert state not in solutions
        solutions.append(state)
        # Hamming distance from this entire cell-pole indicator vector >= 1.
        add({i:1 if bit else -1 for i,bit in enumerate(bits)},high=sum(bits)-1)
    return solutions,False,total_nodes


def brute(p):
    return [list(s) for s in product(range(3),repeat=len(p['dominoes'])) if direct(p,list(s))['won']]
