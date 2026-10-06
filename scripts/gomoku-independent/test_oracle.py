"""Run: python -m unittest -v test_oracle.py. No external dependencies."""
import json
import random
import unittest
from pathlib import Path
from oracle import *

ROOT = Path(__file__).resolve().parents[2] / "docs" / "gomoku"

def at(r,c): return 15*r+c

def raw(stones, player=1):
    board=[0]*AREA
    for r,c in stones:board[at(r,c)]=player
    return board

def legal_history_for(board,last=None):
    black=[i for i,v in enumerate(board) if v==1 and i!=last]
    white=[i for i,v in enumerate(board) if v==2 and i!=last]
    assert len(black)==len(white) or len(black)==len(white)+1
    result=[]
    for k in range(len(black)):
        result.append(black[k])
        if k<len(white):result.append(white[k])
    if last is not None:result.append(last)
    return result

def draw_board():
    # Along each axis the phase advances 1,2,3,-1 modulo4, so runs <=2.
    return [1+int((r+2*c)%4>=2) for r in range(SIZE) for c in range(SIZE)]

def final_move_win_board():
    rng=random.Random(615)
    for window in WINDOWS:
        original=draw_board()
        flips=[i for i in window if original[i]==2]
        black_elsewhere=[i for i,v in enumerate(original) if v==1 and i not in window]
        for _ in range(200):
            board=original[:]
            for i in flips:board[i]=1
            for i in rng.sample(black_elsewhere,len(flips)):board[i]=2
            if winners(board)!={1}:continue
            for last in window:
                prior=board[:];prior[last]=0
                if not winners(prior):return board,last
    raise AssertionError('Could not construct full-board last-move win')

