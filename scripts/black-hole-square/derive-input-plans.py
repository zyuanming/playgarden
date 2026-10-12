#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Operator plans from JSON data only. Never imports or executes upstream JS.

This independent settled-board model is a planning aid, not gameplay evidence.
Only the targeted browser journey can establish that real input clears a board.
"""
from pathlib import Path
import hashlib,json,time
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'third_party/black-hole-square/original/src/entities.json'
DEST=ROOT/'e2e/fixtures/black-hole-square-input-plans.json'
DIRECTIONS={4:-6,5:1,6:6,7:-1}
def activate(board,cell):
    tile=board[cell]
    if tile<3:return None
    out=list(board)
    if tile==3:out[cell]=0;return bytes(out)
    if tile==8:out[cell]=1;return bytes(out)
    step=DIRECTIONS[tile];line=[cell];end=cell
    while True:
        nxt=end+step
        if nxt<0 or nxt>=36 or (abs(step)==1 and nxt//6!=cell//6):return None
        if board[nxt]<2:break
        line.append(nxt);end=nxt
    out[cell]=0
    for old in line:
        target=old+step
        if board[target]!=1:out[target]=board[old]
    return bytes(out)
def moves(board):
    out=[]
    for cell,tile in enumerate(board):
        if tile>=3:
            after=activate(board,cell)
            if after is not None:out.append((cell,after))
    # Removing material and creating a hole are useful ordering only; every
    # valid successor still remains eligible, and the budget stays original.
    return sorted(out,key=lambda pair:(sum(t>=2 for t in pair[1]),sum(t==8 for t in pair[1]),pair[0]))
def plan(board,budget):
    failed={};nodes=0;started=time.monotonic()
    def visit(state,left):
        nonlocal nodes
        nodes+=1
        if nodes>2500000 or time.monotonic()-started>180:raise RuntimeError('Bounded planning budget reached')
        count=sum(tile>=2 for tile in state)
        if not count:return []
        if count>left or failed.get(state,-1)>=left:return None
        for cell,after in moves(state):
            path=visit(after,left-1)
            if path is not None:return [cell]+path
        failed[state]=left
        return None
    result=visit(bytes(board),budget)
    return result,nodes

def main():
    entities=json.loads(SOURCE.read_text());sequence=entities['game']['levels']['sequence']
    records=[]
    for index,name in enumerate(sequence[2:-1]):
        puzzle=entities[name]['puzzle'];grid=puzzle['grid'];budget=puzzle['taps']
        try:cells,nodes=plan(grid,budget)
        except RuntimeError as error:
            records.append({'level':index,'id':name,'status':'UNRESOLVED_STATIC_PLAN','reason':str(error),'initial':grid,'budget':budget})
            print(name,'UNRESOLVED',flush=True);continue
        if cells is None:raise RuntimeError('No source-data plan found: '+name)
        state=bytes(grid);checkpoints=[]
        for cell in cells:
            state=activate(state,cell);checkpoints.append(list(state))
        records.append({'level':index,'id':name,'status':'STATIC_OPERATOR_PLAN_NOT_RUNTIME_PASS','initial':grid,
            'budget':budget,'cells':cells,'checkpoints':checkpoints,'planningNodes':nodes})
        print(name,len(cells),'/',budget,'moves;',nodes,'planning nodes',flush=True)
    failure=[];state=bytes(entities['wait']['puzzle']['grid'])
    for cell in [8,9,27,21,15]:
        state=activate(state,cell);failure.append(list(state))
    payload={'status':'STATIC_DATA_ANALYSIS_ONLY_NOT_RUNTIME_PASS','upstreamCommit':'8d48aae2097613782ab18d5062e8a3906741baaa',
        'entitiesSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'method':'Independent settled-grid analysis of original JSON and documented activation rules. No engine imported or executed. Wait for actual animation settlement between inputs.',
        'levels':records,'failurePlan':{'level':1,'cells':[8,9,27,21,15],'checkpoints':failure,'expectedFeedback':'Out of moves!'}}
    DEST.write_text(json.dumps(payload,indent=2)+'\n')
    print('Wrote operator input plans; runtime status remains NOT_PERFORMED.',flush=True)
if __name__=='__main__':main()
