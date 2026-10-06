#!/usr/bin/env python3
"""Independent Same Game campaign verifier; Python stdlib only.

This file never imports or executes the generator or game implementation. Its
model is a tuple of variable-height, bottom-up columns. Connected components are
flood-filled; all reachable positions are enumerated, then solved by increasing
remaining tile count. No singleton or other losing-position shortcut is used.

The transposition key encodes column heights plus sorted per-color occupancy
bitsets, considering the two orders of occupied columns. This is deliberately
independent of the author's digit-renaming key. Rotations/vertical flips are NOT
symmetries. Exceeding ANY budget raises VerificationError, never "losing".
"""
from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass
from itertools import permutations
import json
from pathlib import Path
import re
import sys
import time
from typing import Any

Columns = tuple[tuple[int, ...], ...]
Cell = tuple[int, int]
Group = frozenset[Cell]
Key = tuple[tuple[int, ...], tuple[int, ...]]


class VerificationError(Exception):
    pass


class BudgetExceeded(VerificationError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def exact(actual: Any, expected: Any, label: str) -> None:
    """Type-sensitive comparison also rejects booleans masquerading as numbers."""
    if type(actual) is not type(expected):
        raise VerificationError(f'{label}: type {type(actual).__name__}, expected {type(expected).__name__}')
    if isinstance(expected, dict):
        require(actual.keys() == expected.keys(), f'{label}: keys differ ({actual.keys()} vs {expected.keys()})')
        for key in expected:
            exact(actual[key], expected[key], f'{label}.{key}')
    elif isinstance(expected, list):
        require(len(actual) == len(expected), f'{label}: length differs')
        for index, (a, e) in enumerate(zip(actual, expected)):
            exact(a, e, f'{label}[{index}]')
    else:
        require(actual == expected, f'{label}: {actual!r}, independently expected {expected!r}')


def from_board(board: list[int], width: int, height: int, colors: int = 4) -> Columns:
    require(type(width) is int and type(height) is int and 1 <= width <= 6 and 1 <= height <= 7, 'invalid dimensions')
    require(type(colors) is int and 1 <= colors <= 4, 'invalid colors')
    require(type(board) is list and len(board) == width * height, 'invalid board length')
    require(all(type(v) is int and -1 <= v < colors for v in board), 'invalid tile value')
    columns: list[tuple[int, ...]] = []
    empty_seen = False
    for x in range(width):
        values = tuple(board[(height - 1 - y) * width + x] for y in range(height))
        occupied = tuple(v for v in values if v >= 0)
        require(values == occupied + (-1,) * (height - len(occupied)), 'board has a gravity hole')
        if occupied:
            require(not empty_seen, 'board has an unpacked empty column')
            columns.append(occupied)
        else:
            empty_seen = True
    return tuple(columns)


def to_board(columns: Columns, width: int, height: int) -> list[int]:
    board = [-1] * (width * height)
    for x, col in enumerate(columns):
        for y, value in enumerate(col):
            board[(height - y - 1) * width + x] = value
    return board


def components(columns: Columns) -> list[Group]:
    remaining = {(x, y) for x, col in enumerate(columns) for y in range(len(col))}
    found: list[Group] = []
    while remaining:
        origin = remaining.pop()
        stack = [origin]
        component = {origin}
        color = columns[origin[0]][origin[1]]
        while stack:
            x, y = stack.pop()
            for p in ((x, y - 1), (x, y + 1), (x - 1, y), (x + 1, y)):
                if p in remaining and columns[p[0]][p[1]] == color:
                    remaining.remove(p)
                    component.add(p)
                    stack.append(p)
        found.append(frozenset(component))
    return found


def representative(group: Group, width: int, height: int) -> int:
    return min((height - y - 1) * width + x for x, y in group)


def legal_groups(columns: Columns, width: int, height: int) -> list[Group]:
    return sorted((g for g in components(columns) if len(g) >= 2), key=lambda g: representative(g, width, height))


def remove(columns: Columns, group: Group) -> Columns:
    # Stable deletion within each column implements downward gravity; discarding
    # zero-length columns implements a left shift without any color matching.
    result = []
    for x, col in enumerate(columns):
        survivors = tuple(v for y, v in enumerate(col) if (x, y) not in group)
        if survivors:
            result.append(survivors)
    return tuple(result)


def play_index(columns: Columns, width: int, height: int, index: int) -> Columns:
    require(type(index) is int and 0 <= index < width * height, 'invalid move index')
    selected = (index % width, height - 1 - index // width)
    group = next((g for g in legal_groups(columns, width, height) if selected in g), None)
    require(group is not None, f'illegal move at index {index}')
    return remove(columns, group)


def canonical(columns: Columns) -> Key:
    def occupancy(ordered: Columns) -> Key:
        masks: dict[int, int] = {}
        offset = 0
        for col in ordered:
            for value in col:
                masks[value] = masks.get(value, 0) | (1 << offset)
                offset += 1
        return tuple(map(len, ordered)), tuple(sorted(masks.values()))
    return min(occupancy(columns), occupancy(columns[::-1]))


def archive_key(columns: Columns) -> str:
    """Check the published key via every bijection, not author's first-seen map."""
    colors = sorted({value for col in columns for value in col})
    alternatives = []
    for ordering in permutations(range(len(colors))):
        mapping = dict(zip(colors, ordering))
        for direction in (columns, columns[::-1]):
            alternatives.append('.'.join(''.join(str(mapping[value]) for value in col) for col in direction))
    return min(alternatives)


def merge_evidence(columns: Columns, group: Group) -> dict[str, int]:
    membership = {cell: index for index, comp in enumerate(components(columns)) for cell in comp}
    # Track origin coordinates explicitly through gravity and horizontal packing.
    fallen = [tuple((x, y) for y in range(len(col)) if (x, y) not in group) for x, col in enumerate(columns)]
    def same_color(a: Cell, b: Cell) -> bool:
        return columns[a[0]][a[1]] == columns[b[0]][b[1]]
    gravity = 0
    for x, column in enumerate(fallen):
        for y, origin in enumerate(column):
            if y + 1 < len(column):
                other = column[y + 1]
                gravity += int(same_color(origin, other) and membership[origin] != membership[other])
            if x + 1 < len(fallen) and y < len(fallen[x + 1]):
                other = fallen[x + 1][y]
                gravity += int(same_color(origin, other) and membership[origin] != membership[other])
    packed = [column for column in fallen if column]
    shifted = sum(int(b[0] - a[0] > 1 and same_color(a, b))
                  for left, right in zip(packed, packed[1:]) for a, b in zip(left, right))
    return {'gravityJoins': gravity, 'columnJoins': shifted, 'emptiedColumns': sum(not col for col in fallen)}


@dataclass
class Node:
    columns: Columns
    children: tuple[Key, ...] = ()
    win: bool = False


@dataclass
class SearchBudget:
    node_cap: int = 50000
    deadline: float = float('inf')
    def check(self, count: int) -> None:
        if count > self.node_cap:
            raise BudgetExceeded(f'node budget exceeded ({count} > {self.node_cap}); result UNKNOWN')
        if time.monotonic() >= self.deadline:
            raise BudgetExceeded('time budget exceeded; result UNKNOWN')


def enumerate_dag(columns: Columns, width: int, height: int, budget: SearchBudget) -> dict[Key, Node]:
    root = canonical(columns)
    nodes = {root: Node(columns)}
    pending = [root]
    while pending:
        budget.check(len(nodes))
        node = nodes[pending.pop()]
        child_keys = []
        for group in legal_groups(node.columns, width, height):
            child = remove(node.columns, group)
            key = canonical(child)
            child_keys.append(key)
            if key not in nodes:
                budget.check(len(nodes) + 1)
                nodes[key] = Node(child)
                pending.append(key)
        node.children = tuple(child_keys)
    # Every edge strictly reduces tiles. A bottom-up OR classification is exact,
    # even for nodes encountered previously through a reflected/renamed history.
    for node in sorted(nodes.values(), key=lambda item: sum(map(len, item.columns))):
        node.win = not node.columns or any(nodes[key].win for key in node.children)
    budget.check(len(nodes))
    return nodes


def recompute(level: dict[str, Any], budget: SearchBudget) -> dict[str, Any]:
    width, height = level['width'], level['height']
    original = from_board(level['board'], width, height, level['colors'])
    nodes = enumerate_dag(original, width, height, budget)
    require(nodes[canonical(original)].win, f"{level['id']}: no clearing solution")
    def outcomes(position: Columns) -> list[tuple[Group, Columns, bool]]:
        return [(g, child, nodes[canonical(child)].win)
                for g in legal_groups(position, width, height) for child in [remove(position, g)]]
    opening = outcomes(original)
    trace = []
    position = original
    solution = level['solution']
    require(type(solution) is list and 1 <= len(solution) <= width * height // 2, 'invalid certificate length')
    for index in solution:
        budget.check(len(nodes))
        choices = outcomes(position)
        chosen = next((row for row in choices if representative(row[0], width, height) == index), None)
        require(type(index) is int and chosen is not None, f"{level['id']}: illegal/nonrepresentative certificate move {index}")
        safe = [row for row in choices if row[2]]
        require(chosen[2], f"{level['id']}: certificate enters losing state")
        preferred = min(safe, key=lambda row: (len(row[0]), representative(row[0], width, height)))
        require(chosen == preferred, f"{level['id']}: certificate violates documented deterministic selection")
        largest = max(len(row[0]) for row in choices)
        trace.append({
            'tiles': sum(map(len, position)), 'legalGroups': len(choices),
            'winningGroups': len(safe), 'losingGroups': len(choices) - len(safe),
            'selectedIndex': index, 'selectedSize': len(chosen[0]), 'largestGroupSize': largest,
            'allLargestLose': not any(win for group, _, win in choices if len(group) == largest),
            **merge_evidence(position, chosen[0]),
        })
        position = chosen[1]
    require(not position, f"{level['id']}: certificate does not clear all tiles")
    frontier = Counter(sum(map(len, node.columns)) for node in nodes.values())
    greedy = original
    greedy_moves = []
    while moves := legal_groups(greedy, width, height):
        chosen = min(moves, key=lambda group: (-len(group), representative(group, width, height)))
        greedy_moves.append(representative(chosen, width, height))
        greedy = remove(greedy, chosen)
    metrics = {
        'reachableStates': len(nodes), 'winningStates': sum(node.win for node in nodes.values()),
        'losingStates': sum(not node.win for node in nodes.values()),
        'terminalLosingStates': sum(not node.win and not node.children for node in nodes.values()),
        'transitionEdges': sum(len(node.children) for node in nodes.values()),
        'remainingTileFrontier': {str(tiles): count for tiles, count in sorted(frontier.items())},
        'peakFrontier': max(frontier.values()),
        'mixedChoiceStates': sum(any(nodes[k].win for k in n.children) and any(not nodes[k].win for k in n.children) for n in nodes.values()),
        'openingGroups': len(opening), 'winningOpeningGroups': sum(row[2] for row in opening),
        'losingOpeningGroups': sum(not row[2] for row in opening),
        'openingDelayedTraps': sum(not win and bool(nodes[canonical(child)].children) for _, child, win in opening),
        'allLargestOpeningGroupsLose': not any(win for group, _, win in opening if len(group) == max(len(row[0]) for row in opening)),
        'certificateMoves': len(solution),
        'certificateMixedChoices': sum(row['losingGroups'] > 0 for row in trace),
        'certificateForcedSafeChoices': sum(row['winningGroups'] == 1 and row['losingGroups'] > 0 for row in trace),
        'certificateLargestTraps': sum(row['allLargestLose'] for row in trace),
        'certificateGravityMergeMoves': sum(row['gravityJoins'] > 0 for row in trace),
        'certificateColumnMergeMoves': sum(row['columnJoins'] > 0 for row in trace),
        'greedyLargestClears': not greedy, 'greedyLargestMoves': greedy_moves,
        'greedyLargestRemainingTiles': sum(map(len, greedy)),
    }
    return {'canonicalKey': archive_key(original), 'metrics': metrics, 'trace': trace,
            'openingOutcomes': [{'index': representative(g, width, height), 'size': len(g), 'outcome': 'clearable' if win else 'losing',
                                 'nextLegalGroups': len(nodes[canonical(child)].children)} for g, child, win in opening]}


def verify_level(level: dict[str, Any], budget: SearchBudget) -> dict[str, Any]:
    result = recompute(level, budget)
    for field, value in result.items():
        exact(level.get(field), value, f"{level['id']}.{field}")
    return result


def read_ts_array(source: str, name: str) -> list[dict[str, Any]]:
    match = re.search(r'export\s+const\s+' + re.escape(name) + r'(?:\s*:[^=]+)?\s*=\s*', source)
    require(match is not None, f'Cannot locate generated TS array {name}')
    value, end = json.JSONDecoder().raw_decode(source[match.end():])
    require(source[match.end() + end:].lstrip().startswith(';'), f'Expected JSON-only TS array {name}')
    require(type(value) is list, f'{name} must be an array')
    return value


def check_challenge(level: dict[str, Any], ordinal: int) -> None:
    c, m = level['chapter'], level['metrics']
    prefix = f"{level['id']}: chapter {c} challenge"
    require(m['openingGroups'] >= 2 and m['certificateMoves'] >= 3 and m['certificateMixedChoices'] >= 1 and m['reachableStates'] >= 10, prefix)
    if c == 0:
        require(m['certificateMoves'] <= 6, prefix + ' certificate length')
        require(m['winningOpeningGroups'] >= 2 if ordinal < 5 else m['losingOpeningGroups'] >= 1, prefix + ' opening choices')
        return
    thresholds = {1: (3, 1, 40, 5, 1), 2: (4, 2, 180, 20, 1), 3: (6, 3, 600, 60, 2), 4: (8, 4, 2500, 160, 2)}
    for field, threshold in zip(('certificateMixedChoices', 'certificateForcedSafeChoices', 'reachableStates', 'peakFrontier', 'openingDelayedTraps'), thresholds[c]):
        require(m[field] >= threshold, prefix + f' {field} below {threshold}')
    require(m['certificateGravityMergeMoves'] > 0, prefix + ' lacks gravity merge')
    if c >= 2:
        require(m['certificateColumnMergeMoves'] > 0, prefix + ' lacks column merge')
    if ordinal < (5 if c < 3 else 10):
        require(m['allLargestOpeningGroupsLose'], prefix + ' largest opening trap quota')
    require(not m['greedyLargestClears'], prefix + ' greedy must fail')


def stats(values: list[int]) -> dict[str, int | float]:
    values = sorted(values)
    median = (values[9] + values[10]) / 2
    return {'min': values[0], 'median': int(median) if median.is_integer() else median, 'max': values[-1]}


def verify_campaign(repo: Path, expected_count: int = 100, node_cap: int = 50000, seconds: float = 120) -> dict[str, Any]:
    started = time.monotonic()
    require(node_cap > 0 and seconds > 0, 'budgets must be positive')
    deadline = started + seconds
    campaign = json.loads((repo / 'docs/samegame/campaign.json').read_text())
    source = (repo / 'src/games/samegameLevels.ts').read_text()
    runtime = read_ts_array(source, 'samegameLevels')
    runtime_chapters = read_ts_array(source, 'samegameChapters')
    exact(campaign['version'], 1, 'version')
    levels = campaign['levels']
    require(len(levels) == expected_count == 100, 'campaign must contain exactly 100 levels')
    require(len(runtime) == len(levels), 'runtime level count differs')
    exact(runtime_chapters, campaign['chapters'], 'runtime chapters')
    exact([chapter['id'] for chapter in campaign['chapters']], list(range(5)), 'chapter IDs')
    require(len(campaign['generation']) == 100, 'generation records missing')
    canonical_seen: set[Key] = set()
    reports = []
    runtime_fields = {'id', 'title', 'chapter', 'width', 'height', 'colors', 'board', 'objective'}
    for i, (level, live, generation) in enumerate(zip(levels, runtime, campaign['generation'])):
        label = f'samegame-{i + 1:03d}'
        exact(level['id'], label, 'stable ID')
        exact(level['chapter'], i // 20, label + '.chapter')
        exact(live, {key: level[key] for key in runtime_fields}, label + '.runtime')
        exact(generation['id'], label, label + '.generation.id')
        require(type(generation['attempts']) is int and 1 <= generation['attempts'] <= 10000, label + ': invalid generation attempt count')
        require(all(v >= 0 for v in level['board']), label + ': initial board must be full')
        columns = from_board(level['board'], level['width'], level['height'], level['colors'])
        require(set(v for col in columns for v in col) == set(range(level['colors'])), label + ': declared colors mismatch')
        key = canonical(columns)
        require(key not in canonical_seen, label + ': duplicate under color renaming/occupied-column reflection')
        canonical_seen.add(key)
        result = verify_level(level, SearchBudget(node_cap, deadline))
        check_challenge(level, i % 20)
        reports.append({'id': label, 'chapter': level['chapter'], **result['metrics']})
    chapters = []
    for chapter in campaign['chapters']:
        items = [r for r in reports if r['chapter'] == chapter['id']]
        fields = ('reachableStates', 'peakFrontier', 'certificateMoves', 'certificateMixedChoices', 'certificateForcedSafeChoices', 'openingDelayedTraps', 'certificateGravityMergeMoves', 'certificateColumnMergeMoves')
        chapters.append({'chapter': chapter['id'], 'title': chapter['title'], 'count': len(items),
                         **{field: stats([r[field] for r in items]) for field in fields},
                         'strictLargestOpeningCounterexamples': sum(r['allLargestOpeningGroupsLose'] for r in items),
                         'deterministicLargestGreedyFailures': sum(not r['greedyLargestClears'] for r in items)})
    exact(campaign['chapterMetrics'], chapters, 'chapterMetrics')
    return {'status': 'PASS', 'levels': len(levels), 'uniqueBoards': len(canonical_seen),
            'reachableStates': sum(r['reachableStates'] for r in reports),
            'transitionEdges': sum(r['transitionEdges'] for r in reports),
            'openingBranches': sum(r['openingGroups'] for r in reports),
            'losingOpeningBranches': sum(r['losingOpeningGroups'] for r in reports),
            'certificateMoves': sum(r['certificateMoves'] for r in reports),
            'seconds': round(time.monotonic() - started, 3), 'nodeCapPerLevel': node_cap, 'timeoutSeconds': seconds,
            'chapters': chapters}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--expect-count', type=int, default=100)
    parser.add_argument('--node-cap', type=int, default=50000)
    parser.add_argument('--timeout-seconds', type=float, default=120)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        report = verify_campaign(args.repo, args.expect_count, args.node_cap, args.timeout_seconds)
    except (VerificationError, OSError, ValueError, KeyError, TypeError) as error:
        report = {'status': 'FAIL', 'error': str(error), 'budgetExhausted': isinstance(error, BudgetExceeded)}
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + '\n')
    print(text)
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    sys.exit(main())
