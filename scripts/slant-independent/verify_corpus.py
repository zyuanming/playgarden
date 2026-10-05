#!/usr/bin/env python3
"""Check shipped Slant levels without loading application code or its solver.

All searches use runtime levels first. The certificate file is only opened AFTER
all searches finish; supplied solutions cannot guide any search or branch choice.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import re
import sys
from time import perf_counter
from slant_oracle import Puzzle, solve, validate_solution, canonical_key, puzzle_key, transform


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_ts_literal(raw: bytes) -> list[dict]:
    text = raw.decode('utf-8')
    match = re.search(r'export\s+const\s+slantLevels\s*(?::\s*[^=]+)?=\s*', text)
    if not match:
        raise ValueError('Could not locate slantLevels JSON array literal')
    result, end = json.JSONDecoder().raw_decode(text, match.end())
    if not isinstance(result, list):
        raise ValueError('slantLevels literal is not a list')
    if text[end:].strip() not in ('', ';'):
        raise ValueError('Unexpected executable content after data literal')
    return result


def parse_puzzle(record: dict) -> Puzzle:
    width, height = record['width'], record['height']
    if type(width) is not int or type(height) is not int or min(width, height) < 1:
        raise ValueError('Bad width/height')
    flat = record['clues']
    if not isinstance(flat, list) or len(flat) != (width + 1) * (height + 1):
        raise ValueError('Bad flattened clue dimensions')
    if any(type(c) is not int or c not in (-1, 0, 1, 2, 3, 4) for c in flat):
        raise ValueError('Clue data must use integer -1/0/1/2/3/4')
    return Puzzle(height, width, tuple(tuple(None if c == -1 else c for c in flat[r * (width + 1):(r + 1) * (width + 1)])
                                      for r in range(height + 1)))


def decode_description(value: str) -> list[int]:
    if not isinstance(value, str):
        raise ValueError('rawDescription is not a string')
    out = []
    for char in value:
        if char in '01234':
            out.append(int(char))
        elif 'a' <= char <= 'z':
            out.extend([-1] * (ord(char) - ord('a') + 1))
        else:
            raise ValueError('Unknown rawDescription character')
    return out


def as_solution(record: dict) -> str:
    values = record['solution']
    if not isinstance(values, list) or len(values) != record['width'] * record['height']:
        raise ValueError('Certificate solution has wrong length')
    if any(type(x) is not int or x not in (-1, 1) for x in values):
        raise ValueError('Certificate solution must contain only integer -1/+1')
    return ''.join('\\' if x == -1 else '/' for x in values)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--expect-count', type=int, default=300)
    parser.add_argument('--timeout-seconds', type=float, default=60.0)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    started = perf_counter()
    stamp = datetime.now(timezone.utc).isoformat()
    levels_path = args.repo / 'src/games/slantLevels.ts'
    certificates_path = args.repo / 'tests/fixtures/slantCertificates.json'
    raw_levels = levels_path.read_bytes()
    levels = load_ts_literal(raw_levels)
    errors = []
    if len(levels) != args.expect_count:
        errors.append(f'Expected {args.expect_count} runtime levels; got {len(levels)}')
    runtime_ids = [x.get('id') for x in levels]
    if any(not isinstance(x, str) or not x for x in runtime_ids):
        errors.append('Malformed runtime ID')
    if len(set(runtime_ids)) != len(runtime_ids):
        errors.append('Duplicate runtime IDs')
    puzzles = []
    for record in levels:
        if 'solution' in record or 'board' in record:
            errors.append(f'Runtime record unexpectedly exposes solution/board: {record.get("id")}')
        puzzles.append(parse_puzzle(record))
        if decode_description(record['rawDescription']) != record['clues']:
            errors.append(f'Raw description does not match clues: {record.get("id")}')
    # This input artifact contains no certificate solution or generation evidence.
    inputs = [{'id': r['id'], 'width': r['width'], 'height': r['height'], 'clues': r['clues']} for r in levels]
    (args.out / 'runtime-puzzles-only.json').write_text(json.dumps(inputs, separators=(',', ':')) + '\n')
    normalized_hash_matches = 0
    for record, puzzle in zip(levels, puzzles):
        # Match the published hash format using this verifier's own D4 geometry.
        serializations = []
        for mirror in (False, True):
            for turns in range(4):
                transformed, _ = transform(puzzle, turns, mirror)
                flat = ','.join(str(-1 if clue is None else clue) for row in transformed.clues for clue in row)
                serializations.append(f'{transformed.cols}x{transformed.rows}:{flat}')
        independent_declared_hash = digest(min(serializations).encode())
        matches = record.get('normalizedPuzzleHash') == independent_declared_hash
        normalized_hash_matches += int(matches)
        if not matches:
            errors.append(f'Declared normalizedPuzzleHash mismatch: {record["id"]}')
    canonical_groups = defaultdict(list)
    exact_groups = defaultdict(list)
    for record, puzzle in zip(levels, puzzles):
        canonical_groups[canonical_key(puzzle)].append(record['id'])
        exact_groups[puzzle_key(puzzle)].append(record['id'])
    d4_duplicates = [ids for ids in canonical_groups.values() if len(ids) > 1]
    exact_duplicates = [ids for ids in exact_groups.values() if len(ids) > 1]
    if d4_duplicates:
        errors.append(f'{len(d4_duplicates)} duplicate D4 puzzle groups')
    results = []
    with (args.out / 'search-progress.jsonl').open('w') as progress:
        for i, (record, puzzle) in enumerate(zip(levels, puzzles)):
            found = solve(puzzle, limit=2, timeout_seconds=args.timeout_seconds)
            for witness in found['solutions']:
                if not validate_solution(puzzle, witness)['valid']:
                    raise AssertionError(f'Oracle returned invalid witness for {record["id"]}')
            result = {'id': record['id'], 'chapter': record['chapter'],
                      'width': puzzle.cols, 'height': puzzle.rows,
                      'clueCount': sum(c is not None for row in puzzle.clues for c in row),
                      'independentCanonicalSha256': digest(canonical_key(puzzle).encode()),
                      'search': found}
            results.append(result)
            progress.write(json.dumps(result, separators=(',', ':')) + '\n')
            progress.flush()
            if found['status'] != 'unique':
                errors.append(f'{record["id"]}: oracle status {found["status"]}')
            if (i + 1) % 25 == 0 or i + 1 == len(levels) or found['status'] != 'unique':
                print(f'{i + 1}/{len(levels)} solved; last={record["id"]} status={found["status"]} '
                      f'nodes={found["stats"]["nodes"]} seconds={found["seconds"]:.4f}', flush=True)
    searches_finished = datetime.now(timezone.utc).isoformat()
    # Deliberately deferred until no search remains.
    raw_certificates = certificates_path.read_bytes()
    certificates = json.loads(raw_certificates)
    if not isinstance(certificates, list):
        raise ValueError('Certificate data is not a list')
    if len(certificates) != len(levels):
        errors.append(f'Certificate count {len(certificates)} does not match runtime count {len(levels)}')
    cert_ids = [r.get('id') for r in certificates]
    if len(set(cert_ids)) != len(cert_ids):
        errors.append('Duplicate certificate IDs')
    if cert_ids != runtime_ids:
        errors.append('Certificate ID order/set differs from runtime')
    by_id = {r['id']: r for r in certificates}
    valid_certificates = 0
    matched_certificates = 0
    for runtime, puzzle, result in zip(levels, puzzles, results):
        certificate = by_id.get(runtime['id'])
        if certificate is None:
            errors.append(f'Missing certificate {runtime["id"]}')
            continue
        stripped = {key: value for key, value in certificate.items() if key != 'solution'}
        result['certificateRuntimeRecordMatches'] = stripped == runtime
        if stripped != runtime:
            errors.append(f'Certificate metadata/clues differs from runtime for {runtime["id"]}')
        solution = as_solution(certificate)
        validity = validate_solution(puzzle, solution)
        result['certificateSolutionValidation'] = validity
        matches = result['search']['status'] == 'unique' and result['search']['solutions'] == [solution]
        result['certificateMatchesIndependentUniqueWitness'] = matches
        valid_certificates += int(validity['valid'])
        matched_certificates += int(matches)
        if not validity['valid']:
            errors.append(f'Invalid certificate solution {runtime["id"]}: {validity["errors"]}')
        if result['search']['status'] == 'unique' and not matches:
            errors.append(f'Certificate does not match independent unique witness: {runtime["id"]}')
    if levels_path.read_bytes() != raw_levels:
        errors.append('Runtime file changed during verification; rerun needed')
    if certificates_path.read_bytes() != raw_certificates:
        errors.append('Certificate file changed during verification; rerun needed')
    counts = dict(Counter(result['search']['status'] for result in results))
    all_search_seconds = [r['search']['seconds'] for r in results]
    report = {
        'result': 'PASS' if not errors else 'FAIL', 'startedAtUtc': stamp,
        'searchesFinishedAtUtc': searches_finished,
        'finishedAtUtc': datetime.now(timezone.utc).isoformat(),
        'totalSeconds': perf_counter() - started,
        'runtimeLevelCount': len(levels), 'certificateCount': len(certificates),
        'searchStatusCounts': counts, 'certificateValidCount': valid_certificates,
        'certificateMatchesUniqueWitnessCount': matched_certificates,
        'declaredNormalizedHashMatchCount': normalized_hash_matches,
        'd4UniquePuzzleCount': len(canonical_groups), 'd4DuplicateGroups': d4_duplicates,
        'exactDuplicateGroups': exact_duplicates,
        'chapterCounts': dict(Counter(str(r['chapter']) for r in levels)),
        'sizeCounts': dict(Counter(f'{p.cols}x{p.rows}' for p in puzzles)),
        'totalSearchNodes': sum(r['search']['stats']['nodes'] for r in results),
        'maxSearchSeconds': max(all_search_seconds, default=0),
        'runtimeSha256': digest(raw_levels), 'certificatesSha256': digest(raw_certificates),
        'verifierSha256': {name: digest((Path(__file__).parent / name).read_bytes())
                           for name in ('slant_oracle.py', 'verify_corpus.py', 'test_oracle.py', 'test_corpus_adapter.py')},
        'environment': {'python': sys.version, 'platform': platform.platform(), 'argv': sys.argv},
        'method': {
            'independence': 'No production modules imported or evaluated. No production solver/source used.',
            'searchInput': 'Only dimensions and clues extracted as JSON from shipped TypeScript array.',
            'solutionsLoadedAfterSearch': True,
            'uniqueness': 'Exhaustive two-value CSP with sound degree bounds and forest-cycle pruning; stop after 2 witnesses.',
            'certificateCheck': 'Separate undirected adjacency DFS detects cycles and direct degrees check clues.',
            'equivalence': 'All 8 D4 transforms of numbered/unclued vertices, with dimensions included and swapped by odd quarter turns.',
            'perLevelTimeoutSeconds': args.timeout_seconds,
        },
        'limitations': [
            'Does not execute UI, interactions, production solver, or production completion logic.',
            'Does not independently establish human difficulty labels or tutorial quality.',
            'Does not verify upstream authorship, license compliance, or generation reproducibility.',
            'A timeout is reported as inconclusive, never as uniqueness.',
        ],
        'errors': errors, 'levels': results,
    }
    (args.out / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('levels', 'environment', 'method', 'verifierSha256')},
                     indent=2, ensure_ascii=False), flush=True)
    return 0 if not errors else 1


if __name__ == '__main__':
    raise SystemExit(main())
