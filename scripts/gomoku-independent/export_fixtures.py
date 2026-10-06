"""Serialize independent fixture expectations for another-language comparison."""
import json
import random
from pathlib import Path
from oracle import *
from test_oracle import raw,draw_board,final_move_win_board,legal_history_for
ROOT=Path(__file__).resolve().parents[2] / "docs" / "gomoku"


def expected(board):
    return {'winners':sorted(winners(board)),
            'winningMoves':{'1':immediate_wins(board,1),'2':immediate_wins(board,2)},
            'winningLines':{'1':maximal_winning_lines(board,1),'2':maximal_winning_lines(board,2)},
            'full':0 not in board}

def main():
    positions=[];histories=[]
    def add(name,board):positions.append({'id':name,'board':board,'expected':expected(board)})
    add('empty',[0]*AREA)
    for player in (1,2):
        for dr,dc in AXES:
            for length in (4,5,6,7,15):
                r,c=(0,14) if dc<0 else (0,0)
                add(f'axis-{dr}-{dc}-color-{player}-length-{length}',
                    raw([(r+k*dr,c+k*dc) for k in range(length)],player))
        for name,coords in {
            'gap-five':[(7,c) for c in (3,4,6,7)],
            'gap-six':[(7,c) for c in (3,4,5,7,8)],
            'gap-seven':[(7,c) for c in (3,4,5,7,8,9)],
            'open-four':[(7,c) for c in (3,4,5,6)],
            'cross-three':set((7,c) for c in range(5,10))|set((r,7) for r in range(5,10))|set((r,r) for r in range(5,10)),
            'row-wrap':[(0,12),(0,13),(0,14),(1,0),(1,1)],
            'bottom-edge':[(14,c) for c in range(10,15)],
            'right-edge':[(r,14) for r in range(10,15)],
            'left-edge':[(r,0) for r in range(10,15)],
            'bottom-left-diagonal':[(10+k,4-k) for k in range(5)],
        }.items():add(name+f'-{player}',raw(coords,player))
        b=raw([(7,c) for c in (3,4,6,7)],player);b[110]=3-player;add(f'opponent-break-{player}',b)
    draw=draw_board();add('full-draw',draw)
    final,last=final_move_win_board();add('full-last-move-win',final)
    before=final[:];before[last]=0;add('full-before-last-win',before)
    rng=random.Random(10152026)
    states=[('empty',State()),('draw',replay(legal_history_for(draw))),
            ('full-win',replay(legal_history_for(final,last))),('before-full-win',replay(legal_history_for(final,last)[:-1]))]
    for game in range(40):
        s=State();snapshot=0
        while not s.terminal:
            s=s.play(rng.choice([i for i,v in enumerate(s.board) if not v]))
            if len(s.moves)%23==0 or s.terminal:
                states.append((f'random-{game}-{snapshot}',s));snapshot+=1
    for name,s in states:
        histories.append({'id':name,'moves':list(s.moves),
                          'expected':{'board':list(s.board),'toMove':s.to_move,'winner':s.winner,'draw':s.draw,
                                      'winningMoves':{'1':immediate_wins(s.board,1),'2':immediate_wins(s.board,2)}}})
    invalid=[{'id':'duplicate','moves':[0,0]}, {'id':'negative','moves':[0,-1]},
             {'id':'too-large','moves':[0,225]}, {'id':'fractional','moves':[0,1.5]},
             {'id':'boolean','moves':[True]}, {'id':'string','moves':['1']},
             {'id':'after-win','moves':[0,15,1,16,2,17,3,18,4,19]}]
    result={'ruleId':'freestyle-15-v1','boardSize':15,'positions':positions,'histories':histories,'invalidHistories':invalid}
    (ROOT/'rule-fixtures.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    print(f'{len(positions)} static positions, {len(histories)} complete legal histories, {len(invalid)} invalid histories')

if __name__=='__main__':main()
