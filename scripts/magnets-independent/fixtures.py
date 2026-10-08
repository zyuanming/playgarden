#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Tiny full-enumeration oracles for differential runtime checking."""
import json, random
from itertools import product
from oracle import brute,direct

def tilings(w,h):
    def go(left,pairs):
        if not left:
            yield pairs;return
        a=min(left)
        for b in (a+1,a+w):
            if b in left and abs(a//w-b//w)+abs(a%w-b%w)==1:
                yield from go(left-{a,b},pairs+[[a,b]])
    return list(go(set(range(w*h)),[]))

def fixtures():
    rng=random.Random(931971)
    cases=[]
    for w,h in [(2,2),(3,2),(4,2)]:
        for pairs in tilings(w,h):
            base={'id':f'fixture-{len(cases)}','title':'Independent fixture','chapter':0,'width':w,'height':h,'dominoes':pairs,
                  'rowPlus':[-1]*h,'rowMinus':[-1]*h,'colPlus':[-1]*w,'colMinus':[-1]*w}
            cases.append(base)
            # Random literal clues can be inconsistent; zero, maximum and omitted are all covered.
            for _ in range(4):
                p={**base,'id':f'fixture-{len(cases)}'}
                for name in ['rowPlus','rowMinus','colPlus','colMinus']:
                    length=h if name.startswith('row') else w
                    span=w if name.startswith('row') else h
                    p[name]=[rng.choice([-1,0,1,span]) for i in range(length)]
                cases.append(p)
    # Every finite/omitted quota in every line position on both 2x2 tilings.
    for pairs in tilings(2,2):
        for name in ['rowPlus','rowMinus','colPlus','colMinus']:
            for pos in range(2):
                for value in [-1,0,1,2]:
                    p={'id':f'fixture-{len(cases)}','title':'Single quota','chapter':0,'width':2,'height':2,'dominoes':pairs,
                       'rowPlus':[-1]*2,'rowMinus':[-1]*2,'colPlus':[-1]*2,'colMinus':[-1]*2}
                    p[name][pos]=value;cases.append(p)
    return cases

if __name__=='__main__':
    output=[]
    for p in fixtures():
        solutions=brute(p);states=[]
        for s in product([-1,0,1,2],repeat=len(p['dominoes'])):
            state=list(s)
            compatible=any(all(a==-1 or a==b for a,b in zip(state,sol)) for sol in solutions)
            states.append({'state':state,'expected':direct(p,state),'solvable':compatible})
        output.append({'puzzle':p,'solutionCount':len(solutions),'cases':states})
    print(json.dumps(output,separators=(',',':')))
