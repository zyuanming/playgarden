#!/usr/bin/env python3
"""Independent pancake-sorting corpus verifier, Python standard library only.

Never imports or executes a production generator, solver, or runtime. Graphs are
built from the mathematical rule: reverse a prefix of length 2 through n. BFS
starts at the sorted goal and must cover exactly n! distinct permutations. Every
directed edge is then independently checked against an index-based reversal.
"""
from __future__ import annotations

import argparse
from collections import Counter, deque
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import io
from itertools import permutations
import json
from math import factorial
from pathlib import Path
import re
import sys
import time
import unittest
from typing import Any

MIN_SIZE = 3
MAX_SIZE = 8
EXPECTED_STATES = 46230
EXPECTED_DIAMETERS = {3: 3, 4: 4, 5: 5, 6: 7, 7: 8, 8: 9}
Stack = tuple[int, ...]


class VerificationError(Exception):
    """Malformed data, invalid certificate, or failed independent invariant."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def exact(actual: Any, expected: Any, label: str) -> None:
    """Structural JSON equality without Python's bool/int equivalence."""
    require(type(actual) is type(expected), f'{label}: type mismatch')
    if isinstance(expected, dict):
        require(actual.keys() == expected.keys(), f'{label}: keys mismatch')
        for key in expected:
            exact(actual[key], expected[key], f'{label}.{key}')
    elif isinstance(expected, list):
        require(len(actual) == len(expected), f'{label}: length mismatch')
        for i, (a, b) in enumerate(zip(actual, expected)):
            exact(a, b, f'{label}[{i}]')
    else:
        require(actual == expected, f'{label}: {actual!r} != {expected!r}')


def stack_from_json(value: Any, label: str = 'stack') -> Stack:
    require(type(value) is list, f'{label}: expected an array')
    require(MIN_SIZE <= len(value) <= MAX_SIZE, f'{label}: size must be 3..8')
    require(all(type(v) is int for v in value), f'{label}: all sizes must be integers')
    require(sorted(value) == list(range(1, len(value) + 1)), f'{label}: not a permutation of 1..n')
    return tuple(value)


def flip(state: Stack, k: int) -> Stack:
    require(type(k) is int and 2 <= k <= len(state), f'illegal prefix length {k!r}')
    return state[:k][::-1] + state[k:]


@lru_cache(maxsize=6)
def distances(n: int) -> dict[Stack, int]:
    require(type(n) is int and MIN_SIZE <= n <= MAX_SIZE, 'graph size must be 3..8')
    goal = tuple(range(1, n + 1))
    result = {goal: 0}
    queue = deque([goal])
    while queue:
        state = queue.popleft()
        for k in range(2, n + 1):
            child = flip(state, k)
            if child not in result:
                result[child] = result[state] + 1
                queue.append(child)
    require(len(result) == factorial(n), f'n={n}: BFS did not reach every permutation')
    return result


def shortest_solution(state: Stack) -> list[int]:
    graph = distances(len(state))
    require(state in graph, 'cannot solve a non-permutation')
    path = []
    while graph[state]:
        for k in range(2, len(state) + 1):
            child = flip(state, k)
            if graph[child] == graph[state] - 1:
                path.append(k)
                state = child
                break
        else:
            raise VerificationError('BFS has no descending successor')
    return path


