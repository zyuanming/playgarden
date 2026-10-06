"""Exhaustively certify each Xiangqi puzzle's complete one-move solution set.

Does not import, invoke or reuse the product solver. All legal moves and replies
come from the independent geometric oracle in this directory.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from oracle import Position, coord, side, opposite


def certify_puzzle(puzzle):
    required=('id','title','chapter','fen','objective','solutions')
    if not all(k in puzzle for k in required):
        raise ValueError('missing puzzle fields')
    objective=puzzle['objective']
    if objective not in ('capture','evade','mate','stalemate'):
        raise ValueError('unknown objective')
    pos=Position.parse(puzzle['fen'])
    if pos.checked(opposite(pos.turn)):
        raise ValueError('side that just moved is in check')
    moves=pos.legal_moves()
    if not moves or pos.halfmove>=120:
        raise ValueError('puzzle already terminal')
    if objective=='evade' and not pos.checked():
        raise ValueError('evade puzzle is not initially in check')
    if objective=='capture':
        if not isinstance(puzzle.get('piece'),str) or len(puzzle['piece'])!=1 or puzzle['piece'] not in 'rncabpk':
            raise ValueError('invalid capture piece')
        target=coord(puzzle.get('target',''))
        victim=pos.board.get(target)
        if victim is None or side(victim)==pos.turn or victim.lower()=='k':
            raise ValueError('capture target is not an opposing capturable piece')
    entries=[]
    solutions=[]
    for move in moves:
        a,b=coord(move[:2]),coord(move[2:])
        moving,captured=pos.board[a],pos.board.get(b)
        child=pos.applied(move)
        replies=child.legal_moves()
        check=child.checked()
        if child.checked(pos.turn):
            raise AssertionError('oracle generated a self-check move')
        if objective=='capture':
            success=(move[2:]==puzzle['target'] and moving.lower()==puzzle['piece'] and captured is not None and side(captured)!=pos.turn)
        elif objective=='evade':
            success=pos.checked() and not child.checked(pos.turn)
        elif objective=='mate':
            success=check and not replies
        else:
            success=not check and not replies
        if success:solutions.append(move)
        entries.append({'move':move,'movingPiece':moving,'capturedPiece':captured,'afterFen':child.fen(),
                        'opponentInCheck':check,'opponentLegalReplies':replies,'meetsGoal':bool(success)})
    declared=puzzle['solutions']
    if not isinstance(declared,list) or not all(isinstance(m,str) for m in declared):
        raise ValueError('solutions must be a list of ICCS move strings')
    if len(declared)!=len(set(declared)):
        raise ValueError('duplicate declared solutions')
    if not solutions:
        raise ValueError('no legal move meets goal')
    if sorted(declared)!=solutions:
        raise ValueError(f"solution set mismatch: missing={sorted(set(solutions)-set(declared))}, extra={sorted(set(declared)-set(solutions))}; independently found={solutions}")
    return {'id':puzzle['id'],'title':puzzle['title'],'chapter':puzzle['chapter'],'fen':pos.fen(),'objective':objective,
            'initialInCheck':pos.checked(),'initialLegalMoves':moves,'independentSolutions':solutions,
            'declaredSolutions':sorted(declared),'allLegalMoveCertificates':entries}


def verify(data,expect_count=13):
    if not isinstance(data,list) or len(data)!=expect_count:
        raise ValueError(f'expected {expect_count} puzzles')
    if len({p['id'] for p in data})!=len(data):
        raise ValueError('duplicate puzzle ids')
    return [certify_puzzle(p) for p in data]


def self_test(data):
    mutations=[]
    first=data[0]
    for label,change in [
        ('missing solution',lambda p:p.update(solutions=[])),
        ('duplicate solution',lambda p:p.update(solutions=p['solutions']*2)),
        ('invented solution',lambda p:p.update(solutions=p['solutions']+['a0i9'])),
        ('wrong capture piece',lambda p:p.update(piece='n')),
        ('wrong capture target',lambda p:p.update(target='a5')),
        ('bad FEN',lambda p:p.update(fen='invalid')),
        ('false evade claim',lambda p:p.update(objective='evade')),
    ]:
        altered=copy.deepcopy(first)
        change(altered)
        try:certify_puzzle(altered)
        except (ValueError,AssertionError,TypeError):mutations.append({'name':label,'detected':True})
        else:raise AssertionError('campaign validator missed mutation: '+label)
    for label,original,change in [
        ('mate confused with stalemate',next(p for p in data if p['objective']=='mate'),lambda p:p.update(objective='stalemate')),
        ('stalemate confused with mate',next(p for p in data if p['objective']=='stalemate'),lambda p:p.update(objective='mate')),
        ('omitted alternative check evasion',next(p for p in data if p['objective']=='evade'),lambda p:p.update(solutions=p['solutions'][:1])),
    ]:
        altered=copy.deepcopy(original)
        change(altered)
        try:certify_puzzle(altered)
        except (ValueError,AssertionError,TypeError):mutations.append({'name':label,'detected':True})
        else:raise AssertionError('campaign validator missed mutation: '+label)
    return mutations


def main():
    args=argparse.ArgumentParser()
    args.add_argument('--repo',required=True,type=Path)
    args.add_argument('--output',required=True,type=Path)
    args.add_argument('--expect-count',type=int,default=13)
    args.add_argument('--self-test',action='store_true')
    ns=args.parse_args()
    source=ns.repo/'docs/xiangqi/corpus.json'
    raw=source.read_bytes()
    data=json.loads(raw)
    certificates=verify(data,ns.expect_count)
    report={'status':'PASS','source':str(source),'sourceSha256':hashlib.sha256(raw).hexdigest(),
            'oracleSha256':hashlib.sha256((Path(__file__).parent/'oracle.py').read_bytes()).hexdigest(),
            'puzzleCount':len(certificates),'legalMovesExamined':sum(len(c['initialLegalMoves']) for c in certificates),
            'completeSolutionCount':sum(len(c['independentSolutions']) for c in certificates),
            'chapterCounts':{str(ch):sum(c['chapter']==ch for c in certificates) for ch in sorted({c['chapter'] for c in certificates})},
            'objectiveCounts':{ob:sum(c['objective']==ob for c in certificates) for ob in sorted({c['objective'] for c in certificates})},
            'certificates':certificates}
    if ns.self_test:report['mutationSelfTests']=self_test(data)
    ns.output.parent.mkdir(parents=True,exist_ok=True)
    ns.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='certificates'},ensure_ascii=False,indent=2))
    print(json.dumps({c['id']:c['independentSolutions'] for c in certificates},ensure_ascii=False,indent=2))


if __name__=='__main__':main()
