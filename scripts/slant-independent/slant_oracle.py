#!/usr/bin/env python3
"""Independent, standard-library-only Slant oracle.

No application module is imported. The search interface accepts only board size
and vertex clues, never a supplied solution. Slash encoding here is literal:
'\\' connects NW-SE; '/' connects NE-SW. None is an unclued vertex.
"""
from __future__ import annotations
from dataclasses import dataclass
from itertools import product
from time import perf_counter
from typing import Iterable


@dataclass(frozen=True)
class Puzzle:
    rows: int
    cols: int
    clues: tuple[tuple[int | None, ...], ...]

    def __post_init__(self):
        if type(self.rows) is not int or type(self.cols) is not int or min(self.rows, self.cols) < 1:
            raise ValueError('Cell dimensions must be positive integers')
        if len(self.clues) != self.rows + 1 or any(len(row) != self.cols + 1 for row in self.clues):
            raise ValueError('Clues must have (rows+1) by (cols+1) vertices')
        for row in self.clues:
            for clue in row:
                if clue is not None and (type(clue) is not int or not 0 <= clue <= 4):
                    raise ValueError('Clues must be None or integer 0..4')


def endpoints(rows: int, cols: int, index: int, slash: str) -> tuple[int, int]:
    r, c = divmod(index, cols)
    stride = cols + 1
    if slash == '\\':
        return r * stride + c, (r + 1) * stride + c + 1
    if slash == '/':
        return r * stride + c + 1, (r + 1) * stride + c
    raise ValueError('Every cell must contain a literal slash or backslash')


def validate_solution(puzzle: Puzzle, board: str) -> dict:
    """Separate graph traversal validation; does not use search propagation/DSU."""
    errors = []
    if not isinstance(board, str) or len(board) != puzzle.rows * puzzle.cols:
        return {'valid': False, 'errors': ['Wrong solution length/type']}
    if any(s not in '/\\' for s in board):
        return {'valid': False, 'errors': ['Bad solution symbol']}
    vertex_count = (puzzle.rows + 1) * (puzzle.cols + 1)
    adjacency = [[] for _ in range(vertex_count)]
    for i, slash in enumerate(board):
        a, b = endpoints(puzzle.rows, puzzle.cols, i, slash)
        adjacency[a].append(b)
        adjacency[b].append(a)
    for r in range(puzzle.rows + 1):
        for c in range(puzzle.cols + 1):
            clue = puzzle.clues[r][c]
            degree = len(adjacency[r * (puzzle.cols + 1) + c])
            if clue is not None and degree != clue:
                errors.append(f'Clue ({r},{c}) expected {clue}, got {degree}')
    # Undirected DFS: a visited neighbor other than the tree parent closes a cycle.
    seen = set()
    cycle = False
    for start in range(vertex_count):
        if start in seen:
            continue
        seen.add(start)
        stack = [(start, -1, iter(adjacency[start]))]
        while stack:
            vertex, parent, neighbors = stack[-1]
            try:
                neighbor = next(neighbors)
            except StopIteration:
                stack.pop()
                continue
            if neighbor == parent:
                continue
            if neighbor in seen:
                cycle = True
            else:
                seen.add(neighbor)
                stack.append((neighbor, vertex, iter(adjacency[neighbor])))
    if cycle:
        errors.append('Diagonal graph contains a cycle')
    return {'valid': not errors, 'errors': errors, 'hasCycle': cycle}