def verify_graphs() -> dict[str, Any]:
    records = []
    total_states = total_edges = 0
    for n in range(MIN_SIZE, MAX_SIZE + 1):
        graph = distances(n)
        histogram: Counter[int] = Counter()
        digest = hashlib.sha256()
        edge_count = 0
        for state in permutations(range(1, n + 1)):
            require(state in graph, f'n={n}: missing permutation {state}')
            depth = graph[state]
            histogram[depth] += 1
            digest.update((''.join(map(str, state)) + ':' + str(depth) + '\n').encode())
            descending = 0
            successors = set()
            for k in range(2, n + 1):
                child = flip(state, k)
                # A different construction from the generator used by BFS.
                expected = tuple(state[k - i - 1] if i < k else state[i] for i in range(n))
                require(child == expected, f'n={n}: incorrect prefix-reversal edge')
                require(child != state, f'n={n}: illegal self edge')
                require(child not in successors, f'n={n}: duplicate successor')
                successors.add(child)
                require(child in graph, f'n={n}: edge escapes graph')
                require(flip(child, k) == state, f'n={n}: flip is not an involution')
                require(abs(graph[child] - depth) <= 1, f'n={n}: invalid BFS edge distances')
                descending += graph[child] == depth - 1
                edge_count += 1
            require(depth == 0 or descending > 0, f'n={n}: no shortest-path successor')
        require(sum(histogram.values()) == factorial(n), f'n={n}: permutation count mismatch')
        require(histogram[0] == 1, f'n={n}: goal must be unique')
        require(max(histogram) == EXPECTED_DIAMETERS[n], f'n={n}: diameter regression')
        require(edge_count == factorial(n) * (n - 1), f'n={n}: directed edge count mismatch')
        records.append({'size': n, 'reachableStates': len(graph), 'expectedStates': factorial(n),
                        'directedEdgesChecked': edge_count, 'diameter': max(histogram),
                        'distanceHistogram': dict(sorted(histogram.items())),
                        'distanceTableSha256': digest.hexdigest()})
        total_states += len(graph)
        total_edges += edge_count
    require(total_states == EXPECTED_STATES, 'total graph size must equal 46,230')
    require(len(distances(8)) == 40320, 'eight-pancake graph must have 40,320 states')
    return {'status': 'passed', 'totalStates': total_states, 'totalDirectedEdgesChecked': total_edges,
            'sizes': records}


def _identifier(value: Any, label: str) -> tuple[type, Any]:
    require((type(value) is str and bool(value.strip())) or (type(value) is int and value >= 0),
            f'{label}: expected a nonempty string or nonnegative integer')
    return type(value), value


def _nonempty(value: Any, label: str) -> None:
    require(type(value) is str and bool(value.strip()), f'{label}: expected nonempty text')


def greedy_move_count(state: Stack) -> int:
    """Classic constructive upper bound: place n, then n-1, and so on."""
    values = list(state)
    moves = 0
    for target in range(len(values), 1, -1):
        if values[target - 1] == target:
            continue
        top_index = values.index(target)
        if top_index:
            values[:top_index + 1] = reversed(values[:top_index + 1])
            moves += 1
        values[:target] = reversed(values[:target])
        moves += 1
    require(values == list(range(1, len(values) + 1)), 'greedy strategy failed')
    return moves


def breakpoint_count(state: Stack) -> int:
    with_plate = state + (len(state) + 1,)
    return sum(abs(a - b) != 1 for a, b in zip(with_plate, with_plate[1:]))


