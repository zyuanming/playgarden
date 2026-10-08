import unittest
from oracle import Position, start, actions, placements, play, result, NEAR, FAR


def fixture(x, o, empty=None, halfmove=0, turn='x'):
    a = ['#'] * 49 if empty is not None else ['.'] * 49
    for i in empty or []: a[i] = '.'
    for i in x: a[i] = 'x'
    for i in o: a[i] = 'o'
    return Position.read(''.join(a), turn, halfmove)


class OracleRules(unittest.TestCase):
    def test_opening(self):
        p = start()
        self.assertEqual(len(actions(p)), 16)
        self.assertEqual(sum(m[0] == 'c' for m in actions(p)), 6)
        self.assertEqual(sum(m[0] == 'j' for m in actions(p)), 10)
        self.assertEqual(sum(len(actions(play(p,m))) for m in actions(p)), 256)

    def test_clone_duplicates_and_retention(self):
        p = fixture([0,1], [48])
        self.assertEqual(actions(p).count(('c',8)), 1)
        q = play(p, ('c',8))
        self.assertEqual(q.x, p.x | 1 << 8)
        self.assertEqual(q.halfmove, 0)

    def test_jump_crosses_gap_or_piece(self):
        for middle in ['#', 'o', 'x']:
            cells = list(fixture([0], [48]).cells); cells[8] = middle
            p = Position.read(cells, halfmove=98)
            q = play(p, ('j',0,16))
            self.assertFalse(q.x & 1)
            self.assertTrue(q.x & (1<<16))
            self.assertEqual(q.halfmove, 99)

    def test_conversion_all_eight_and_no_chain(self):
        p = fixture([8], [16,17,18,23,25,30,31,32,33,48])
        q = play(p, ('j',8,24))
        self.assertEqual(q.o, (1<<33) | (1<<48))
        self.assertEqual(q.x.bit_count(), 9)
        self.assertEqual(q.halfmove, 1)

    def test_pass_and_terminal_precedence(self):
        p = fixture([0], [48], [47], 99)
        self.assertEqual(actions(p), [('p',)])
        q = play(p, ('p',))
        self.assertEqual(q.halfmove,100)
        self.assertEqual(result(q), 'draw')
        self.assertEqual(actions(q), [])
        for p, expected in [(fixture([0,1],[48],[],100),'x'), (fixture([],[48],[0],100),'o'), (fixture([0],[48],[],100),'draw'), (fixture([],[],[0],100),'draw')]:
            self.assertEqual(result(p),expected)
            self.assertEqual(actions(p),[])
            self.assertRaises(ValueError, play, p, ('p',))

    def test_counter_capture_and_elimination(self):
        p = fixture([0], [17,48], halfmove=99)
        q = play(p, ('j',0,16))
        self.assertEqual(q.o,1<<48)
        self.assertEqual(q.halfmove,100)
        self.assertEqual(result(q),'draw')
        q = play(fixture([0],[17],halfmove=99), ('j',0,16))
        self.assertEqual(result(q),'x')
        q = play(fixture([0],[48],halfmove=99), ('c',8))
        self.assertEqual(q.halfmove,0)
        self.assertIsNone(result(q))

    def test_gap_dest_and_boundary(self):
        p = fixture([0],[48],[1,2,8,9,14,15,16])
        self.assertNotIn(('c',7), actions(p))
        self.assertIn(('j',0,16), actions(p))
        self.assertEqual(NEAR[0].bit_count(),3)
        self.assertEqual(FAR[0].bit_count(),5)
        self.assertEqual(NEAR[24].bit_count(),8)
        self.assertEqual(FAR[24].bit_count(),16)

if __name__ == '__main__':
    unittest.main()
