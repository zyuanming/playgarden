#!/usr/bin/env python3
"""Independent Signpost review: number-position CSP, not a route-prefix solver.

No imports from the author generator or TypeScript solver. Runtime puzzle data is
parsed from the literal export; certificates are read only after enumeration.
"""
import argparse
import hashlib
import itertools
import json
import time
from pathlib import Path

DIRECTIONS = ((0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1))


def validate_puzzle(p):
    w, h = p['width'], p['height']
    assert type(w) is int and type(h) is int and 1 <= w <= 20 and 1 <= h <= 20
    n = w * h
    assert len(p['arrows']) == len(p['clues']) == n
    assert all(type(x) is int and -1 <= x < 8 for x in p['arrows'])
    assert all(type(x) is int and 0 <= x <= n for x in p['clues'])
    clues = [x for x in p['clues'] if x]
    assert len(clues) == len(set(clues)) and 1 in clues and n in clues
    assert [i for i, a in enumerate(p['arrows']) if a == -1] == [p['clues'].index(n)]


def points(p, a, b):
    """Vector collinearity + positive dot product; no ray-traversal code."""
    n = p['width'] * p['height']
    if not (0 <= a < n and 0 <= b < n) or a == b or p['arrows'][a] < 0 or p['clues'][a] == n:
        return False
    dx = b % p['width'] - a % p['width']
    dy = b // p['width'] - a // p['width']
    ax, ay = DIRECTIONS[p['arrows'][a]]
    return dx * ay == dy * ax and dx * ax + dy * ay > 0


def partial(p, links):
    """Independent difference-equation oracle for local state validity.

    Each edge means number[v]-number[u]=1. Propagate potentials over an
    undirected graph, then reconcile anchors; this is not a chain-head walk.
    Unanchored components may remain globally unsatisfiable, as the UI allows.
    """
    n = p['width'] * p['height']
    bad = {'valid': False, 'won': False}
    if len(links) != n or any(type(x) is not int or x < -1 or x >= n for x in links):
        return bad
    incoming = [0] * n
    graph = [[] for _ in range(n)]
    for a, b in enumerate(links):
        if b == -1:
            continue
        if not points(p, a, b):
            return bad
        incoming[b] += 1
        if incoming[b] > 1:
            return bad
        graph[a].append((b, 1))
        graph[b].append((a, -1))
    potentials = {}
    numbers = [0] * n
    groups = 0
    for root in range(n):
        if root in potentials:
            continue
        groups += 1
        potentials[root] = 0
        stack = [root]
        members = []
        offsets = set()
        while stack:
            a = stack.pop()
            members.append(a)
            if p['clues'][a]:
                offsets.add(p['clues'][a] - potentials[a])
            for b, step in graph[a]:
                v = potentials[a] + step
                if b in potentials:
                    if potentials[b] != v:
                        return bad
                else:
                    potentials[b] = v
                    stack.append(b)
        if len(offsets) > 1:
            return bad
        if offsets:
            offset = offsets.pop()
            for a in members:
                numbers[a] = offset + potentials[a]
                if not 1 <= numbers[a] <= n:
                    return bad
    assigned = [x for x in numbers if x]
    if len(assigned) != len(set(assigned)):
        return bad
    return {'valid': True, 'won': len(assigned) == n and groups == 1, 'numbers': numbers}


def enumerate_solutions(p, limit=2, fixed=None):
    """AC propagation of number->cell domains, with MRV branching.

    Constraints: allDifferent(cell), fixed numerical anchors, and binary ray
    relation for every adjacent number pair. Stops at the second solution.
    """
    validate_puzzle(p)
    n = p['width'] * p['height']
    successors = [sum(1 << b for b in range(n) if points(p, a, b)) for a in range(n)]
    if fixed is not None:
        if not partial(p, fixed)['valid']:
            return [], 0
        pred = {b: a for a, b in enumerate(fixed) if b >= 0}
        successors = [sum(1 << b for b in range(n) if (successors[a] >> b) & 1 and (fixed[a] < 0 or fixed[a] == b) and (b not in pred or pred[b] == a)) for a in range(n)]
    anchor = {v - 1: i for i, v in enumerate(p['clues']) if v}
    free = sum(1 << i for i, v in enumerate(p['clues']) if not v)
    domains = [(1 << anchor[k]) if k in anchor else free for k in range(n)]
    solutions = []
    nodes = 0

    def cells(mask):
        while mask:
            bit = mask & -mask
            yield bit.bit_length() - 1
            mask ^= bit

    def propagate(d):
        while True:
            before = tuple(d)
            singles = [x for x in d if x.bit_count() == 1]
            if len(singles) != len(set(singles)):
                return False
            taken = sum(singles)
            for k, mask in enumerate(d):
                if mask.bit_count() > 1:
                    d[k] &= ~taken
                if not d[k]:
                    return False
            # Each cell must have some numeric position; one supported position
            # is a hidden singleton under allDifferent.
            for cell in range(n):
                bit = 1 << cell
                positions = [k for k in range(n) if d[k] & bit]
                if not positions:
                    return False
                if len(positions) == 1:
                    d[positions[0]] = bit
            for k in range(n - 1):
                supported_a = 0
                supported_b = 0
                for a in cells(d[k]):
                    targets = successors[a] & d[k + 1]
                    if targets:
                        supported_a |= 1 << a
                        supported_b |= targets
                d[k] &= supported_a
                d[k + 1] &= supported_b
                if not d[k] or not d[k + 1]:
                    return False
            if tuple(d) == before:
                return True

    def search(d):
        nonlocal nodes
        nodes += 1
        if not propagate(d):
            return
        candidates = [(v.bit_count(), k) for k, v in enumerate(d) if v.bit_count() > 1]
        if not candidates:
            solutions.append([mask.bit_length() - 1 for mask in d])
            return
        _, k = min(candidates)
        for cell in cells(d[k]):
            child = d.copy()
            child[k] = 1 << cell
            search(child)
            if len(solutions) >= limit:
                return

    search(domains)
    return solutions, nodes


