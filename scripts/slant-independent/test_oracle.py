#!/usr/bin/env python3
import inspect
import itertools
import random
import unittest
from slant_oracle import Puzzle, solve, validate_solution, brute_solutions, transform, canonical_key, puzzle_key


def blank(rows, cols):
    return Puzzle(rows, cols, tuple(tuple(None for _ in range(cols + 1)) for _ in range(rows + 1)))


def all_degrees(rows, cols, board):
    # Matrix increments independent of solver's flat endpoint representation.
    clues = [[0] * (cols + 1) for _ in range(rows + 1)]
    for r in range(rows):
        for c in range(cols):
            if board[r * cols + c] == '\\':
                clues[r][c] += 1
                clues[r + 1][c + 1] += 1
            else:
                clues[r][c + 1] += 1
                clues[r + 1][c] += 1
    return tuple(tuple(row) for row in clues)


class OracleTests(unittest.TestCase):
    def test_single_cell_unique_and_multiple(self):
        p = blank(1, 1)
        result = solve(p)
        self.assertEqual(result['status'], 'multiple')
        self.assertEqual(set(result['solutions']), {'/', '\\'})
        self.assertFalse(result['exhausted'])
        for clue, answer in ((0, '/'), (1, '\\')):
            result = solve(Puzzle(1, 1, ((clue, None), (None, None))))
            self.assertEqual(result['status'], 'unique')
            self.assertTrue(result['exhausted'])
            self.assertEqual(result['solutions'], [answer])

    def test_unsatisfiable_and_capacity(self):
        for p in (Puzzle(1, 1, ((1, 1), (None, None))),
                  Puzzle(1, 1, ((2, None), (None, None))),
                  Puzzle(1, 2, ((None, 3, None), (None, None, None))),
                  Puzzle(1, 1, ((0, 0), (0, 0)))):
            result = solve(p)
            self.assertEqual(result['status'], 'unsatisfiable')
            self.assertEqual(result['count'], 0)
            self.assertTrue(result['exhausted'])

    def test_cycle_and_forest(self):
        p = blank(2, 2)
        diamond = '/\\\\/'
        validation = validate_solution(p, diamond)
        self.assertFalse(validation['valid'])
        self.assertTrue(validation['hasCycle'])
        self.assertEqual(len(brute_solutions(p)), 15)
        self.assertEqual(solve(p, limit=100)['count'], 15)
        # All degree clues exactly describe the cycle, but do not legalize it.
        cycle_puzzle = Puzzle(2, 2, all_degrees(2, 2, diamond))
        self.assertEqual(solve(cycle_puzzle)['status'], 'unsatisfiable')
        self.assertTrue(validate_solution(p, '\\\\\\\\')['valid'])

    def test_clues_checked_separately(self):
        p = Puzzle(1, 1, ((0, None), (None, None)))
        check = validate_solution(p, '\\')
        self.assertFalse(check['valid'])
        self.assertFalse(check['hasCycle'])
        self.assertIn('Clue (0,0)', check['errors'][0])

    def test_bad_inputs(self):
        for args in ((0, 1, ((None, None),)), (True, 1, ((None, None), (None, None))),
                     (1, 1, ((None,), (None,))),
                     (1, 1, ((5, None), (None, None))),
                     (1, 1, ((-1, None), (None, None))),
                     (1, 1, ((1.0, None), (None, None))),
                     (1, 1, ((True, None), (None, None)))):
            with self.assertRaises(ValueError):
                Puzzle(*args)
        p = blank(1, 1)
        for malformed in ('', '//', '0', 'x', [1], None):
            self.assertFalse(validate_solution(p, malformed)['valid'])
        for malformed in (0, -1, 1.5, True):
            with self.assertRaises(ValueError):
                solve(p, limit=malformed)
        with self.assertRaises(ValueError):
            solve(p, timeout_seconds=0)

    def test_timeout_is_never_unique(self):
        result = solve(blank(20, 20), timeout_seconds=1e-12)
        self.assertEqual(result['status'], 'timeout')
        self.assertFalse(result['exhausted'])
        self.assertTrue(result['timedOut'])

    def test_count_one_cutoff_not_unique(self):
        result = solve(blank(1, 1), limit=1)
        self.assertEqual(result['status'], 'inconclusive')
        self.assertFalse(result['exhausted'])

    def test_no_solution_parameter(self):
        self.assertEqual(list(inspect.signature(solve).parameters), ['puzzle', 'limit', 'timeout_seconds'])
        self.assertEqual(list(Puzzle.__dataclass_fields__), ['rows', 'cols', 'clues'])

    def test_all_one_cell_clue_sets(self):
        for clues in itertools.product((None, 0, 1, 2), repeat=4):
            p = Puzzle(1, 1, (clues[:2], clues[2:]))
            expected = brute_solutions(p)
            actual = solve(p, limit=5)
            self.assertEqual(set(actual['solutions']), set(expected), repr(p))
            self.assertTrue(actual['exhausted'])

    def test_seeded_small_boards_exhaustive_reference(self):
        rng = random.Random(20261005)
        for case in range(360):
            rows, cols = ((1, 2), (2, 2), (2, 3), (3, 3))[case % 4]
            board = ''.join(rng.choice('/\\') for _ in range(rows * cols))
            if case % 3:
                degrees = all_degrees(rows, cols, board)
                clues = tuple(tuple(d if rng.random() < 0.6 else None for d in row) for row in degrees)
            else:
                clues = tuple(tuple(rng.choice((None, None, 0, 1, 2, 3, 4)) for _ in range(cols + 1)) for _ in range(rows + 1))
            p = Puzzle(rows, cols, clues)
            expected = brute_solutions(p)
            actual = solve(p, limit=2 ** (rows * cols) + 1)
            self.assertTrue(actual['exhausted'])
            self.assertEqual(set(actual['solutions']), set(expected), f'Case {case}: {p}')
            self.assertEqual(solve(p)['count'], min(2, len(expected)))

    def test_d4_rectangle_dimensions_and_full_orbit(self):
        p = Puzzle(2, 3, ((0, None, 1, None), (2, 3, None, 1), (None, 0, None, 2)))
        keys = set()
        canonical = canonical_key(p)
        for mirror in (False, True):
            for turns in range(4):
                q, _ = transform(p, turns, mirror)
                keys.add(puzzle_key(q))
                self.assertEqual((q.rows, q.cols), (3, 2) if turns % 2 else (2, 3))
                self.assertEqual(canonical_key(q), canonical)
        self.assertEqual(len(keys), 8)
        # Equal flat vertex count must not collapse noncongruent rectangle sizes.
        self.assertNotEqual(canonical_key(blank(1, 5)), canonical_key(blank(2, 3)))

    def test_d4_matches_matrix_rotation_reference(self):
        p = Puzzle(2, 3, ((0, None, 1, None), (2, 3, None, 1), (None, 0, None, 2)))
        for mirror in (False, True):
            matrix = [list(reversed(row)) if mirror else list(row) for row in p.clues]
            for turns in range(4):
                q, _ = transform(p, turns, mirror)
                self.assertEqual(q.clues, tuple(tuple(row) for row in matrix))
                matrix = [list(row) for row in zip(*matrix[::-1])]

    def test_d4_preserves_validation_and_solution_counts(self):
        for rows, cols in ((1, 2), (2, 3), (3, 2)):
            p = blank(rows, cols)
            for board_tuple in itertools.product('/\\', repeat=rows * cols):
                board = ''.join(board_tuple)
                clued = Puzzle(rows, cols, all_degrees(rows, cols, board))
                valid = validate_solution(clued, board)['valid']
                for mirror in (False, True):
                    for turns in range(4):
                        q, transformed = transform(clued, turns, mirror, board)
                        self.assertEqual(validate_solution(q, transformed)['valid'], valid)
                        if turns == 1 and not mirror:
                            self.assertEqual(solve(q)['count'], solve(clued)['count'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
