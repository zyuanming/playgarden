import unittest
from verify_corpus import load_ts_literal, parse_puzzle, decode_description, as_solution

class CorpusAdapterTests(unittest.TestCase):
    def test_literal_extraction_without_execution(self):
        data = b'// Generated\nimport type { Thing } from "untrusted";\nexport const slantLevels: Thing[] = [{"id":"one"}];\n'
        self.assertEqual(load_ts_literal(data), [{'id': 'one'}])
        for bad in (b'export const slantLevels = doSomething();',
                    b'export const slantLevels = [makeLevel()];',
                    b'export const slantLevels = []; sendData();'):
            with self.assertRaises(ValueError):
                load_ts_literal(bad)

    def test_encoding_strictness(self):
        record = {'width': 1, 'height': 1, 'clues': [-1, 0, 1, -1], 'solution': [-1]}
        self.assertEqual(parse_puzzle(record).clues, ((None, 0), (1, None)))
        self.assertEqual(as_solution(record), '\\')
        self.assertEqual(as_solution({**record, 'solution': [1]}), '/')
        for clue in (-2, 5, True, '1', None, 1.0):
            with self.assertRaises(ValueError):
                parse_puzzle({**record, 'clues': [clue, 0, 1, -1]})
        for board in ([0], [True], [1.0], [], [1, -1], '/'): 
            with self.assertRaises(ValueError):
                as_solution({**record, 'solution': board})

    def test_raw_description(self):
        self.assertEqual(decode_description('a01b4'), [-1, 0, 1, -1, -1, 4])
        self.assertEqual(decode_description('z'), [-1] * 26)
        for bad in ('5', 'A', '.', '-', None):
            with self.assertRaises(ValueError):
                decode_description(bad)

if __name__ == '__main__':
    unittest.main(verbosity=2)
