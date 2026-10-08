import copy
import itertools
import random
import unittest
from pathlib import Path

from verify import enumerate_solutions, partial, points, read_runtime, signature, valid_certificate, validate_puzzle


def brute(p):
    return [list(path) for path in itertools.permutations(range(p['width'] * p['height'])) if valid_certificate(p, path)]


class IndependentVerifierTests(unittest.TestCase):
    def test_all_small_direction_boards_against_permutations(self):
        # Exhaust every in-board arrow choice for every 1/4 anchor placement.
        # Enumerating permutations uses no domain propagation from the solver.
        cases = 0
        for start, end in itertools.permutations(range(4), 2):
            base = {'width': 2, 'height': 2, 'arrows': [0] * 4, 'clues': [0] * 4}
            base['clues'][start], base['clues'][end] = 1, 4
            options = []
            for cell in range(4):
                if cell == end:
                    options.append([-1])
                else:
                    good = []
                    for arrow in range(8):
                        base['arrows'][cell] = arrow
                        if any(points(base, cell, target) for target in range(4)):
                            good.append(arrow)
                    options.append(good)
            for arrows in itertools.product(*options):
                p = {**base, 'arrows': list(arrows)}
                expected = brute(p)
                actual, _ = enumerate_solutions(p)
                self.assertEqual(min(2, len(expected)), len(actual))
                self.assertTrue(all(path in expected for path in actual))
                cases += 1
        self.assertEqual(cases, 324)

    def test_random_six_cell_boards_detect_zero_one_and_multiple(self):
        rng = random.Random(94301)
        counts = set()
        for _ in range(300):
            start, end = rng.sample(range(6), 2)
            p = {'width': 3, 'height': 2, 'arrows': [rng.randrange(8) for _ in range(6)], 'clues': [0] * 6}
            p['clues'][start], p['clues'][end], p['arrows'][end] = 1, 6, -1
            expected = brute(p)
            actual, _ = enumerate_solutions(p)
            self.assertEqual(min(2, len(expected)), len(actual))
            self.assertTrue(all(path in expected for path in actual))
            counts.add(len(actual))
        self.assertIn(0, counts)
        unique = {'width': 3, 'height': 2, 'arrows': [2, 2, 4, -1, 6, 6], 'clues': [1, 0, 0, 6, 0, 0]}
        self.assertEqual(enumerate_solutions(unique)[0], brute(unique))
        self.assertEqual(len(brute(unique)), 1)
        multiple = {'width': 4, 'height': 3, 'arrows': [2, 5, -1, 6, 4, 1, 6, 6, 2, 2, 1, 6], 'clues': [0, 0, 12, 1, 0, 0, 0, 0, 0, 0, 0, 0]}
        witnesses = [[3, 0, 1, 4, 8, 9, 11, 10, 7, 6, 5, 2], [3, 0, 1, 4, 8, 11, 9, 10, 7, 6, 5, 2]]
        self.assertTrue(all(valid_certificate(multiple, path) for path in witnesses))
        self.assertNotEqual(witnesses[0], witnesses[1])
        self.assertEqual(len(enumerate_solutions(multiple)[0]), 2)

    def test_certificate_and_puzzle_mutations(self):
        repo = Path(__file__).resolve().parents[2]
        p = read_runtime(repo)[0]
        path = enumerate_solutions(p)[0][0]
        self.assertTrue(valid_certificate(p, path))
        for mutated in (path[:-1], path + [path[0]], [path[0]] * len(path), list(reversed(path))):
            self.assertFalse(valid_certificate(p, mutated))
        changed = copy.deepcopy(p)
        changed['arrows'][path[0]] = (changed['arrows'][path[0]] + 4) % 8
        self.assertFalse(valid_certificate(changed, path))
        self.assertEqual(enumerate_solutions(changed)[0], [])
        changed = copy.deepcopy(p)
        changed['clues'][path[1]] = 1
        with self.assertRaises(AssertionError):
            validate_puzzle(changed)
        changed = copy.deepcopy(p)
        changed['clues'][path[1]] = len(path) + 1
        with self.assertRaises(AssertionError):
            validate_puzzle(changed)
        changed = copy.deepcopy(p)
        changed['clues'][path[1]] = 3
        self.assertFalse(valid_certificate(changed, path))
        changed = copy.deepcopy(p)
        changed['arrows'][path[-1]] = 0
        with self.assertRaises(AssertionError):
            validate_puzzle(changed)
        changed = copy.deepcopy(p)
        changed['arrows'] = changed['arrows'][:-1]
        with self.assertRaises(AssertionError):
            validate_puzzle(changed)

    def test_local_equations_reject_cycles_duplicate_incoming_and_anchor_overlap(self):
        square = {'width': 2, 'height': 2, 'arrows': [2, 4, 0, 6], 'clues': [0, 0, 0, 0]}
        self.assertFalse(partial(square, [1, 3, 0, 2])['valid'])
        tiny = {'width': 3, 'height': 1, 'arrows': [2, 2, -1], 'clues': [1, 0, 3]}
        self.assertFalse(partial(tiny, [2, 2, -1])['valid'])
        self.assertFalse(partial(tiny, [2, -1, -1])['valid'])
        self.assertFalse(partial(tiny, [0, -1, -1])['valid'])
        self.assertFalse(partial(tiny, [-1, -1])['valid'])
        self.assertFalse(partial(tiny, [True, -1, -1])['valid'])
        self.assertTrue(partial(tiny, [1, -1, -1])['valid'])
        self.assertFalse(partial(tiny, [1, -1, -1])['won'])
        self.assertTrue(partial(tiny, [1, 2, -1])['won'])
        duplicate = {'width': 3, 'height': 2, 'arrows': [2, 2, -1, 2, 0, 0], 'clues': [1, 0, 6, 0, 3, 0]}
        self.assertFalse(partial(duplicate, [1, -1, -1, 4, -1, -1])['valid'])


if __name__ == '__main__':
    unittest.main()