def solve(puzzle: Puzzle, limit: int = 2, timeout_seconds: float | None = None) -> dict:
    """Enumerate clue-consistent forests, stopping only after `limit` witnesses.

    Domains contain two bits (1 = backslash, 2 = slash). Exact-degree bounds
    force incident bits. Chosen diagonals build a disjoint-set forest; any
    possible edge whose endpoints are already joined is forbidden. Branching
    covers both remaining orientations. All pruning rules are necessary
    conditions, so exhausted search with one witness establishes uniqueness.
    """
    if type(limit) is not int or limit < 1:
        raise ValueError('Limit must be a positive integer')
    started = perf_counter()
    if timeout_seconds is not None and timeout_seconds <= 0:
        raise ValueError('Timeout must be positive')
    deadline = None if timeout_seconds is None else started + timeout_seconds
    class SearchTimeout(Exception):
        pass
    def check_deadline():
        if deadline is not None and perf_counter() >= deadline:
            raise SearchTimeout()
    nr, nc = puzzle.rows, puzzle.cols
    nv, n = (nr + 1) * (nc + 1), nr * nc
    ends = [[endpoints(nr, nc, i, s) for s in ('\\', '/')] for i in range(n)]
    incidence = [[] for _ in range(nv)]
    for cell, orientations in enumerate(ends):
        for bit_index, pair in enumerate(orientations):
            for vertex in pair:
                incidence[vertex].append((cell, 1 << bit_index))
    constrained = [(r * (nc + 1) + c, clue) for r, row in enumerate(puzzle.clues)
                   for c, clue in enumerate(row) if clue is not None]
    neighbors = [set() for _ in range(n)]
    cell_weight = [0] * n
    for vertex, clue in constrained:
        for cell, bit in incidence[vertex]:
            cell_weight[cell] += 5 - len(incidence[vertex])
            neighbors[cell].update(i for i, _ in incidence[vertex] if i != cell)
    stats = {'nodes': 0, 'branches': 0, 'degreeContradictions': 0,
             'cycleContradictions': 0, 'forcedDegree': 0, 'forcedCycle': 0,
             'maxDepth': 0}
    solutions = []

    def propagate(domains):
        changed = True
        while changed:
            check_deadline()
            changed = False
            for vertex, target in constrained:
                incidents = incidence[vertex]
                guaranteed = sum(domains[cell] == bit for cell, bit in incidents)
                possible = sum(bool(domains[cell] & bit) for cell, bit in incidents)
                if target < guaranteed or target > possible:
                    stats['degreeContradictions'] += 1
                    return False
                if target == guaranteed or target == possible:
                    for cell, bit in incidents:
                        if domains[cell] != 3:
                            continue
                        domains[cell] = (3 ^ bit) if target == guaranteed else bit
                        stats['forcedDegree'] += 1
                        changed = True
            parent = list(range(nv))
            size = [1] * nv
            def root(v):
                while parent[v] != v:
                    v = parent[v]
                return v
            for cell, mask in enumerate(domains):
                if mask == 3:
                    continue
                a, b = ends[cell][0 if mask == 1 else 1]
                a, b = root(a), root(b)
                if a == b:
                    stats['cycleContradictions'] += 1
                    return False
                if size[a] < size[b]:
                    a, b = b, a
                parent[b] = a
                size[a] += size[b]
            # Simultaneous removals are sound. Rebuild forest next iteration.
            for cell, mask in enumerate(domains):
                if mask != 3:
                    continue
                for orientation, (a, b) in enumerate(ends[cell]):
                    if root(a) == root(b):
                        domains[cell] &= ~(1 << orientation)
                if not domains[cell]:
                    stats['cycleContradictions'] += 1
                    return False
                if domains[cell] != 3:
                    stats['forcedCycle'] += 1
                    changed = True
        return True

    def visit(domains, depth):
        if len(solutions) >= limit:
            return
        stats['nodes'] += 1
        stats['maxDepth'] = max(stats['maxDepth'], depth)
        if not propagate(domains):
            return
        undecided = [i for i, mask in enumerate(domains) if mask == 3]
        if not undecided:
            solutions.append(''.join('\\' if mask == 1 else '/' for mask in domains))
            return
        chosen = max(undecided, key=lambda i: (cell_weight[i] + sum(domains[j] != 3 for j in neighbors[i]), -i))
        stats['branches'] += 1
        for orientation in (1, 2):
            candidate = domains.copy()
            candidate[chosen] = orientation
            visit(candidate, depth + 1)
            if len(solutions) >= limit:
                break

    timed_out = False
    try:
        visit([3] * n, 0)
    except SearchTimeout:
        timed_out = True
    exhausted = not timed_out and len(solutions) < limit
    status = ('timeout' if timed_out else 'unsatisfiable' if not solutions else
              'unique' if exhausted and len(solutions) == 1 else
              'multiple' if len(solutions) >= 2 else 'inconclusive')
    return {'count': len(solutions), 'cutoffReached': len(solutions) >= limit,
            'status': status, 'timedOut': timed_out,
            'exhausted': exhausted, 'solutions': solutions,
            'seconds': perf_counter() - started, 'stats': stats}


def brute_solutions(puzzle: Puzzle) -> list[str]:
    """Deliberately unpruned enumerator for small-board oracle self-tests."""
    return [''.join(board) for board in product('\\/', repeat=puzzle.rows * puzzle.cols)
            if validate_solution(puzzle, ''.join(board))['valid']]


def transform(puzzle: Puzzle, turns: int, mirror: bool, board: str | None = None):
    """D4 action on vertices; odd rotations swap rectangular dimensions."""
    if turns not in range(4):
        raise ValueError('Quarter turns must be 0..3')
    height, width = puzzle.rows, puzzle.cols
    def coordinate(r, c):
        h, w = height, width
        if mirror:
            c = w - c
        for _ in range(turns):
            r, c = c, h - r
            h, w = w, h
        return r, c
    out_h, out_w = (width, height) if turns % 2 else (height, width)
    clues = [[None] * (out_w + 1) for _ in range(out_h + 1)]
    for r in range(height + 1):
        for c in range(width + 1):
            rr, cc = coordinate(r, c)
            clues[rr][cc] = puzzle.clues[r][c]
    output = Puzzle(out_h, out_w, tuple(tuple(row) for row in clues))
    if board is None:
        return output, None
    if len(board) != height * width or any(s not in '/\\' for s in board):
        raise ValueError('Invalid transform board')
    transformed_board = [None] * (out_h * out_w)
    for i, slash in enumerate(board):
        a, b = endpoints(height, width, i, slash)
        ar, ac = coordinate(*divmod(a, width + 1))
        br, bc = coordinate(*divmod(b, width + 1))
        rr, cc = min(ar, br), min(ac, bc)
        new_slash = '\\' if (ar - br) * (ac - bc) > 0 else '/'
        index = rr * out_w + cc
        if transformed_board[index] is not None:
            raise AssertionError('Non-bijective D4 transform')
        transformed_board[index] = new_slash
    return output, ''.join(transformed_board)


def puzzle_key(puzzle: Puzzle) -> str:
    return f'{puzzle.rows}x{puzzle.cols}:' + ';'.join(
        ','.join('.' if clue is None else str(clue) for clue in row) for row in puzzle.clues)


def canonical_key(puzzle: Puzzle) -> str:
    return min(puzzle_key(transform(puzzle, turns, mirror)[0])
               for mirror in (False, True) for turns in range(4))