class RulesTests(unittest.TestCase):
    def test_window_count_unique(self):
        self.assertEqual(len(WINDOWS),572)
        self.assertEqual(len(set(WINDOWS)),572)

    def test_four_axes_both_colors_and_overlines(self):
        for player in (1,2):
            for dr,dc in AXES:
                for length in (4,5,6,7,15):
                    r,c=(0,14) if dc<0 else (0,0)
                    with self.subTest(player=player,axis=(dr,dc),length=length):
                        b=raw([(r+k*dr,c+k*dc) for k in range(length)],player)
                        self.assertEqual(winners(b),{player} if length>=5 else set())
                        lines=maximal_winning_lines(b,player)
                        self.assertEqual(len(lines),1 if length>=5 else 0)
                        if lines:self.assertEqual(len(lines[0]),length)

    def test_every_board_edge_and_corner(self):
        starts=[(0,0,0,1),(14,10,0,1),(0,14,1,0),(10,0,1,0),
                (0,0,1,1),(10,10,1,1),(0,14,1,-1),(10,4,1,-1)]
        for player in (1,2):
            for r,c,dr,dc in starts:
                b=raw([(r+k*dr,c+k*dc) for k in range(5)],player)
                self.assertEqual(winners(b),{player})

    def test_no_row_wrap(self):
        b=[0]*AREA
        for i in (12,13,14,15,16):b[i]=1
        self.assertEqual(winners(b),set())
        self.assertEqual(immediate_wins(b,1),[])

    def test_gaps_opponent_breaks_and_two_endpoints(self):
        b=raw([(7,c) for c in (3,4,6,7)])
        self.assertEqual(winners(b),set())
        self.assertEqual(immediate_wins(b,1),[at(7,5)])
        b[at(7,5)]=2
        self.assertEqual(immediate_wins(b,1),[])
        b=raw([(7,c) for c in (3,4,5,6)])
        self.assertEqual(immediate_wins(b,1),[at(7,2),at(7,7)])

    def test_gap_filled_into_six_or_seven(self):
        for player in (1,2):
            for cells in ((3,4,5,7,8),(3,4,5,7,8,9)):
                b=raw([(7,c) for c in cells],player)
                self.assertEqual(winners(b),set())
                self.assertEqual(immediate_wins(b,player),[at(7,6)])
                b[at(7,6)]=player
                self.assertEqual(winners(b),{player})

    def test_crossing_counts_all_lines(self):
        for player in (1,2):
            coords={(7,c) for c in range(5,10)}|{(r,7) for r in range(5,10)}|{(r,r) for r in range(5,10)}
            b=raw(coords,player)
            self.assertEqual(winners(b),{player})
            self.assertEqual(len(maximal_winning_lines(b,player)),3)

    def test_legal_history_both_colors_win_with_six(self):
        for player in (1,2):
            b=raw([(7,c) for c in (3,4,5,7,8)],player)
            for c in range(0,10+(player==2)*2,2):b[at(0,c)]=3-player
            s=replay(legal_history_for(b))
            self.assertEqual(s.to_move,player)
            self.assertFalse(s.terminal)
            s=s.play(at(7,6))
            self.assertEqual(s.winner,player)
            self.assertEqual(len(maximal_winning_lines(s.board,player)[0]),6)

    def test_free_black_double_threat_is_legal(self):
        b=raw([(7,c) for c in (5,6,8)]+[(r,7) for r in (5,6,8)])
        # Build count-balanced, quiet white stones, then legal history.
        for i in (0,2,4,6,8,10):b[i]=2
        s=replay(legal_history_for(b)).play(at(7,7))
        self.assertEqual(s.to_move,2)
        self.assertFalse(s.terminal)
        self.assertGreaterEqual(len(immediate_wins(s.board,1)),2)

    def test_constructive_full_board_draw(self):
        b=draw_board()
        self.assertEqual(b.count(1),113);self.assertEqual(b.count(2),112)
        self.assertEqual(winners(b),set())
        s=replay(legal_history_for(b))
        self.assertEqual(list(s.board),b);self.assertTrue(s.draw)
        self.assertEqual(s.winner,0);self.assertTrue(s.terminal)
        with self.assertRaises(ValueError):s.play(0)
        self.assertFalse(s.undo().terminal)

    def test_last_full_board_move_wins_before_draw(self):
        b,last=final_move_win_board()
        self.assertEqual(b.count(1),113);self.assertEqual(b.count(2),112)
        moves=legal_history_for(b,last)
        before=replay(moves[:-1]);self.assertFalse(before.terminal)
        s=before.play(last)
        self.assertEqual(s.winner,1);self.assertFalse(s.draw)
        self.assertNotIn(0,s.board)

    def test_turns_immutability_and_illegal_moves(self):
        s=State();next_s=s.play(112)
        self.assertEqual(s.moves,());self.assertEqual(s.board[112],0)
        self.assertEqual(next_s.board[112],1);self.assertEqual(next_s.to_move,2)
        for illegal in (112,-1,225,1.5,'3',True,None):
            with self.subTest(illegal=illegal):
                with self.assertRaises(ValueError):next_s.play(illegal)
                self.assertEqual(next_s.to_move,2);self.assertEqual(next_s.moves,(112,))

    def test_history_rejects_late_play_duplicates_and_bad_values(self):
        terminal=[0,15,1,16,2,17,3,18,4]
        self.assertEqual(replay(terminal).winner,1)
        for moves in ([0,0],[0,-1],[0,225],[False],[0,1.0],terminal+[19]):
            with self.assertRaises(ValueError):replay(moves)

    def test_undo_and_replay_every_prefix(self):
        moves=[112,111,97,96,82,81,67,66,52]
        s=replay(moves);self.assertEqual(s.winner,1)
        for count in range(len(moves)+1):
            expected=replay(moves[:len(moves)-count])
            self.assertEqual(s.undo(count),expected)
            self.assertEqual(replay(expected.moves),expected)
        for count in (-1,10,True,1.5):
            with self.assertRaises(ValueError):s.undo(count)

    def test_seeded_random_legal_histories(self):
        rng=random.Random(20261006)
        for game in range(100):
            state=State();history=[]
            while not state.terminal:
                move=rng.choice([i for i,v in enumerate(state.board) if not v])
                history.append(move);state=state.play(move)
                self.assertEqual(set(winners(state.board)),{state.winner} if state.winner else set())
                if len(history)%19==0:self.assertEqual(replay(history),state)
            self.assertEqual(replay(history),state)
            self.assertFalse(state.undo().terminal)

class CorpusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.exercises=json.loads((ROOT/'corpus.json').read_text())
        cls.certificates=json.loads((ROOT/'certificates.json').read_text())

    def test_exact_chapter_counts_unique_ids_and_chinese_text(self):
        self.assertEqual(len(self.exercises),24)
        self.assertEqual(len({e['id'] for e in self.exercises}),24)
        for chapter in range(1,5):self.assertEqual(sum(e['chapter']==chapter for e in self.exercises),6)
        for e in self.exercises:
            for key in ('title','goal','hint'):self.assertTrue(any('\u4e00'<=c<='\u9fff' for c in e[key]))

    def test_full_boards_no_dihedral_or_color_copies(self):
        seen={}
        for e in self.exercises:
            key=canonical(replay(e['moves']).board,color_neutral=True)
            self.assertNotIn(key,seen,(e['id'],seen.get(key)))
            seen[key]=e['id']

    def test_tactical_shapes_no_translated_dihedral_or_color_copies(self):
        # Removes setup ballast before canonicalizing, so random fillers cannot
        # make an otherwise copied exercise pass this stronger uniqueness test.
        seen={}
        for e in self.exercises:
            b=replay(e['moves']).board
            tactical=[v if i in e['tacticalCells'] else 0 for i,v in enumerate(b)]
            key=canonical(tactical,normalize_translation=True,color_neutral=True)
            self.assertNotIn(key,seen,(e['id'],seen.get(key)))
            seen[key]=e['id']

    def test_defending_only_one_end_is_not_enough(self):
        board=raw([(7,c) for c in (4,5,6,7)],2)
        for i in (0,2,4,6):board[i]=1
        state=replay(legal_history_for(board))
        self.assertEqual(immediate_wins(state.board,2),[108,113])
        self.assertFalse(objective_satisfied(state,108,'defend'))
        self.assertFalse(objective_satisfied(state,113,'defend'))
        self.assertEqual(all_solutions(state,'defend'),[])

    def test_immediate_win_does_not_count_as_other_objectives(self):
        e=self.exercises[0];state=replay(e['moves'])
        self.assertTrue(objective_satisfied(state,e['solution'],'win'))
        for objective in ('defend','fork','two'):
            self.assertFalse(objective_satisfied(state,e['solution'],objective))

    def test_fork_that_ignores_opponent_win_fails(self):
        board=raw([(7,c) for c in (5,6,7)],1)
        board[at(0,0)]=1
        for c in range(5,9):board[at(3,c)]=2
        state=replay(legal_history_for(board))
        self.assertGreaterEqual(len(immediate_wins(state.play(at(7,8)).board,1)),2)
        for objective in ('fork','two'):
            self.assertFalse(objective_satisfied(state,at(7,8),objective))

    def test_valid_histories_objectives_and_all_alternatives(self):
        for e in self.exercises:
            with self.subTest(exercise=e['id']):
                s=replay(e['moves'])
                self.assertFalse(s.terminal);self.assertEqual(s.to_move,e['toMove'])
                solutions=all_solutions(s,e['objective'])
                self.assertEqual(solutions,e['solutions']);self.assertIn(e['solution'],solutions)
                self.assertGreaterEqual(sum(v==0 for v in s.board)-len(solutions),2)
                if e['objective']!='win':self.assertEqual(immediate_wins(s.board,s.to_move),[])
                if e['objective']=='fork':self.assertEqual(immediate_wins(s.board,3-s.to_move),[])
                if e['objective']=='two':self.assertEqual(immediate_wins(s.board,3-s.to_move),[e['solution']])
                self.assertEqual(e['continuation'][0],e['solution'])
                terminal=s
                for move in e['continuation']:terminal=terminal.play(move)
                if e['objective'] in ('win','fork','two'):
                    self.assertEqual(terminal.winner,s.to_move)
                else:self.assertFalse(terminal.terminal)
                if e['objective']=='two':self.assertEqual(len(e['continuation']),3)

    def test_complete_response_certificates(self):
        count=0
        for e in self.exercises:
            if e['objective'] not in ('fork','two'):continue
            s=replay(e['moves']);after=s.play(e['solution'])
            expected_replies={i for i,v in enumerate(after.board) if not v}
            certificate=self.certificates[e['id']]
            self.assertEqual(certificate['firstMove'],e['solution'])
            replies=certificate['branches']
            self.assertEqual({b['opponentMove'] for b in replies},expected_replies)
            self.assertEqual(len(replies),len(expected_replies))
            self.assertEqual(len(replies),e['proof']['opponentRepliesVerified'])
            for branch in replies:
                responded=after.play(branch['opponentMove'])
                self.assertFalse(responded.terminal)
                wins=immediate_wins(responded.board,s.to_move)
                self.assertEqual(branch['winningMoves'],wins);self.assertTrue(wins)
                for winning_move in wins:self.assertEqual(responded.play(winning_move).winner,s.to_move)
                count+=1
        self.assertGreater(count,2500)

if __name__=='__main__':unittest.main()