def verify_campaign(campaign: Any, expected_count: int | None = None) -> dict[str, Any]:
    require(type(campaign) is dict, 'campaign: expected an object')
    require(type(campaign.get('schemaVersion')) is int and campaign['schemaVersion'] == 1,
            'schemaVersion must be integer 1')
    chapters = campaign.get('chapters')
    levels = campaign.get('levels')
    require(type(chapters) is list and len(chapters) > 0, 'chapters must be nonempty')
    require(type(levels) is list and len(levels) > 0, 'levels must be nonempty')
    if expected_count is not None:
        require(len(levels) == expected_count, f'level count {len(levels)} != expected {expected_count}')
    chapter_ids = set()
    for index, chapter in enumerate(chapters):
        label = f'chapters[{index}]'
        require(type(chapter) is dict, f'{label}: expected an object')
        key = _identifier(chapter.get('id'), f'{label}.id')
        require(key not in chapter_ids, f'{label}: duplicate chapter ID')
        chapter_ids.add(key)
        _nonempty(chapter.get('title'), f'{label}.title')
        _nonempty(chapter.get('lesson'), f'{label}.lesson')
    level_ids = set()
    initial_stacks = set()
    counts_by_size: Counter[int] = Counter()
    counts_by_distance: Counter[int] = Counter()
    counts_by_chapter: Counter[str] = Counter()
    checked_moves = 0
    first_move_choices: Counter[int] = Counter()
    details = []
    for index, level in enumerate(levels):
        label = f'levels[{index}]'
        require(type(level) is dict, f'{label}: expected an object')
        key = _identifier(level.get('id'), f'{label}.id')
        require(key not in level_ids, f'{label}: duplicate level ID')
        level_ids.add(key)
        _nonempty(level.get('title'), f'{label}.title')
        chapter_index = level.get('chapter')
        require(type(chapter_index) is int and 0 <= chapter_index < len(chapters), f'{label}: unknown chapter index')
        state = stack_from_json(level.get('stack'), f'{label}.stack')
        require(state not in initial_stacks, f'{label}: duplicate initial stack')
        initial_stacks.add(state)
        graph = distances(len(state))
        depth = graph[state]
        require(depth > 0, f'{label}: starts already solved')
        require(type(level.get('minMoves')) is int and level['minMoves'] == depth,
                f'{label}: minMoves {level.get("minMoves")!r} != exact BFS distance {depth}')
        solution = level.get('solution')
        require(type(solution) is list, f'{label}: solution must be an array')
        require(len(solution) == depth, f'{label}: solution is not shortest')
        require('features' in level, f'{label}: missing features')
        require(type(level['features']) in (dict, list), f'{label}: features must be an object or array')
        if type(level['features']) is list:
            require(all(type(v) is str and v.strip() for v in level['features']),
                    f'{label}: feature list must contain nonempty strings')
            require(len(level['features']) == len(set(level['features'])), f'{label}: duplicate features')
        optimal_openings = [k for k in range(2, len(state) + 1) if graph[flip(state, k)] == depth - 1]
        first_move_choices[len(optimal_openings)] += 1
        if type(level['features']) is dict:
            expected_features = {'optimalOpenings': optimal_openings,
                                 'greedyMoves': greedy_move_count(state),
                                 'breakpoints': breakpoint_count(state)}
            exact(level['features'], expected_features, f'{label}.features')
        initial = state
        for step, k in enumerate(solution):
            require(state != tuple(range(1, len(state) + 1)), f'{label}: moves after goal')
            try:
                following = flip(state, k)
            except VerificationError as error:
                raise VerificationError(f'{label}.solution[{step}]: {error}') from error
            require(graph[following] == graph[state] - 1, f'{label}: certificate step is not optimal')
            state = following
            checked_moves += 1
        require(state == tuple(range(1, len(state) + 1)), f'{label}: certificate misses the sorted goal')
        counts_by_size[len(state)] += 1
        counts_by_distance[depth] += 1
        counts_by_chapter[str(level['chapter'])] += 1
        details.append({'id': level['id'], 'size': len(state), 'exactMinMoves': depth,
                        'optimalOpeningLengths': optimal_openings,
                        'initialStack': list(initial)})
    require(set(counts_by_chapter) == {str(i) for i in range(len(chapters))}, 'campaign contains an empty chapter')
    for index, chapter in enumerate(chapters):
        if 'count' in chapter:
            require(type(chapter['count']) is int and chapter['count'] == counts_by_chapter[str(index)],
                    f'chapter[{index}]: declared count mismatch')
    return {'status': 'passed', 'levelCount': len(levels), 'chapterCount': len(chapters),
            'uniqueLevelIds': len(level_ids), 'uniqueInitialStacks': len(initial_stacks),
            'certificateMovesReplayed': checked_moves, 'allSolutionsShortest': True,
            'levelsBySize': dict(sorted(counts_by_size.items())),
            'levelsByDistance': dict(sorted(counts_by_distance.items())),
            'levelsByChapter': dict(counts_by_chapter),
            'optimalOpeningChoiceHistogram': dict(sorted(first_move_choices.items())),
            'levels': details}


