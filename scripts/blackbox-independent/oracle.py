"""Independent coordinate-based Black Box oracle; no production imports.

Cell indices are row-major. Ports are N west->east, E north->south,
S west->east, W north->south. Responses: -1 absorption, -2 reflection, >=0 exit.
All state transitions re-check at the same cell after a turn.
"""
from __future__ import annotations
from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import combinations
from math import log2
import json


class RayCycle(ValueError):
    pass


@dataclass(frozen=True)
class Ray:
    result: int
    states: tuple[tuple[int, int, int, int], ...]
    turns: int
    double_reflections: int
    entry_reflection: bool


def port_state(n: int, p: int) -> tuple[int, int, int, int]:
    if type(n) != int or n < 1 or type(p) != int or not 0 <= p < 4*n:
        raise ValueError("Port outside board")
    side, offset = divmod(p, n)
    return ((offset, -1, 0, 1), (n, offset, -1, 0),
            (offset, n, 0, -1), (-1, offset, 1, 0))[side]


def state_port(n: int, x: int, y: int) -> int:
    if y == -1 and 0 <= x < n:
        return x
    if x == n and 0 <= y < n:
        return n+y
    if y == n and 0 <= x < n:
        return 2*n+x
    if x == -1 and 0 <= y < n:
        return 3*n+y
    raise ValueError(f"Invalid boundary state {(x, y)}")


def checked_cells(n: int, cells) -> frozenset[int]:
    cells = tuple(cells)
    if type(n) != int or n < 1 or len(cells) != len(set(cells)) or any(type(c) != int or not 0 <= c < n*n for c in cells):
        raise ValueError("Invalid board or repeated cell")
    return frozenset(cells)


