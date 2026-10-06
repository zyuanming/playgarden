"""Small standard-library-only oracle regression suite for CI."""
import json
import unittest
from pathlib import Path
from oracle import Position, START, name, coord, opposite
HERE=Path(__file__).parent


class OracleTests(unittest.TestCase):
    def test_golden_move_check_and_result_vectors(self):
        cases=json.loads((HERE/'golden.json').read_text())
        self.assertEqual(len(cases),76)
        for case in cases:
            with self.subTest(case=case['label']):
                pos=Position.parse(case['fen'])
                self.assertEqual(pos.fen(),case['fen'])
                self.assertEqual(pos.legal_moves(),case['moves'])
                self.assertEqual(pos.checked(),case['check'])
                self.assertEqual(pos.result(),case['result'])

    def test_opening_perft_and_stored_divide(self):
        expected=json.loads((HERE/'opening-perft.json').read_text())
        p=Position.parse(START)
        self.assertEqual([p.perft(d) for d in range(4)],[1,44,1920,79666])
        actual={m:p.applied(m).perft(2) for m in p.legal_moves()}
        self.assertEqual(actual,expected['depth3Divide'])

    def test_bad_fen_rejections(self):
        for fen in json.loads((HERE/'fen-invalid.json').read_text()):
            with self.subTest(fen=fen):
                with self.assertRaises(ValueError):Position.parse(fen)

    def test_current_position_repetition_and_counter(self):
        p=Position.parse(START)
        self.assertIsNone(p.result([p.key()]))
        self.assertEqual(p.result([p.key(),p.key()]),{'winner':None,'reason':'repetition'})
        self.assertIsNone(p.result(['unrelated','unrelated','unrelated']))
        q=p.played('a3a4')
        self.assertEqual(q.halfmove,1)
        self.assertEqual(q.fullmove,1)
        q=q.played('a6a5')
        self.assertEqual(q.halfmove,2)
        self.assertEqual(q.fullmove,2)
        q=q.played('a4a5')
        self.assertEqual(q.halfmove,0)


if __name__=='__main__':unittest.main()