def extract_export(source: str, name: str) -> Any:
    """Read static JSON literal from a TS export; never execute JavaScript."""
    pattern = re.compile(r'\bexport\s+const\s+' + re.escape(name) + r'\b[^=]*=\s*')
    found = list(pattern.finditer(source))
    require(len(found) == 1, f'expected one static export named {name}')
    start = found[0].end()
    try:
        result, length = json.JSONDecoder(object_pairs_hook=_unique_pairs, parse_constant=_reject_constant).raw_decode(source[start:])
    except json.JSONDecodeError as error:
        raise VerificationError(f'{name}: export must begin with a JSON literal: {error}') from error
    suffix = source[start + length:]
    require(re.match(r'\s*(?:;|as\s+const\b|satisfies\b)', suffix) is not None,
            f'{name}: exported literal is followed by a computed expression')
    return result


def verify_runtime_data(campaign: dict[str, Any], source: str,
                        levels_export: str = 'pancakeLevels',
                        chapters_export: str = 'pancakeChapters') -> dict[str, Any]:
    levels = extract_export(source, levels_export)
    chapters = extract_export(source, chapters_export)
    # Production may deliberately omit solution certificates. Every published
    # property must match, and core playable properties must all be present.
    require(type(levels) is list, 'runtime levels must be an array')
    require(len(levels) == len(campaign['levels']), 'runtime level count mismatch')
    omitted = set()
    required = {'id', 'title', 'chapter', 'stack', 'minMoves'}
    for index, (runtime, archive) in enumerate(zip(levels, campaign['levels'])):
        require(type(runtime) is dict, f'runtime levels[{index}]: expected an object')
        require(required <= runtime.keys(), f'runtime levels[{index}]: missing playable fields')
        require(runtime.keys() <= archive.keys(), f'runtime levels[{index}]: unexpected fields')
        for field, value in runtime.items():
            exact(value, archive[field], f'runtime levels[{index}].{field}')
        omitted.update(archive.keys() - runtime.keys())
    exact(chapters, campaign['chapters'], 'runtime chapters')
    return {'status': 'passed', 'levelCount': len(levels), 'chapterCount': len(chapters),
            'levelsExport': levels_export, 'chaptersExport': chapters_export,
            'archiveOnlyFields': sorted(omitted)}


def verify_distance_data(source: str, export_name: str = 'pancakeDistances') -> dict[str, Any]:
    tables = extract_export(source, export_name)
    require(type(tables) is dict, 'runtime distance tables must be an object')
    require(set(tables) == {str(n) for n in range(MIN_SIZE, MAX_SIZE + 1)},
            'runtime distance tables must contain exactly sizes 3..8')
    reports = []
    total = 0
    for n in range(MIN_SIZE, MAX_SIZE + 1):
        table = tables[str(n)]
        require(type(table) is str and len(table) == factorial(n), f'n={n}: incorrect distance table length')
        require(all('0' <= char <= '9' for char in table), f'n={n}: table contains nondigit values')
        graph = distances(n)
        # Lexicographic itertools order provides Lehmer ranks without importing,
        # reproducing, or relying on the author's rank implementation.
        for rank, state in enumerate(permutations(range(1, n + 1))):
            require(int(table[rank]) == graph[state],
                    f'n={n}, rank={rank}, stack={state}: runtime distance {table[rank]} != BFS {graph[state]}')
        reports.append({'size': n, 'entriesChecked': len(table), 'status': 'passed'})
        total += len(table)
    require(total == EXPECTED_STATES, 'wrong total distance table entries')
    return {'status': 'passed', 'entriesChecked': total, 'export': export_name, 'sizes': reports}


def _unique_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in pairs:
        require(key not in result, f'duplicate JSON object key: {key}')
        result[key] = value
    return result