def trace(n: int, cells, port: int) -> Ray:
    cells = checked_cells(n, cells)
    stars = {(i % n, i // n) for i in cells}
    x, y, dx, dy = port_state(n, port)
    states = [(x, y, dx, dy)]
    turns = double = 0
    # Entry is a special outside state: head-on absorption wins over flanks.
    front = x+dx, y+dy
    if front in stars:
        return Ray(-1, tuple(states), 0, 0, False)
    if (front[0]+dy, front[1]-dx) in stars or (front[0]-dy, front[1]+dx) in stars:
        return Ray(-2, tuple(states), 0, 0, True)
    x, y = front
    seen = set()
    while True:
        state = x, y, dx, dy
        if state in seen:
            raise RayCycle(f"Ray cycle for n={n}, stars={sorted(cells)}, port={port}, state={state}")
        seen.add(state)
        states.append(state)
        front = x+dx, y+dy
        if not (0 <= front[0] < n and 0 <= front[1] < n):
            q = state_port(n, *front)
            return Ray(-2 if q == port else q, tuple(states), turns, double, False)
        if front in stars:
            return Ray(-1, tuple(states), turns, double, False)
        left = (front[0]+dy, front[1]-dx) in stars
        right = (front[0]-dy, front[1]+dx) in stars
        if left and right:
            dx, dy = -dx, -dy
            double += 1
            turns += 2
        elif left:
            dx, dy = -dy, dx
            turns += 1
        elif right:
            dx, dy = dy, -dx
            turns += 1
        else:
            x, y = front


def signature(n: int, cells) -> tuple[int, ...]:
    cells = checked_cells(n, cells)
    return tuple(trace(n, cells, p).result for p in range(4*n))


def d4_canonical(n: int, cells) -> tuple[int, ...]:
    forms = []
    for mirror in (False, True):
        for rotation in range(4):
            indices = []
            for c in cells:
                x, y = c%n, c//n
                if mirror:
                    x = n-1-x
                for _ in range(rotation):
                    x, y = n-1-y, x
                indices.append(y*n+x)
            forms.append(tuple(sorted(indices)))
    return min(forms)


class Universe:
    """Exact fixed-count layout universe; observations never contain hidden cells."""
    def __init__(self, n: int, k: int):
        if type(n) != int or not 1 <= n <= 5 or type(k) != int or not 0 <= k <= n*n:
            raise ValueError("Invalid universe dimensions")
        self.n, self.k = n, k
        self.layouts = tuple(combinations(range(n*n), k))
        self.signatures = tuple(signature(n, layout) for layout in self.layouts)
        self.groups = defaultdict(list)
        for i, sig in enumerate(self.signatures):
            self.groups[sig].append(i)

    def candidates(self, observations: dict[int, int]) -> tuple[int, ...]:
        for p, value in observations.items():
            if type(p) != int or not 0 <= p < self.n*4 or not (type(value) == int and -2 <= value < self.n*4):
                raise ValueError('Invalid observation')
        return tuple(i for i, sig in enumerate(self.signatures)
                     if all(sig[p] == value for p, value in observations.items()))

    def facts(self, candidates: tuple[int, ...]) -> dict:
        if not candidates:
            return {'contradiction': True, 'stars': [], 'empty': []}
        sets = [set(self.layouts[i]) for i in candidates]
        common = set.intersection(*sets)
        possible = set.union(*sets)
        return {'contradiction': False, 'stars': sorted(common),
                'empty': sorted(set(range(self.n*self.n))-possible)}

    def best_probe(self, observations: dict[int, int], candidates=None, policy="expected"):
        if policy not in ("expected", "minimax"):
            raise ValueError("Unknown probe policy")
        candidates = self.candidates(observations) if candidates is None else candidates
        if not candidates:
            return None
        choices = []
        for p in range(self.n*4):
            if p in observations:
                continue
            bins = Counter(self.signatures[i][p] for i in candidates)
            if len(bins) <= 1:
                continue
            # Expected candidates (sum of squares), then minimax; optional reverse.
            # Deterministic port-index tie break. No hidden-layout argument.
            worst, squares = max(bins.values()), sum(v*v for v in bins.values())
            cost = (squares, worst, p) if policy == "expected" else (worst, squares, p)
            entropy = -sum(v/len(candidates)*log2(v/len(candidates)) for v in bins.values())
            choices.append((cost, {'port': p, 'remaining': len(candidates),
                                  'worstRemaining': worst, 'sumSquares': squares, 'partitions': len(bins), 'expectedRemaining': squares/len(candidates),
                                  'entropy': entropy, 'outcomes': dict(bins)}))
        return min(choices, key=lambda pair: pair[0])[1] if choices else None

    def add_observation(self, observations: dict[int, int], p: int, value: int):
        out = dict(observations)
        if p in out and out[p] != value:
            raise ValueError('Conflicting observation')
        out[p] = value
        if value >= 0:
            if value in out and out[value] != p:
                raise ValueError('Conflicting reciprocal observation')
            out[value] = p
        return out

    def greedy_path(self, target_signature, observations=None) -> list[dict]:
        observations = dict(observations or {})
        path = []
        while True:
            candidates = self.candidates(observations)
            classes = {self.signatures[i] for i in candidates}
            if len(classes) <= 1:
                return path
            choice = self.best_probe(observations, candidates)
            if choice is None:
                raise AssertionError('Different full signatures must have a separating port')
            p = choice['port']
            observations = self.add_observation(observations, p, target_signature[p])
            path.append({'port':p, 'result':target_signature[p], 'before':len(candidates),
                         'after':len(self.candidates(observations))})


def universe_report(n: int, k: int) -> dict:
    universe = Universe(n, k)
    reciprocal = 0
    max_states = 0
    max_turns = 0
    multireflection_example = None
    for layout, sig in zip(universe.layouts, universe.signatures):
        for p, result in enumerate(sig):
            if result >= 0:
                assert result != p and sig[result] == p, (n, k, layout, p, result)
                reciprocal += 1
            ray = trace(n, layout, p)
            max_states = max(max_states, len(ray.states))
            max_turns = max(max_turns, ray.turns)
            if ray.turns >= 3 and multireflection_example is None:
                multireflection_example = {'cells':layout,'port':p,'result':result,'turns':ray.turns}
    collisions = [ids for ids in universe.groups.values() if len(ids)>1]
    return {'size':n, 'starCount':k, 'layouts':len(universe.layouts),
            'signatureClasses':len(universe.groups),
            'uniqueLayouts':sum(len(ids)==1 for ids in universe.groups.values()),
            'ambiguousClasses':len(collisions), 'maxClassSize':max(map(len,universe.groups.values())),
            'd4Classes':len({d4_canonical(n, c) for c in universe.layouts}),
            'uniqueD4Classes':len({d4_canonical(n, universe.layouts[ids[0]]) for ids in universe.groups.values() if len(ids)==1}),
            'reciprocalPortsChecked':reciprocal, 'portsChecked':4*n*len(universe.layouts),
            'maxStates':max_states, 'maxQuarterTurns':max_turns,
            'ambiguousExample': [universe.layouts[i] for i in collisions[0]] if collisions else None,
            'multiTurnExample': multireflection_example}


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--exhaustive', action='store_true')
    parser.add_argument('--output')
    args=parser.parse_args()
    sizes = [(n,k) for n in (3,4,5) for k in (1,2,3,4)] if args.exhaustive else [(5,4)]
    result=[]
    for n,k in sizes:
        report=universe_report(n,k)
        result.append(report)
        print(json.dumps(report), flush=True)
    if args.output:
        with open(args.output,'w') as f: json.dump(result,f,indent=2)
