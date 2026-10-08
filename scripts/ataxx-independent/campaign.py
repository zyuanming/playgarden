"""Independently prove all campaign choices from boards and objectives only.

This verifier never reads author proof lines and never calls the TS solver.
"""
from functools import lru_cache
from collections import Counter
from pathlib import Path
import json
import time
from oracle import Position, actions, play, result, key

ROOT = Path(__file__).resolve().parents[2]


def read_levels():
    text=(ROOT/'src/games/ataxxLevels.ts').read_text()
    return json.loads(text.split('export const ataxxLevels:Lesson[] = ',1)[1].strip().removesuffix(';'))


def position(level):
    n=level['size']; cells=['#']*49
    for i,v in enumerate(level['board']):
        cells[i//n*7+i%n]={-1:'#',0:'.',1:'x',2:'o'}[v]
    return Position.read(cells)


def small_key(move,n):
    return key((move[0],*(i//7*n+i%7 for i in move[1:])))


def root_value(level,p,move):
    g=level['goal'];q=play(p,move)
    if g['kind']=='move':
        captured=p.o.bit_count()-q.o.bit_count()
        return 1 if move[0]!='p' and captured>=g['captures'] and (not g.get('mode') or (move[0]=='c')==(g['mode']=='clone')) else -1
    return None


def evaluator(level):
    """Return exhaustive finite-horizon minimax on independently generated moves."""
    goal=level['goal'];visits=0
    horizon=2 if goal['kind']=='hold' else 2*goal['turns']-1
    @lru_cache(maxsize=None)
    def value(q,remaining):
        nonlocal visits
        visits+=1
        if visits>1000000:raise RuntimeError('Independent proof exceeded 1,000,000 unique states')
        end=result(q)
        if end:
            return (100 if end=='x' else -100) if goal['kind']=='hold' else (1 if end=='x' else -1)
        if remaining==0:
            return q.x.bit_count()-goal['target']+0.5 if goal['kind']=='hold' else -1
        choices=[value(play(q,m),remaining-1) for m in actions(q)]
        return (max if q.turn=='x' else min)(choices)
    return value,horizon,lambda:visits


def signature(level):
    n=level['size'];variants=[]
    for reflect in [False,True]:
        for turns in range(4):
            b=[None]*(n*n)
            for i,v in enumerate(level['board']):
                r,c=divmod(i,n)
                if reflect:c=n-1-c
                for _ in range(turns):r,c=c,n-1-r
                b[r*n+c]=v
            variants.append(tuple(b))
    return n,min(variants)


def prove(level):
    p=position(level); ms=actions(p);g=level['goal'];assert p.x and p.o and result(p) is None
    assert len(level['board'])==level['size']**2
    if g['kind']=='move':
        values={small_key(m,level['size']):root_value(level,p,m) for m in ms};visits=len(ms)
        minimal=None;path=[]
    else:
        value,horizon,count=evaluator(level)
        values={small_key(m,level['size']):value(play(p,m),horizon-1) for m in ms}
        # Produce an independent adversarial witness, not an author line.
        q=p;remaining=horizon;path=[]
        while remaining and result(q) is None:
            opts=actions(q); chooser=max if q.turn=='x' else min
            m=chooser(opts,key=lambda m:value(play(q,m),remaining-1))
            path.append(small_key(m,level['size']));q=play(q,m);remaining-=1
        visits=count();minimal=None
        if g['kind']=='win':
            minimal=next((turns for turns in range(1,g['turns']+1) if value(p,2*turns-1)>0),None)
    winning=[m for m,v in values.items() if v>0]
    assert winning,level['id']+' is not force-solvable'
    return {'id':level['id'],'goal':g,'legalChoices':len(ms),'winningChoices':len(winning),'winningActions':winning,'actionValues':values,'minimumWinningTurns':minimal,'adversarialLine':path,'uniqueProofStates':visits}


def main():
    start=time.monotonic();levels=read_levels();assert len(levels)==30
    assert len({l['id'] for l in levels})==30
    groups={}
    for l in levels:groups.setdefault(signature(l),[]).append(l['id'])
    duplicate=[g for g in groups.values() if len(g)>1]
    assert not duplicate,duplicate
    results=[]
    for l in levels:
        answer=prove(l);results.append(answer)
        print(l['id'],answer['winningChoices'],'/',answer['legalChoices'],'choices,',answer['uniqueProofStates'],'states',flush=True)
    report={'status':'PASS','method':'Independent Python 49-bit exhaustive finite-horizon minimax; only initial boards and goal declarations read from product; no author solver or proofs used','count':len(levels),'chapters':dict(sorted(Counter(l['chapter'] for l in levels).items())),'objectiveKinds':dict(Counter(l['goal']['kind'] for l in levels)),'d4Distinct':len(groups),'symmetryDuplicates':duplicate,'positionsWithAlternatives':sum(r['winningChoices']>1 for r in results),'allChoicesAcceptable': [r['id'] for r in results if r['winningChoices']==r['legalChoices']],'proofStates':sum(r['uniqueProofStates'] for r in results),'elapsedSeconds':round(time.monotonic()-start,3),'levels':results}
    (ROOT/'docs/ataxx/independent-campaign.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('PASS',report['count'],'levels;',report['proofStates'],'proof states;',report['elapsedSeconds'],'seconds')

if __name__=='__main__':main()
