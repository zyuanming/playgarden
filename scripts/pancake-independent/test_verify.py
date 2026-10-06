"""Positive tests and deliberately corrupt data mutations for independent verifier."""
from copy import deepcopy
from itertools import permutations, product
import json
import unittest

import verify


def fixture():
    levels = []
    for n in range(3, 9):
        stack = list(range(n, 0, -1))
        levels.append({'id': f'pancake-{n}', 'title': f'{n} pancakes', 'chapter': n - 3,
                       'stack': stack, 'minMoves': 1, 'solution': [n],
                       'features': ['whole-stack reversal']})
    return {'schemaVersion': 1,
            'chapters': [{'id': n, 'title': f'Chapter {n}', 'lesson': 'Reverse a prefix.'} for n in range(3, 9)],
            'levels': levels}


def runtime_source(campaign, omit_solution=True):
    levels = deepcopy(campaign['levels'])
    if omit_solution:
        for level in levels:
            del level['solution']
            del level['features']
    return ('export const pancakeChapters = ' + json.dumps(campaign['chapters']) + ' as const;\n'
            + 'export const pancakeLevels: PancakeLevel[] = ' + json.dumps(levels) + ';\n')


class GraphTests(unittest.TestCase):
    def test_all_sizes_states_edges_and_diameters(self):
        report = verify.verify_graphs()
        self.assertEqual(report['totalStates'], 46230)
        self.assertEqual(report['sizes'][-1]['reachableStates'], 40320)
        self.assertEqual(report['totalDirectedEdgesChecked'], sum(len(verify.distances(n)) * (n - 1) for n in range(3, 9)))

    def test_n3_distances_from_explicit_math(self):
        self.assertEqual(verify.distances(3), {(1, 2, 3): 0, (2, 1, 3): 1, (3, 2, 1): 1,
                                             (3, 1, 2): 2, (2, 3, 1): 2, (1, 3, 2): 3})

    def test_n4_distances_match_exhaustive_move_words(self):
        # Enumerating every word up to the graph diameter is a second algorithm,
        # distinct from the verifier's queue BFS, used only for this tiny oracle.
        minimum = {(1, 2, 3, 4): 0}
        for length in range(1, 5):
            for word in product(range(2, 5), repeat=length):
                values = [1, 2, 3, 4]
                for k in word:
                    for left in range(k // 2):
                        right = k - left - 1
                        values[left], values[right] = values[right], values[left]
                minimum.setdefault(tuple(values), length)
        self.assertEqual(len(minimum), 24)
        self.assertEqual(minimum, verify.distances(4))

    def test_every_3_and_4_stack_certificate(self):
        for n in (3, 4):
            for stack in permutations(range(1, n + 1)):
                moves = verify.shortest_solution(stack)
                self.assertEqual(len(moves), verify.distances(n)[stack])
                for k in moves:
                    stack = verify.flip(stack, k)
                self.assertEqual(stack, tuple(range(1, n + 1)))

    def test_illegal_move_inputs(self):
        for k in (None, True, False, -1, 0, 1, 4, 2.0, '2', float('nan'), float('inf')):
            with self.subTest(k=k), self.assertRaises(verify.VerificationError):
                verify.flip((2, 1, 3), k)

    def test_illegal_graph_sizes(self):
        for n in (2, 9, True, 3.0, '3'):
            with self.subTest(n=n), self.assertRaises(verify.VerificationError):
                verify.distances(n)

    def test_stack_rejects_nonpermutations(self):
        for state in (None, (), [], [1, 2], list(range(1, 10)), [1, 1, 3], [0, 1, 2], [2, 3, 4],
                      [True, 2, 3], [1.0, 2, 3], ['1', 2, 3], [1, 2, None]):
            with self.subTest(state=state), self.assertRaises(verify.VerificationError):
                verify.stack_from_json(state)


class CampaignTests(unittest.TestCase):
    def setUp(self):
        self.campaign = fixture()

    def assert_reject(self, mutate):
        mutate(self.campaign)
        with self.assertRaises(verify.VerificationError):
            verify.verify_campaign(self.campaign)

    def test_valid_campaign(self):
        report = verify.verify_campaign(self.campaign, 6)
        self.assertEqual(report['certificateMovesReplayed'], 6)
        self.assertEqual(report['uniqueInitialStacks'], 6)

    def test_wrong_expected_count(self):
        with self.assertRaises(verify.VerificationError):
            verify.verify_campaign(self.campaign, 120)

    def test_mutation_wrong_schema(self):
        for value in (0, 2, True, 1.0, '1', None):
            with self.subTest(value=value):
                self.campaign = fixture()
                self.assert_reject(lambda c: c.update(schemaVersion=value))

    def test_mutation_duplicate_ids(self):
        self.assert_reject(lambda c: c['levels'][1].update(id=c['levels'][0]['id']))

    def test_mutation_duplicate_stacks(self):
        copy = deepcopy(self.campaign['levels'][0])
        copy['id'] = 'unique-id-for-duplicate-stack'
        self.assert_reject(lambda c: c['levels'].append(copy))

    def test_mutation_wrong_minimum(self):
        self.assert_reject(lambda c: c['levels'][0].update(minMoves=2))

    def test_mutation_boolean_minimum(self):
        self.assert_reject(lambda c: c['levels'][0].update(minMoves=True))

    def test_mutation_float_minimum(self):
        self.assert_reject(lambda c: c['levels'][0].update(minMoves=1.0))

    def test_mutation_invalid_stack(self):
        self.assert_reject(lambda c: c['levels'][0].update(stack=[2, 2, 1]))

    def test_mutation_boolean_stack(self):
        self.assert_reject(lambda c: c['levels'][0].update(stack=[3, 2, True]))

    def test_mutation_illegal_move(self):
        for value in (0, 1, 4, '3', True, 3.0, None):
            with self.subTest(value=value):
                self.campaign = fixture()
                self.assert_reject(lambda c: c['levels'][0].update(solution=[value]))

    def test_mutation_legal_wrong_solution(self):
        self.assert_reject(lambda c: c['levels'][0].update(solution=[2]))

    def test_mutation_solution_empty(self):
        self.assert_reject(lambda c: c['levels'][0].update(solution=[]))

    def test_mutation_legal_nonshortest_solution(self):
        self.assert_reject(lambda c: c['levels'][0].update(solution=[2, 2, 3]))

    def test_mutation_certificate_after_goal(self):
        self.assert_reject(lambda c: c['levels'][0].update(solution=[3, 2, 2]))

    def test_mutation_solved_start(self):
        self.assert_reject(lambda c: c['levels'][0].update(stack=[1, 2, 3], minMoves=0, solution=[]))

    def test_mutation_unknown_chapter(self):
        self.assert_reject(lambda c: c['levels'][0].update(chapter=9))

    def test_mutation_boolean_chapter(self):
        self.assert_reject(lambda c: c['levels'][0].update(chapter=True))

    def test_mutation_duplicate_chapter(self):
        self.assert_reject(lambda c: c['chapters'].append(deepcopy(c['chapters'][0])))

    def test_mutation_empty_chapter(self):
        self.assert_reject(lambda c: c['chapters'].append({'id': 9, 'title': 'Unused', 'lesson': 'Empty'}))

    def test_mutation_missing_lesson(self):
        self.assert_reject(lambda c: c['chapters'][0].pop('lesson'))

    def test_mutation_missing_title(self):
        self.assert_reject(lambda c: c['levels'][0].pop('title'))

    def test_mutation_empty_title(self):
        self.assert_reject(lambda c: c['levels'][0].update(title='  '))

    def test_mutation_missing_features(self):
        self.assert_reject(lambda c: c['levels'][0].pop('features'))

    def test_mutation_duplicate_features(self):
        self.assert_reject(lambda c: c['levels'][0].update(features=['duplicate', 'duplicate']))

    def test_mutation_malformed_features(self):
        for value in (None, 'whole flip', 1, [True], ['']):
            with self.subTest(value=value):
                self.campaign = fixture()
                self.assert_reject(lambda c: c['levels'][0].update(features=value))

    def test_mutation_wrong_feature_claims(self):
        for field, wrong in (('optimalOpenings', [2]), ('greedyMoves', 2), ('breakpoints', 0)):
            with self.subTest(field=field):
                self.campaign = fixture()
                self.campaign['levels'][0]['features'] = {'optimalOpenings': [3], 'greedyMoves': 1, 'breakpoints': 1}
                self.assert_reject(lambda c: c['levels'][0]['features'].update({field: wrong}))

    def test_valid_numeric_features(self):
        self.campaign['levels'][0]['features'] = {'optimalOpenings': [3], 'greedyMoves': 1, 'breakpoints': 1}
        verify.verify_campaign(self.campaign)

    def test_mutation_declared_chapter_count(self):
        self.assert_reject(lambda c: c['chapters'][0].update(count=2))

    def test_valid_multiple_shortest_certificates(self):
        self.campaign['levels'][0].update(stack=[1, 3, 2], minMoves=3, solution=[2, 3, 2])
        verify.verify_campaign(self.campaign)
        self.campaign['levels'][0]['solution'] = [3, 2, 3]
        verify.verify_campaign(self.campaign)


class StaticDataTests(unittest.TestCase):
    def test_valid_runtime_with_and_without_solution(self):
        for omit in (True, False):
            verify.verify_runtime_data(fixture(), runtime_source(fixture(), omit))

    def test_mutation_runtime_stack(self):
        altered = fixture()
        altered['levels'][0]['stack'] = [2, 1, 3]
        with self.assertRaises(verify.VerificationError):
            verify.verify_runtime_data(fixture(), runtime_source(altered))

    def test_mutation_runtime_minimum(self):
        altered = fixture()
        altered['levels'][0]['minMoves'] = True
        with self.assertRaises(verify.VerificationError):
            verify.verify_runtime_data(fixture(), runtime_source(altered))

    def test_mutation_runtime_reorder(self):
        altered = fixture()
        altered['levels'][0], altered['levels'][1] = altered['levels'][1], altered['levels'][0]
        with self.assertRaises(verify.VerificationError):
            verify.verify_runtime_data(fixture(), runtime_source(altered))

    def test_mutation_runtime_missing_field(self):
        altered = fixture()
        del altered['levels'][0]['minMoves']
        with self.assertRaises(verify.VerificationError):
            verify.verify_runtime_data(fixture(), runtime_source(altered))

    def test_mutation_runtime_extra_level(self):
        altered = fixture()
        altered['levels'].append(deepcopy(altered['levels'][0]))
        with self.assertRaises(verify.VerificationError):
            verify.verify_runtime_data(fixture(), runtime_source(altered))

    def test_mutation_runtime_chapter(self):
        altered = fixture()
        altered['chapters'][0]['lesson'] = 'Changed'
        with self.assertRaises(verify.VerificationError):
            verify.verify_runtime_data(fixture(), runtime_source(altered))

    def test_mutation_runtime_computed_expression(self):
        for suffix in (' .map(x => x);', ' + extra;', '[0];'):
            with self.subTest(suffix=suffix), self.assertRaises(verify.VerificationError):
                verify.extract_export('export const a = [1]' + suffix, 'a')

    def test_mutation_runtime_duplicate_export(self):
        with self.assertRaises(verify.VerificationError):
            verify.extract_export('export const a = [1]; export const a = [2];', 'a')

    def test_mutation_json_duplicate_key(self):
        with self.assertRaises(verify.VerificationError):
            json.loads('{"x": 1, "x": 2}', object_pairs_hook=verify._unique_pairs)

    def test_type_sensitive_equality(self):
        for bad in (True, 1.0, '1'):
            with self.subTest(bad=bad), self.assertRaises(verify.VerificationError):
                verify.exact([{'minimum': bad}], [{'minimum': 1}], 'test')


class DistanceDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tables = {str(n): ''.join(str(verify.distances(n)[state]) for state in permutations(range(1, n + 1)))
                      for n in range(3, 9)}

    def source(self, tables):
        return 'export const pancakeDistances: Record<number, string> = ' + json.dumps(tables) + ';'

    def test_valid_distance_tables(self):
        report = verify.verify_distance_data(self.source(self.tables))
        self.assertEqual(report['entriesChecked'], 46230)

    def test_mutation_wrong_distance_entry(self):
        tables = deepcopy(self.tables)
        tables['8'] = '1' + tables['8'][1:]
        with self.assertRaises(verify.VerificationError):
            verify.verify_distance_data(self.source(tables))

    def test_mutation_wrong_distance_length(self):
        tables = deepcopy(self.tables)
        tables['8'] = tables['8'][:-1]
        with self.assertRaises(verify.VerificationError):
            verify.verify_distance_data(self.source(tables))

    def test_mutation_nondigit_distance(self):
        tables = deepcopy(self.tables)
        tables['8'] = '?' + tables['8'][1:]
        with self.assertRaises(verify.VerificationError):
            verify.verify_distance_data(self.source(tables))

    def test_mutation_missing_distance_table(self):
        tables = deepcopy(self.tables)
        del tables['8']
        with self.assertRaises(verify.VerificationError):
            verify.verify_distance_data(self.source(tables))

    def test_mutation_extra_distance_table(self):
        tables = deepcopy(self.tables)
        tables['2'] = '01'
        with self.assertRaises(verify.VerificationError):
            verify.verify_distance_data(self.source(tables))


if __name__ == '__main__':
    unittest.main(verbosity=2)
