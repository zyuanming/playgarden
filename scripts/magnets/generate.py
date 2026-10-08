#!/usr/bin/env python3
"""Deterministically author and certify the original PlayGarden Magnets campaign.

No upstream puzzle data is used. The offline certificates deliberately live outside
src/. Run with --check to regenerate in memory and byte-compare both artifacts.
The solver enumerates domino domains with adjacency arc consistency and exact
line-count bounds. A capped search is never accepted as a uniqueness proof.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = 930_202_610
NODE_BUDGET = 30_000
MAX_ATTEMPTS_PER_LEVEL = 2_000
FIELDS = ("rowPlus", "rowMinus", "colPlus", "colMinus")
CHAPTERS = ((4, 4, "磁极初识"), (4, 6, "交错磁场"),
            (6, 6, "隐去线索"), (6, 8, "磁场大师"))
PUBLIC_PATH = ROOT / "src/games/magnetsLevels.ts"
CERTIFICATE_PATH = ROOT / "docs/magnets/campaign.json"
VALUES = tuple(tuple(v for v in range(3) if mask & (1 << v)) for mask in range(8))


def poles(value: int) -> tuple[int, int]:
    return (0, 0) if value == 0 else (value, 3 - value)


def make_tiling(width: int, height: int, rng: random.Random) -> list[list[int]]:
    """Random 2x2 flips preserve a perfect domino cover at every step."""
    mate = [-1] * (width * height)
    for y in range(height):
        for x in range(0, width, 2):
            a = y * width + x
            mate[a], mate[a + 1] = a + 1, a
    for _ in range(width * height * 12):
        x, y = rng.randrange(width - 1), rng.randrange(height - 1)
        a = y * width + x
        b, c, d = a + 1, a + width, a + width + 1
        if mate[a] == b and mate[c] == d:
            mate[a], mate[c], mate[b], mate[d] = c, a, d, b
        elif mate[a] == c and mate[b] == d:
            mate[a], mate[b], mate[c], mate[d] = b, a, d, c
    return [[a, b] for a, b in enumerate(mate) if a < b]


def sample_solution(width: int, height: int, dominoes: list[list[int]],
                    rng: random.Random) -> list[int]:
    """Randomly pack compatible magnets; neutral dominoes break pole phases."""
    cells = [0] * (width * height)
    answer = [0] * len(dominoes)
    order = list(range(len(dominoes)))
    rng.shuffle(order)
    for d in order:
        if rng.random() < 0.19:
            continue
        a, b = dominoes[d]
        choices = [1, 2]
        rng.shuffle(choices)
        for value in choices:
            valid = True
            for cell, pole in zip((a, b), poles(value)):
                x, y = cell % width, cell // width
                neighbours = ([cell - 1] if x else []) + ([cell + 1] if x + 1 < width else [])
                neighbours += ([cell - width] if y else []) + ([cell + width] if y + 1 < height else [])
                if any(cells[n] == pole for n in neighbours):
                    valid = False
                    break
            if valid:
                answer[d] = value
                cells[a], cells[b] = poles(value)
                break
    return answer


def counts(width: int, height: int, dominoes: list[list[int]], solution: list[int]) -> dict:
    result = {"rowPlus": [0] * height, "rowMinus": [0] * height,
              "colPlus": [0] * width, "colMinus": [0] * width}
    for domino, state in zip(dominoes, solution):
        for cell, pole in zip(domino, poles(state)):
            if pole:
                result["rowPlus" if pole == 1 else "rowMinus"][cell // width] += 1
                result["colPlus" if pole == 1 else "colMinus"][cell % width] += 1
    return result


class AuthorSolver:
    """Count up to two solutions. This solver never reads a saved certificate."""

    def __init__(self, puzzle: dict):
        self.puzzle = puzzle
        width, height = puzzle["width"], puzzle["height"]
        dominoes = puzzle["dominoes"]
        self.n = len(dominoes)
        cell_domino = [0] * (width * height)
        cell_end = [0] * (width * height)
        for d, domino in enumerate(dominoes):
            for end, cell in enumerate(domino):
                cell_domino[cell], cell_end[cell] = d, end
        edges: dict[tuple[int, int], list[tuple[int, int]]] = {}
        for a in range(width * height):
            for b in ([a + 1] if a % width + 1 < width else []) + ([a + width] if a + width < width * height else []):
                da, db = cell_domino[a], cell_domino[b]
                if da != db:
                    edges.setdefault((da, db), []).append((cell_end[a], cell_end[b]))
        self.arcs: list[tuple[int, int, tuple[int, ...]]] = []
        self.degree = [0] * self.n
        for (da, db), ends in edges.items():
            forward = tuple(sum(1 << vb for vb in range(3)
                                if all(not va or not vb or poles(va)[ea] != poles(vb)[eb]
                                       for ea, eb in ends)) for va in range(3))
            backward = tuple(sum(1 << va for va in range(3) if forward[va] & (1 << vb))
                             for vb in range(3))
            self.arcs.append((da, db, forward))
            self.arcs.append((db, da, backward))
            self.degree[da] += 1
            self.degree[db] += 1
        self.lines = []
        for field in FIELDS:
            row = field.startswith("row")
            pole = 1 if field.endswith("Plus") else 2
            for i, target in enumerate(puzzle[field]):
                if target < 0:
                    continue
                terms = []
                for d, domino in enumerate(dominoes):
                    mask = 0
                    for value in (1, 2):
                        if any((cell // width if row else cell % width) == i and p == pole
                               for cell, p in zip(domino, poles(value))):
                            mask |= 1 << value
                    if mask:
                        terms.append((d, mask))
                        self.degree[d] += 1
                self.lines.append((target, terms))
        self.nodes = 0
        self.branches = 0
        self.max_depth = 0
        self.root_forced = 0
        self.exhausted = False
        self.solutions: list[list[int]] = []

    def propagate(self, domains: list[int]) -> bool:
        changed = True
        while changed:
            changed = False
            for a, b, support in self.arcs:
                old = domains[a]
                new = sum(1 << v for v in VALUES[old] if support[v] & domains[b])
                if not new:
                    return False
                if new != old:
                    domains[a] = new
                    changed = True
            for target, terms in self.lines:
                minimum, maximum = 0, 0
                optional = []
                for d, one_mask in terms:
                    domain = domains[d]
                    has_one, has_zero = bool(domain & one_mask), bool(domain & (7 ^ one_mask))
                    minimum += int(has_one and not has_zero)
                    maximum += int(has_one)
                    if has_one and has_zero:
                        optional.append((d, one_mask))
                if minimum > target or maximum < target:
                    return False
                if minimum == target:
                    for d, one_mask in optional:
                        domains[d] &= 7 ^ one_mask
                        changed = True
                elif maximum == target:
                    for d, one_mask in optional:
                        domains[d] &= one_mask
                        changed = True
        return True

    def visit(self, domains: list[int], depth: int, limit: int, budget: int) -> None:
        self.nodes += 1
        if self.nodes > budget:
            self.exhausted = True
            return
        self.max_depth = max(depth, self.max_depth)
        if not self.propagate(domains):
            return
        if depth == 0:
            self.root_forced = sum(mask in (1, 2, 4) for mask in domains)
        unsettled = [d for d in range(self.n) if len(VALUES[domains[d]]) > 1]
        if not unsettled:
            self.solutions.append([VALUES[mask][0] for mask in domains])
            return
        self.branches += 1
        d = min(unsettled, key=lambda i: (len(VALUES[domains[i]]), -self.degree[i], i))
        for value in VALUES[domains[d]]:
            next_domains = domains[:]
            next_domains[d] = 1 << value
            self.visit(next_domains, depth + 1, limit, budget)
            if len(self.solutions) >= limit or self.exhausted:
                return

    def solve(self, limit: int = 2, budget: int = NODE_BUDGET) -> list[list[int]]:
        self.visit([7] * self.n, 0, limit, budget)
        return self.solutions


def unique(puzzle: dict, answer: list[int]) -> AuthorSolver | None:
    solver = AuthorSolver(puzzle)
    found = solver.solve()
    return solver if not solver.exhausted and found == [answer] else None


def canonical_problem(puzzle: dict) -> str:
    """Canonicalize all 8 rectangle isometries and simultaneous pole inversion.

    Domino ordering and endpoint orientation have no effect on a problem.
    Transform clue positions geometrically, including rotations of rectangles.
    """
    width, height = puzzle["width"], puzzle["height"]
    keys = []
    for swap in (False, True):
        new_width, new_height = (height, width) if swap else (width, height)
        for flip_x in (False, True):
            for flip_y in (False, True):
                def xy(x: int, y: int) -> tuple[int, int]:
                    if swap:
                        x, y = y, x
                    return (new_width - 1 - x if flip_x else x,
                            new_height - 1 - y if flip_y else y)

                def cell(i: int) -> int:
                    x, y = xy(i % width, i // width)
                    return y * new_width + x

                dominoes = sorted(sorted(cell(c) for c in d) for d in puzzle["dominoes"])
                for inverted in (False, True):
                    clues = {"rowPlus": [-1] * new_height, "rowMinus": [-1] * new_height,
                             "colPlus": [-1] * new_width, "colMinus": [-1] * new_width}
                    for field in FIELDS:
                        row = field.startswith("row")
                        new_row = row != swap
                        plus = field.endswith("Plus") != inverted
                        new_field = ("row" if new_row else "col") + ("Plus" if plus else "Minus")
                        for i, value in enumerate(puzzle[field]):
                            x, y = xy(0, i) if row else xy(i, 0)
                            clues[new_field][y if new_row else x] = value
                    keys.append(json.dumps([new_width, new_height, dominoes] +
                                           [clues[f] for f in FIELDS], separators=(",", ":")))
    return min(keys)


def validate_certificate(puzzle: dict, answer: list[int]) -> None:
    width, height = puzzle["width"], puzzle["height"]
    assert len(answer) == len(puzzle["dominoes"]) == width * height // 2
    assert sorted(c for d in puzzle["dominoes"] for c in d) == list(range(width * height))
    assert all(len(d) == 2 and abs(d[0] % width - d[1] % width) +
               abs(d[0] // width - d[1] // width) == 1 for d in puzzle["dominoes"])
    assert all(v in (0, 1, 2) for v in answer)
    actual = counts(width, height, puzzle["dominoes"], answer)
    assert all(target < 0 or target == actual[field][i]
               for field in FIELDS for i, target in enumerate(puzzle[field]))
    cells = [0] * (width * height)
    for domino, state in zip(puzzle["dominoes"], answer):
        for cell, pole in zip(domino, poles(state)):
            cells[cell] = pole
    for i, pole in enumerate(cells):
        assert not pole or all(cells[j] != pole for j in
                               ([i + 1] if i % width + 1 < width else []) +
                               ([i + width] if i + width < width * height else []))


def build_campaign(quiet: bool = False) -> dict:
    rng = random.Random(SEED)
    all_levels = []
    seen = set()
    for chapter, (width, height, chapter_name) in enumerate(CHAPTERS):
        chapter_levels = []
        total_clues = 2 * (width + height)
        # Early levels retain supportive counts. Later chapters omit more counts
        # on larger, independently generated boards; no repeated answer variants.
        removal_targets = ((2, 3, 4, 5, 6, 7, 8, 9, 10),
                           (6, 7, 8, 9, 10, 11, 12, 13, 14),
                           (9, 10, 11, 12, 13, 14, 15, 16, 17),
                           (11, 12, 13, 14, 15, 16, 17, 18, 19))[chapter]
        for position, target_removals in enumerate(removal_targets):
            accepted = None
            for attempt in range(1, MAX_ATTEMPTS_PER_LEVEL + 1):
                dominoes = make_tiling(width, height, rng)
                horizontal = sum(b == a + 1 for a, b in dominoes)
                if min(horizontal, len(dominoes) - horizontal) < 2:
                    continue
                answer = sample_solution(width, height, dominoes, rng)
                if not 2 <= answer.count(0) <= len(answer) // 2 or min(answer.count(1), answer.count(2)) < 1:
                    continue
                puzzle = {"width": width, "height": height, "dominoes": dominoes,
                          **counts(width, height, dominoes, answer)}
                if unique(puzzle, answer) is None:
                    continue
                indices = [(field, i) for field in FIELDS for i in range(len(puzzle[field]))]
                rng.shuffle(indices)
                removed = 0
                for field, i in indices:
                    value = puzzle[field][i]
                    puzzle[field][i] = -1
                    if unique(puzzle, answer) is None:
                        puzzle[field][i] = value
                    else:
                        removed += 1
                    if removed == target_removals:
                        break
                # Permit a one-clue difference when essential counts remain.
                if removed < target_removals - 1:
                    continue
                key = canonical_problem(puzzle)
                if key in seen:
                    continue
                proof = unique(puzzle, answer)
                assert proof is not None
                validate_certificate(puzzle, answer)
                accepted = {**puzzle, "solution": answer, "metrics": {
                    "clues": total_clues - removed, "omittedClues": removed,
                    "horizontalDominoes": horizontal,
                    "verticalDominoes": len(dominoes) - horizontal,
                    "neutralDominoes": answer.count(0),
                    "authorSolutionCount": len(proof.solutions),
                    "authorNodes": proof.nodes, "authorBranches": proof.branches,
                    "authorMaxDepth": proof.max_depth, "rootForcedDominoes": proof.root_forced,
                    "nodeBudget": NODE_BUDGET, "generationAttempts": attempt,
                    "canonicalSha256": hashlib.sha256(key.encode()).hexdigest(),
                }}
                seen.add(key)
                break
            if accepted is None:
                raise RuntimeError(f"Finite generation cap exceeded at chapter {chapter + 1}, position {position + 1}")
            chapter_levels.append(accepted)
            if not quiet:
                m = accepted["metrics"]
                print(f"chapter {chapter + 1} candidate {position + 1}: {m['clues']} clues, "
                      f"{m['authorNodes']} proof nodes, {m['generationAttempts']} attempts", file=sys.stderr, flush=True)
        # Within each board size, use the measured proof effort before clue count.
        chapter_levels.sort(key=lambda p: (p["metrics"]["authorBranches"],
                                           p["metrics"]["authorNodes"], -p["metrics"]["clues"]))
        for position, puzzle in enumerate(chapter_levels):
            index = len(all_levels) + 1
            all_levels.append({"id": f"magnets-{index:03d}",
                               "title": f"{chapter_name} · {position + 1}", "chapter": chapter,
                               **puzzle})
    return {"seed": SEED, "generator": "scripts/magnets/generate.py", "formatVersion": 1,
            "solver": "domino domains + adjacency arc consistency + exact line bounds + exhaustive count to two",
            "levels": all_levels}


def render(campaign: dict) -> dict[Path, str]:
    public = [{key: value for key, value in level.items() if key not in ("solution", "metrics")}
              for level in campaign["levels"]]
    source = ("// SPDX-License-Identifier: GPL-3.0-only\n"
              "// Original deterministic campaign. Generated by scripts/magnets/generate.py.\n"
              "// Solution certificates are offline in docs/magnets/campaign.json.\n"
              "import type { MagnetsLevel } from './magnetsLogic';\n\n"
              "export const magnetsLevels: MagnetsLevel[] = " +
              json.dumps(public, ensure_ascii=False, indent=2) + ";\n")
    return {PUBLIC_PATH: source,
            CERTIFICATE_PATH: json.dumps(campaign, ensure_ascii=False, indent=2) + "\n"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="regenerate and compare without writing")
    parser.add_argument("--quiet", action="store_true", help="omit per-level progress")
    args = parser.parse_args()
    campaign = build_campaign(quiet=args.quiet)
    outputs = render(campaign)
    if args.check:
        different = [str(path.relative_to(ROOT)) for path, content in outputs.items()
                     if not path.exists() or path.read_text(encoding="utf-8") != content]
        if different:
            raise SystemExit("Generated artifacts differ: " + ", ".join(different))
        print("Verified: 36 unique original puzzles; deterministic public data and offline certificates match.")
    else:
        for path, content in outputs.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        print("Generated 36 uniquely solved puzzles in four chapters.")


if __name__ == "__main__":
    main()
