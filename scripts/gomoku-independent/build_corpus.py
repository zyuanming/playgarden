"""Original curated exercises, rendered into legal chronological histories."""
import json
from pathlib import Path
from oracle import *
ROOT = Path(__file__).resolve().parents[2] / "docs" / "gomoku"

def p(r,c): return r*15+c

def line(r,c,dr,dc,n): return [(r+dr*k,c+dc*k) for k in range(n)]

SPECS = [
 dict(id='win-edge',title='沿着边线连起来',chapter=1,objective='win',
      own=line(0,0,0,1,4),opp=[],solution=(0,4),
      goal='在棋盘上沿找到一手成五的落点。',hint='从左上角沿着已有的四颗棋子向右数一格。',concepts=['棋盘边缘','连续四子']),
 dict(id='win-vertical-gap',title='补上竖线的空位',chapter=1,objective='win',
      own=[(4,7),(5,7),(7,7),(8,7)],opp=[],solution=(6,7),
      goal='补上一颗棋子，让竖线连成五子。',hint='两颗与两颗之间的空位，也是一条线的一部分。',concepts=['竖线','中间断点']),
 dict(id='win-diagonal',title='斜着数也可以',chapter=1,objective='win',
      own=[(3,3),(4,4),(6,6),(7,7)],opp=[(2,2)],solution=(5,5),
      goal='找到左上到右下方向的一手成五。',hint='沿斜线数棋子，别把旁边的棋子算进来。',concepts=['主斜线','被挡的一端']),
 dict(id='win-corner-diagonal',title='角落里的斜线',chapter=1,objective='win',
      own=[(10,4),(11,3),(13,1),(14,0)],opp=[],solution=(12,2),
      goal='在左下角附近补齐另一种方向的斜线。',hint='沿右上到左下的方向找一格空位。',concepts=['反斜线','角落断点']),
 dict(id='win-overline',title='六颗连起来也获胜',chapter=1,objective='win',
      own=[(7,c) for c in (3,4,5,7,8)],opp=[],solution=(7,6),
      goal='一手把两段棋子连成六子。自由规则中，连续五颗或更多都获胜。',hint='找三颗和两颗之间的空位。',concepts=['自由规则','长连']),
 dict(id='win-cross',title='一颗连接两条线',chapter=1,objective='win',
      own=[(7,c) for c in (5,6,8,9)]+[(r,7) for r in (5,6,8,9)],opp=[],solution=(7,7),
      goal='找出能同时补齐横线和竖线的落点。',hint='两条缺一颗的线，共用同一个空位。',concepts=['交叉成五','共享落点']),
 dict(id='defend-end',title='先守住最后一端',chapter=2,objective='defend',
      own=[(7,3)],opp=[(7,c) for c in (4,5,6,7)],solution=(7,8),
      goal='对方已经连成四颗。堵住对方下一手的成五点。',hint='一端已被你的棋子挡住，检查另一端。',concepts=['冲四防守','已封一端']),
 dict(id='defend-gap',title='别漏掉线中间',chapter=2,objective='defend',
      own=[(4,2),(5,2)],opp=[(4,c) for c in (3,4,6,7)],solution=(4,5),
      goal='挡住对方藏在线中间的一手成五。',hint='只盯着两端会漏掉两段之间的空位。',concepts=['断四防守','中间断点']),
 dict(id='defend-overline',title='长线也要及时挡',chapter=2,objective='defend',
      own=[],opp=[(10,c) for c in (3,4,5,7,8,9)],solution=(10,6),
      goal='挡住对方一手连成七子的机会。',hint='自由规则中，超过五颗仍然获胜。看两段三子之间。',concepts=['长连防守','规则应用']),
 dict(id='defend-shared',title='一次守住两个方向',chapter=2,objective='defend',
      own=[],opp=[(7,c) for c in (5,6,8,9)]+[(r,r) for r in (5,6,8,9)],solution=(7,7),
      goal='对方的横线和斜线都差一颗。用一手同时挡住它们。',hint='两条危险线的空位恰好重合。',concepts=['共享防守点','横斜交叉']),
 dict(id='defend-diagonal-edge',title='守住右边的斜线',chapter=2,objective='defend',
      own=[(5,13)],opp=line(0,10,1,1,4),solution=(4,14),
      goal='挡住对方通向棋盘右边的一手成五。',hint='对方斜线的一端已经到边界，另一端仍是空位。',concepts=['边界防守','斜向冲四']),
 dict(id='defend-priority',title='先照顾眼前的危险',chapter=2,objective='defend',
      own=[(4,c) for c in (4,5,6)],opp=[(8,c) for c in (5,6,7,9)],solution=(8,8),
      goal='你也有一段三子，但这一手需要先挡住对方的成五点。',hint='对方三颗与一颗之间的空位，比继续延长自己的三子更紧急。',concepts=['防守优先','三加一断四']),
 dict(id='fork-open-three',title='把三子变成两头机会',chapter=3,objective='fork',
      own=[(7,c) for c in (5,6,7)],opp=[],solution=(7,8),
      goal='落一颗后，让下一手有至少两个不同的成五点。',hint='把三颗连成两端都空着的四颗。两边都值得看看。',concepts=['活四','两端威胁']),
 dict(id='fork-fill-gap',title='补空位，打开两端',chapter=3,objective='fork',
      own=[(7,c) for c in (4,5,7)],opp=[],solution=(7,6),
      goal='把有空位的三颗，变成两端都能成五的四颗。',hint='先补中间的空格，而不是继续向外伸。',concepts=['跳三变活四','内部连接']),
 dict(id='fork-two-axes',title='横竖各留一个机会',chapter=3,objective='fork',
      own=[(7,c) for c in (4,5,6)]+[(r,7) for r in (4,5,6)],opp=[(7,3),(3,7)],solution=(7,7),
      goal='让横线和竖线各出现一个成五点。',hint='两段三子向同一处靠近，另一头都已被挡住。',concepts=['双冲四','横竖组合']),
 dict(id='fork-straight-diagonal',title='横线与斜线一起走',chapter=3,objective='fork',
      own=[(7,c) for c in (5,6,8)]+[(r,r) for r in (4,5,6)],opp=[(7,4),(3,3)],solution=(7,7),
      goal='用一颗棋子，同时在横线和斜线留下成五机会。',hint='补好横线的空位，也能接上斜线的三颗。',concepts=['横斜双威胁','补空兼延伸']),
 dict(id='fork-two-gaps',title='两个空位，两份机会',chapter=3,objective='fork',
      own=[(7,c) for c in (5,8,9)]+[(r,7) for r in (5,8,9)],opp=[(7,4),(4,7)],solution=(7,7),
      goal='制造两个不同的成五空位，它们可以在线的中间。',hint='落在交会处后，横线和竖线仍各缺一颗，但缺的是不同位置。',concepts=['双断四','内部威胁']),
 dict(id='fork-three-axes',title='同时看见三个方向',chapter=3,objective='fork',
      own=[(7,c) for c in (5,6,8)]+[(r,7) for r in (5,6,8)]+[(r,r) for r in (5,6,8)],
      opp=[(7,4),(4,7),(4,4),(4,8),(8,4)],solution=(7,7),
      goal='在横、竖、斜三个方向留下成五机会。自由规则允许这样落子。',hint='三条线都经过中心空位。先数清每一条线。',concepts=['三向威胁','无禁手']),
 dict(id='two-block-extend',title='守住后，两头都有路',chapter=4,objective='two',
      own=[(7,c) for c in (5,6,7)]+[(2,8)],opp=[(r,8) for r in (3,4,5,6)],solution=(7,8),
      goal='先挡住竖线，再观察对方的回应，用你的第二手成五。',hint='同一个落点，既挡住对方四子，也把你的横线变成两头机会。',concepts=['防守兼活四','实战续着']),
 dict(id='two-block-connect',title='补自己的空，也挡对方的线',chapter=4,objective='two',
      own=[(7,c) for c in (4,6,7)],opp=[(r,5) for r in (5,6,8,9)],solution=(7,5),
      goal='先在交会处化解威胁，再用第二手完成五子。',hint='对方竖线的空位，也是你横线中缺的一颗。',concepts=['双重作用','断三变活四']),
 dict(id='two-white-diagonal',title='白棋的斜线机会',chapter=4,objective='two',player=2,
      own=[(r,r) for r in (5,6,7)],opp=[(8,c) for c in (5,6,7,9)],solution=(8,8),
      goal='这题轮到白棋。先挡住黑棋横线，再用第二手斜着成五。',hint='挡住横线的那一点，也延长了你的斜线。对方只能占一个落点。',concepts=['白棋行动','斜向活四','防守转攻']),
 dict(id='two-counter-two-lines',title='守一处，准备两条线',chapter=4,objective='two',
      own=[(7,c) for c in (4,5,6)]+[(4,10),(5,9),(6,8)],
      opp=[(7,3),(3,11)]+[(r,7) for r in (4,5,6,8)],solution=(7,7),
      goal='化解竖线危险，同时准备横线与反斜线；第二手选仍空着的成五点。',hint='危险点旁边有两组你的三子。一次连接，可以准备两个方向。',concepts=['防守兼双冲四','反斜线续着']),
 dict(id='two-counter-gaps',title='对方挡一格，你补另一格',chapter=4,objective='two',
      own=[(7,c) for c in (4,5,8)]+[(r,7) for r in (4,6,8)],
      opp=[(r,r) for r in (5,6,8,9)],solution=(7,7),
      goal='先化解斜线威胁，再从两个不同的内部空位中找到第二手成五。',hint='第一手落在交会处。下一手的机会分别藏在横线和竖线中间。',concepts=['防守兼双断四','内部空位续着']),
 dict(id='two-counter-three',title='守好这一手，再选成五点',chapter=4,objective='two',
      own=[(7,c) for c in (4,5,6)]+[(r,7) for r in (4,5,8)]+[(r,r) for r in (6,8,9)],
      opp=[(7,3),(5,5)]+[(4,10),(5,9),(6,8),(8,6)],solution=(7,7),
      goal='先挡住反斜线，再从横、竖、斜的机会中选出第二手成五。',hint='三组棋子的形状不一样。落在交会处后，再分别数一次。',concepts=['综合防守转攻','三向机会','混合线形']),
]