def valid_certificate(p, path):
    n = p['width'] * p['height']
    if len(path) != n or any(type(x) is not int for x in path) or set(path) != set(range(n)):
        return False
    return all(not p['clues'][a] or p['clues'][a] == k + 1 for k, a in enumerate(path)) and all(points(p, a, b) for a, b in zip(path, path[1:]))


def signature(p):
    """Canonicalize labeled boards under rotations/reflections, including rectangles."""
    w, h = p['width'], p['height']
    forms = []
    for swap, sx, sy in itertools.product((False, True), (-1, 1), (-1, 1)):
        nw, nh = (h, w) if swap else (w, h)
        board = [None] * (w * h)
        for i, arrow in enumerate(p['arrows']):
            x, y = i % w, i // w
            if swap:
                x, y = y, x
            x = x if sx == 1 else nw - 1 - x
            y = y if sy == 1 else nh - 1 - y
            if arrow < 0:
                transformed = -1
            else:
                dx, dy = DIRECTIONS[arrow]
                if swap:
                    dx, dy = dy, dx
                transformed = DIRECTIONS.index((sx * dx, sy * dy))
            board[y * nw + x] = (transformed, p['clues'][i])
        forms.append((nw, nh, tuple(board)))
    return repr(min(forms))


def read_runtime(repo):
    text = (repo / 'src/games/signpostLevels.ts').read_text()
    literal = text.split('export const signpostLevels: SignpostLevel[] = ', 1)[1].strip()
    return json.loads(literal.removesuffix(';'))


def review(repo):
    levels = read_runtime(repo)
    assert len(levels) == 30
    assert [p['id'] for p in levels] == [f'signpost-{i:02}' for i in range(1, 31)]
    assert [sum(p['chapter'] == k for p in levels) for k in range(5)] == [6] * 5
    assert len({signature(p) for p in levels}) == len(levels), 'symmetry duplicate'
    rows = []
    unique_paths = []
    for p in levels:
        started = time.perf_counter()
        paths, nodes = enumerate_solutions(p)
        assert len(paths) == 1, f"{p['id']}: {len(paths)} solutions (capped at 2)"
        path = paths[0]
        assert valid_certificate(p, path)
        unique_paths.append(path)
        n, w = len(path), p['width']
        local = []
        wrong = []
        for a in range(n):
            targets = []
            for b in range(n):
                state = [-1] * n
                state[a] = b
                if partial(p, state)['valid']:
                    targets.append(b)
                    if a not in path[:-1] or path[path.index(a) + 1] != b:
                        wrong.append([a, b])
            if len(targets) > 1:
                local.append({'from': a, 'targets': targets})
        jumps = sum(max(abs(a % w - b % w), abs(a // w - b // w)) > 1 for a, b in zip(path, path[1:]))
        diagonals = sum(a % w != b % w and a // w != b // w for a, b in zip(path, path[1:]))
        assert len(local) >= 2 and jumps >= 2 and diagonals >= 2
        rows.append({'id': p['id'], 'solutions_capped_at_two': len(paths), 'nodes': nodes, 'milliseconds': round((time.perf_counter() - started) * 1000, 2), 'solution': path, 'initial_local_choice_cells': local, 'locally_accepted_wrong_edges': wrong, 'long_jumps': jumps, 'diagonals': diagonals})
    # Certificates are not an input to the search above.
    proofs = json.loads((repo / 'docs/signpost/campaign.json').read_text())['levels']
    assert len(proofs) == len(levels)
    for p, proof, path in zip(levels, proofs, unique_paths):
        assert all(proof[key] == value for key, value in p.items()), p['id'] + ': runtime/campaign mismatch'
        assert valid_certificate(p, proof['solution']) and proof['solution'] == path
    source = repo / 'vendor/sgtatham-signpost'
    meta = json.loads((source / 'source.json').read_text())
    for entry in meta['files']:
        data = (source / entry['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry['sha256']
        blob = b'blob ' + str(len(data)).encode() + b'\0' + data
        assert hashlib.sha1(blob).hexdigest() == entry['gitBlob']
    return {'method': 'independent number-position CSP with allDifferent and bidirectional adjacency arc consistency; no author solver/generator imports', 'count': len(rows), 'all_unique': True, 'all_certificates_match': True, 'symmetry_duplicates': 0, 'vendor_hashes_match': True, 'levels': rows}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default='.')
    ap.add_argument('--output', default='/tmp/signpost-independent-report.json')
    args = ap.parse_args()
    report = review(Path(args.repo))
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f"Signpost independent: {report['count']} unique puzzles; certificates, symmetry, decision gates and vendor hashes passed; {args.output}")


if __name__ == '__main__':
    main()