def _reject_constant(value: str) -> Any:
    raise VerificationError(f'nonfinite JSON {value}')


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=_unique_pairs,
                      parse_constant=_reject_constant)


def source_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args: argparse.Namespace) -> dict[str, Any]:
    began = time.monotonic()
    repo = Path(args.repo).resolve()
    campaign_path = repo / 'docs/pancake/campaign.json'
    levels_path = repo / 'src/games/pancakeLevels.ts'
    distance_path = repo / 'src/games/pancakeDistances.ts'
    report: dict[str, Any] = {
        'verifier': 'independent-python-prefix-reversal-bfs', 'schemaVersion': 1,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'scope': 'All n! permutations for n=3..8, every legal edge, corpus certificates, static runtime-data equality',
        'notCovered': ['browser interactions', 'visual accessibility', 'device testing'],
    }
    try:
        report['graphValidation'] = verify_graphs()
        campaign = read_json(campaign_path)
        report['corpusValidation'] = verify_campaign(campaign, args.expect_count)
        report['runtimeDataValidation'] = verify_runtime_data(campaign, levels_path.read_text(encoding='utf-8'),
                                                            args.levels_export, args.chapters_export)
        report['runtimeDistanceValidation'] = verify_distance_data(distance_path.read_text(encoding='utf-8'), args.distances_export)
        if args.expect_chapter_counts:
            expected_counts = [int(value) for value in args.expect_chapter_counts.split(',')]
            actual_counts = [sum(level['chapter'] == i for level in campaign['levels']) for i in range(len(campaign['chapters']))]
            exact(actual_counts, expected_counts, 'expected chapter counts')
        report['sourceSha256'] = {str(p.relative_to(repo)): source_hash(p) for p in [campaign_path, levels_path, distance_path]}
        if args.self_test:
            log = io.StringIO()
            suite = unittest.defaultTestLoader.discover(str(Path(__file__).parent), pattern='test_*.py')
            test_names = []
            def collect_tests(group):
                for test in group:
                    if isinstance(test, unittest.TestSuite):
                        collect_tests(test)
                    else:
                        test_names.append(test.id())
            collect_tests(suite)
            result = unittest.TextTestRunner(stream=log, verbosity=1).run(suite)
            report['verifierTests'] = {'status': 'passed' if result.wasSuccessful() else 'failed',
                                       'testsRun': result.testsRun,
                                       'negativeMutationTests': sum('mutation' in name for name in test_names),
                                       'testNames': test_names, 'log': log.getvalue()}
            require(result.wasSuccessful(), 'independent verifier self-tests failed')
        report['status'] = 'passed'
    except (VerificationError, OSError, json.JSONDecodeError) as error:
        report['status'] = 'failed'
        report['error'] = str(error)
    review_path = Path(__file__).parent / 'source-review.json'
    if review_path.is_file():
        source_review = read_json(review_path)
        changed_sources = [path for path, digest in source_review.get('sourceSha256', {}).items()
                           if not (repo / path).is_file() or source_hash(repo / path) != digest]
        if changed_sources:
            source_review['status'] = 'stale_needs_recheck'
            source_review['changedSinceReview'] = changed_sources
        report['sourceReview'] = source_review
    report['elapsedSeconds'] = round(time.monotonic() - began, 3)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true', help='include verifier tests and negative mutations in the JSON report')
    parser.add_argument('--repo', default='.')
    parser.add_argument('--expect-count', type=int)
    parser.add_argument('--levels-export', default='pancakeLevels')
    parser.add_argument('--chapters-export', default='pancakeChapters')
    parser.add_argument('--distances-export', default='pancakeDistances')
    parser.add_argument('--expect-chapter-counts', help='comma-separated exact counts, e.g. 8,12,18,24,26,32')
    parser.add_argument('--output', default='/tmp/pancake-independent-report.json')
    args = parser.parse_args()
    report = run(args)
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: report[k] for k in ('status', 'elapsedSeconds', 'error') if k in report}, ensure_ascii=False))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