def make_exercise(spec):
    player=spec.get('player',1)
    board=[0]*AREA
    tactical=[]
    for color, key in ((player,'own'),(3-player,'opp')):
        for r,c in spec[key]:
            index=p(r,c)
            assert not board[index], (spec['id'],r,c)
            board[index]=color
            tactical.append(index)
    solution=p(*spec['solution'])
    assert not board[solution]
    assert not winners(board), spec['id']
    initial_threats=[immediate_wins(board,c) for c in (1,2)]
    count=[0,board.count(1),board.count(2)]
    # The exact number needed for valid turn parity, with quiet remote stones.
    target_black=max(count[1],count[2]+(player==2))
    target_white=target_black-(player==2)
    filler=[]
    candidates=sorted(range(AREA),key=lambda i:(-min(max(abs(i//15-j//15),abs(i%15-j%15)) for j in tactical+[solution]),i))
    for color,target in ((1,target_black),(2,target_white)):
        while count[color]<target:
            found=False
            for i in candidates:
                if board[i] or i==solution:
                    continue
                if min(max(abs(i//15-j//15),abs(i%15-j%15)) for j in tactical+[solution])<3:
                    continue
                board[i]=color
                if winners(board) or [immediate_wins(board,c) for c in (1,2)]!=initial_threats:
                    board[i]=0
                    continue
                filler.append(i); count[color]+=1; found=True; break
            assert found, ('no quiet filler',spec['id'])
    blacks=[i for i,v in enumerate(board) if v==1]
    whites=[i for i,v in enumerate(board) if v==2]
    moves=[]
    for k in range(max(len(blacks),len(whites))):
        if k<len(blacks):moves.append(blacks[k])
        if k<len(whites):moves.append(whites[k])
    state=replay(moves)
    assert list(state.board)==board and state.to_move==player and not state.terminal, spec['id']
    solutions=all_solutions(state,spec['objective'])
    assert solution in solutions, (spec['id'], solution, solutions, initial_threats)
    if spec['objective']!='win':
        assert not immediate_wins(state.board,player), ('preexisting win',spec['id'])
    if spec['objective']=='fork':
        assert not immediate_wins(state.board,3-player), ('fork under attack',spec['id'])
    if spec['objective']=='two':
        assert immediate_wins(state.board,3-player)==[solution], ('two must defend',spec['id'])
    branches=branches_for(state,solution) if spec['objective'] in ('fork','two') else []
    after=state.play(solution)
    threats=immediate_wins(after.board,player) if not after.terminal else []
    continuation=[solution]
    # Strongest resistance blocks one current winning point; reply elsewhere is
    # equally losing but less pedagogical. Select lowest threat for determinism.
    if branches:
        defense=threats[0]
        branch=next(b for b in branches if b['opponentMove']==defense)
        assert branch['winningMoves']
        continuation += [defense,branch['winningMoves'][0]]
    result={k:spec[k] for k in ('id','title','chapter','objective','goal','hint','concepts')}
    result.update(moves=moves,toMove=player,solution=solution,solutions=solutions,continuation=continuation,
                  tacticalCells=sorted(tactical),quietSetupCells=sorted(filler),
                  proof={'initialOpponentWinningMoves':immediate_wins(state.board,3-player),
                         'winningPointsAfterSolution':threats,'opponentRepliesVerified':len(branches)})
    return result,branches


def main():
    corpus=[]; certificates={}
    for spec in SPECS:
        result,branches=make_exercise(spec)
        corpus.append(result)
        if branches:certificates[result['id']]={'firstMove':result['solution'],'branches':branches}
        print(result['id'], 'moves',len(result['moves']), 'solutions',result['solutions'], 'branches',len(branches),flush=True)
    (ROOT/'corpus.json').write_text(json.dumps(corpus,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'certificates.json').write_text(json.dumps(certificates,ensure_ascii=False,indent=2)+'\n')
    print('Wrote',len(corpus),'original exercises')

if __name__=='__main__':main()
