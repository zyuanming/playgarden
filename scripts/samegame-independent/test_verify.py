"""Adversarial self-tests and a separate tiny flat-board oracle."""
from copy import deepcopy
from functools import lru_cache
from itertools import permutations, product
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

from verify import (
    BudgetExceeded, SearchBudget, VerificationError, archive_key, canonical,
    check_challenge, components, enumerate_dag, exact, from_board, legal_groups,
    merge_evidence, play_index, read_ts_array, recompute, remove, representative,
    to_board, verify_campaign, verify_level,
)

REPO = Path(__file__).resolve().parents[2]


def flat_groups(board, width):
    """A deliberately slow oracle: compare every cell using Manhattan distance."""
    available = {i for i, value in enumerate(board) if value >= 0}
    result = []
    while available:
        cluster = {min(available)}
        while True:
            touching = {i for i in available - cluster
                        if any(board[i] == board[j] and
                               abs(i // width - j // width) + abs(i % width - j % width) == 1
                               for j in cluster)}
            if not touching:
                break
            cluster.update(touching)
        available.difference_update(cluster)
        if len(cluster) > 1:
            result.append(tuple(sorted(cluster)))
    return result


def flat_remove(board, width, height, group):
    """Top-down list slicing; no column tuples or canonicalization from verifier."""
    stacks = []
    for x in range(width):
        values = [board[i] for i in range(x, len(board), width) if i not in group and board[i] >= 0]
        if values:
            stacks.append([-1] * (height - len(values)) + values)
    stacks += [[-1] * height for _ in range(width - len(stacks))]
    return tuple(stacks[x][y] for y in range(height) for x in range(width))


@lru_cache(maxsize=None)
def flat_win(board, width, height):
    if all(value == -1 for value in board):
        return True
    return any(flat_win(flat_remove(board, width, height, group), width, height)
               for group in flat_groups(board, width))


class RulesTests(unittest.TestCase):
    def test_row_major_roundtrip_and_bottom_up_columns(self):
        board = [-1, -1, -1, 1, -1, -1, 2, 3, -1]
        columns = from_board(board, 3, 3)
        self.assertEqual(columns, ((2, 1), (3,)))
        self.assertEqual(to_board(columns, 3, 3), board)
        self.assertEqual(from_board([-1] * 9, 3, 3), ())

    def test_orthogonal_not_diagonal_and_no_row_wrap(self):
        self.assertEqual(legal_groups(from_board([0, 1, 1, 0], 2, 2), 2, 2), [])
        board = [0, 1, 2, 2, 3, 0]
        self.assertEqual(legal_groups(from_board(board, 3, 2), 3, 2), [])
        groups = legal_groups(from_board([0, 0, 1, 0, 1, 1], 3, 2), 3, 2)
        self.assertEqual([len(g) for g in groups], [3, 3])

    def test_gravity_before_left_pack_and_no_automatic_match(self):
        start = from_board([0, 1, 0, 1, 1, 2, 0, 2, 2], 3, 3)
        result = play_index(start, 3, 3, 1)
        self.assertEqual(to_board(result, 3, 3), [-1, -1, 0, 0, -1, 2, 0, 2, 2])
        self.assertEqual(sum(map(len, result)), 6)
        self.assertEqual(to_board(start, 3, 3), [0, 1, 0, 1, 1, 2, 0, 2, 2])
        middle = from_board([0, 1, 2, 0, 1, 2], 3, 2)
        self.assertEqual(to_board(play_index(middle, 3, 2, 1), 3, 2), [0, 2, -1, 0, 2, -1])

    def test_invalid_input_and_illegal_moves_are_rejected(self):
        invalid = [([0], 2, 2), ([True, 0], 2, 1), ([0.0, 0], 2, 1),
                   ([4, 4], 2, 1), ([-2, 0], 2, 1), ([0, 0], 0, 2),
                   ([0] * 8, 8, 1), ([0, 0], True, 2),
                   ([0, -1, -1, -1], 2, 2), ([-1, 0, -1, 0], 2, 2)]
        for args in invalid:
            with self.subTest(args=args), self.assertRaises(VerificationError):
                from_board(*args)
        columns = from_board([0, 1, 1, 0], 2, 2)
        for index in [0, -1, 4, True, 1.5, float('nan')]:
            with self.subTest(index=index), self.assertRaises(VerificationError):
                play_index(columns, 2, 2, index)

    def test_exact_gravity_and_column_contact_evidence(self):
        falling = from_board([0, 1, 0, 1, 1, 2, 0, 2, 2], 3, 3)
        group = next(g for g in legal_groups(falling, 3, 3) if representative(g, 3, 3) == 1)
        self.assertEqual(merge_evidence(falling, group), {'gravityJoins': 1, 'columnJoins': 0, 'emptiedColumns': 0})
        packing = from_board([0, 1, 0, 0, 1, 0], 3, 2)
        group = next(g for g in legal_groups(packing, 3, 2) if representative(g, 3, 2) == 1)
        self.assertEqual(merge_evidence(packing, group), {'gravityJoins': 0, 'columnJoins': 2, 'emptiedColumns': 1})
        unchanged = from_board([0, 0, 1, 0, 0, 1], 3, 2)
        group = next(g for g in legal_groups(unchanged, 3, 2) if representative(g, 3, 2) == 2)
        self.assertEqual(merge_evidence(unchanged, group), {'gravityJoins': 0, 'columnJoins': 0, 'emptiedColumns': 1})

    def test_every_2_by_3_three_color_board_matches_flat_oracle(self):
        # 729 full boards plus all their descendants. Raw (non-symmetry-reduced)
        # win/loss recursion independently checks the verifier's equivalences.
        checked_positions = set()
        checked_edges = 0
        for board in product(range(3), repeat=6):
            columns = from_board(list(board), 2, 3)
            nodes = enumerate_dag(columns, 2, 3, SearchBudget(2000))
            self.assertEqual(nodes[canonical(columns)].win, flat_win(board, 2, 3))
            for node in nodes.values():
                current = tuple(to_board(node.columns, 2, 3))
                if current in checked_positions:
                    continue
                checked_positions.add(current)
                groups = legal_groups(node.columns, 2, 3)
                self.assertEqual([tuple(sorted((2 - y) * 2 + x for x, y in group)) for group in groups], flat_groups(current, 2))
                self.assertEqual(node.win, flat_win(current, 2, 3))
                for group in groups:
                    selected = tuple(sorted((2 - y) * 2 + x for x, y in group))
                    after = remove(node.columns, group)
                    self.assertEqual(tuple(to_board(after, 2, 3)), flat_remove(current, 2, 3, selected))
                    self.assertLess(sum(map(len, after)), sum(map(len, node.columns)))
                    reflected = frozenset((len(node.columns) - 1 - x, y) for x, y in group)
                    self.assertEqual(remove(node.columns[::-1], reflected), after[::-1])
                    checked_edges += 1
        self.assertGreater(len(checked_positions), 800)
        self.assertGreater(checked_edges, 1000)


class SymmetryTests(unittest.TestCase):
    def test_all_color_permutations_and_occupied_column_reflection(self):
        position = ((0, 1, 0), (2,), (3, 1))
        expected = canonical(position)
        for permutation in permutations(range(4)):
            renamed = tuple(tuple(permutation[v] for v in col) for col in position)
            self.assertEqual(canonical(renamed), expected)
            self.assertEqual(canonical(renamed[::-1]), expected)
            self.assertEqual(archive_key(renamed), archive_key(position))
        board = to_board(position[::-1], 6, 3)
        self.assertTrue(all(board[y * 6 + x] == -1 for y in range(3) for x in range(3, 6)))

    def test_column_heights_and_color_partition_are_both_significant(self):
        self.assertNotEqual(canonical(((0, 0), (1,))), canonical(((0,), (0, 1))))
        self.assertNotEqual(canonical(((0, 0), (1, 1))), canonical(((0, 1), (0, 1))))

    def test_vertical_flip_changes_clearability_so_is_not_a_symmetry(self):
        board = (0, 0, 0, 0, 0, 1, 2, 1, 2)
        flipped = (2, 1, 2, 0, 0, 1, 0, 0, 0)
        self.assertFalse(flat_win(board, 3, 3))
        self.assertTrue(flat_win(flipped, 3, 3))
        self.assertNotEqual(canonical(from_board(list(board), 3, 3)), canonical(from_board(list(flipped), 3, 3)))

    def test_quarter_rotation_changes_clearability_so_is_not_a_symmetry(self):
        board = (0, 0, 0, 0, 1, 1, 2, 0, 2)
        rotated = (2, 0, 0, 0, 1, 0, 2, 1, 0)
        self.assertTrue(flat_win(board, 3, 3))
        self.assertFalse(flat_win(rotated, 3, 3))
        self.assertNotEqual(canonical(from_board(list(board), 3, 3)), canonical(from_board(list(rotated), 3, 3)))

    def test_full_width_reflection_creates_an_invalid_left_gap(self):
        valid = [0, 1, -1, -1, 0, 1, -1, -1]
        invalid = [*valid[:4][::-1], *valid[4:][::-1]]
        with self.assertRaisesRegex(VerificationError, 'unpacked'):
            from_board(invalid, 4, 2)


class ProofAndBudgetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.campaign = json.loads((REPO / 'docs/samegame/campaign.json').read_text())
        cls.level = cls.campaign['levels'][0]

    def test_baseline_first_certificate_and_all_metrics(self):
        result = verify_level(self.level, SearchBudget())
        self.assertEqual(result['metrics']['reachableStates'], 30)
        self.assertEqual(result['metrics']['transitionEdges'], 51)

    def test_each_metric_mutation_is_detected(self):
        for name, value in self.level['metrics'].items():
            changed = deepcopy(self.level)
            if type(value) is bool:
                changed['metrics'][name] = not value
            elif type(value) is int:
                changed['metrics'][name] += 1
            elif isinstance(value, list):
                changed['metrics'][name] = value[:-1]
            elif isinstance(value, dict):
                changed['metrics'][name][next(iter(value))] += 1
            else:
                self.fail(f'Missing metric mutation: {name}')
            with self.subTest(metric=name), self.assertRaises(VerificationError):
                verify_level(changed, SearchBudget())

    def test_each_trace_field_mutation_is_detected(self):
        for name, value in self.level['trace'][0].items():
            changed = deepcopy(self.level)
            changed['trace'][0][name] = not value if type(value) is bool else value + 1
            with self.subTest(field=name), self.assertRaises(VerificationError):
                verify_level(changed, SearchBudget())

    def test_opening_classification_group_size_and_branch_count_mutations(self):
        for field, mutation in [('outcome', 'losing'), ('size', 999), ('nextLegalGroups', 999), ('index', -1)]:
            changed = deepcopy(self.level)
            changed['openingOutcomes'][0][field] = mutation
            with self.subTest(field=field), self.assertRaises(VerificationError):
                verify_level(changed, SearchBudget())
        changed = deepcopy(self.level)
        changed['openingOutcomes'].pop()
        with self.assertRaises(VerificationError):
            verify_level(changed, SearchBudget())

    def test_truncated_reordered_extra_and_forged_certificates_fail(self):
        original = self.level['solution']
        invalid = [original[:-1], original[::-1], original + [0], [-1] + original[1:],
                   [True] + original[1:], [0] + original[1:], []]
        for moves in invalid:
            changed = deepcopy(self.level)
            changed['solution'] = moves
            with self.subTest(moves=moves), self.assertRaises(VerificationError):
                verify_level(changed, SearchBudget())
        changed = deepcopy(self.level)
        changed['canonicalKey'] = 'fake'
        with self.assertRaises(VerificationError):
            verify_level(changed, SearchBudget())

    def test_exhaustive_losing_graph_is_not_pruned_at_singleton(self):
        columns = from_board([0, 0, 1, 2, 2, 2], 3, 2)
        nodes = enumerate_dag(columns, 3, 2, SearchBudget())
        root = nodes[canonical(columns)]
        self.assertFalse(root.win)
        self.assertEqual(len(root.children), 2)
        self.assertGreater(len(nodes), 1)
        self.assertTrue(any(sum(map(len, node.columns)) == 1 for node in nodes.values()))

    def test_node_and_time_exhaustion_raise_unknown_never_false_loss(self):
        columns = from_board([0, 0, 0, 0], 2, 2)
        for budget in [SearchBudget(0), SearchBudget(1), SearchBudget(100, time.monotonic() - 1)]:
            with self.subTest(budget=budget), self.assertRaises(BudgetExceeded):
                enumerate_dag(columns, 2, 2, budget)
        self.assertTrue(enumerate_dag(columns, 2, 2, SearchBudget(2))[canonical(columns)].win)

    def test_budget_failure_is_nonzero_cli_and_machine_readable(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'report.json'
            proc = subprocess.run([sys.executable, str(Path(__file__).with_name('verify.py')), '--repo', str(REPO), '--node-cap', '1', '--output', str(output)], capture_output=True, text=True, timeout=10)
            self.assertEqual(proc.returncode, 1)
            report = json.loads(output.read_text())
            self.assertEqual(report['status'], 'FAIL')
            self.assertTrue(report['budgetExhausted'])
            self.assertIn('UNKNOWN', report['error'])

    def test_challenge_threshold_mutations_are_rejected(self):
        for chapter in range(1, 5):
            level = self.campaign['levels'][chapter * 20]
            check_challenge(level, 0)
            for field in ['certificateMixedChoices', 'certificateForcedSafeChoices', 'reachableStates', 'peakFrontier', 'openingDelayedTraps', 'certificateGravityMergeMoves']:
                changed = deepcopy(level)
                changed['metrics'][field] = 0
                with self.subTest(chapter=chapter, field=field), self.assertRaises(VerificationError):
                    check_challenge(changed, 0)
            changed = deepcopy(level)
            changed['metrics']['allLargestOpeningGroupsLose'] = False
            with self.assertRaises(VerificationError):
                check_challenge(changed, 0)
            if chapter >= 2:
                changed = deepcopy(level)
                changed['metrics']['certificateColumnMergeMoves'] = 0
                with self.assertRaises(VerificationError):
                    check_challenge(changed, 0)

    def test_json_type_confusion_and_missing_evidence_fail(self):
        for actual, expected in [(True, 1), (1, True), ({}, {'x': 1}), ([1], [1, 2])]:
            with self.subTest(actual=actual), self.assertRaises(VerificationError):
                exact(actual, expected, 'fixture')
        changed = deepcopy(self.level)
        changed.pop('trace')
        with self.assertRaises(VerificationError):
            verify_level(changed, SearchBudget())

    def test_campaign_rejects_runtime_drift_duplicate_and_chapter_regression(self):
        def save_fixture(root, campaign):
            (root / 'docs/samegame').mkdir(parents=True, exist_ok=True)
            (root / 'src/games').mkdir(parents=True, exist_ok=True)
            (root / 'docs/samegame/campaign.json').write_text(json.dumps(campaign))
            fields = {'id', 'title', 'chapter', 'width', 'height', 'colors', 'board', 'objective'}
            live = [{key: level[key] for key in fields} for level in campaign['levels']]
            source = 'export const samegameChapters = ' + json.dumps(campaign['chapters']) + ';\n'
            source += 'export const samegameLevels: SameGameLevel[] = ' + json.dumps(live) + ';\n'
            (root / 'src/games/samegameLevels.ts').write_text(source)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            wrong_chapters = deepcopy(self.campaign)
            wrong_chapters['chapters'][0]['id'] = 1
            save_fixture(root, wrong_chapters)
            with self.assertRaisesRegex(VerificationError, 'chapter IDs'):
                verify_campaign(root)
            duplicate = deepcopy(self.campaign)
            duplicate['levels'][1]['board'] = duplicate['levels'][0]['board']
            save_fixture(root, duplicate)
            with self.assertRaisesRegex(VerificationError, 'duplicate'):
                verify_campaign(root)
            save_fixture(root, self.campaign)
            source_path = root / 'src/games/samegameLevels.ts'
            source_path.write_text(source_path.read_text().replace('samegame-001', 'samegame-evil'))
            with self.assertRaisesRegex(VerificationError, 'runtime.id'):
                verify_campaign(root)

    def test_runtime_parser_accepts_only_json_data_not_executable_initializer(self):
        source = 'export const samegameLevels: SameGameLevel[] = [{"id":"x"}];'
        self.assertEqual(read_ts_array(source, 'samegameLevels'), [{'id': 'x'}])
        for source in ['export const other = [];', 'export const samegameLevels = [] + secret;', 'export const samegameLevels = {};' ]:
            with self.subTest(source=source), self.assertRaises(VerificationError):
                read_ts_array(source, 'samegameLevels')


if __name__ == '__main__':
    unittest.main()
