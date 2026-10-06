#!/usr/bin/env python3
"""Independent public-clue Tents verifier. Standard library, no production imports.

The runtime enumerates row masks; this oracle instead assigns one adjacent tent
coordinate to each tree, then deduplicates complete assignments by tent placement.
Multiple valid tree matchings therefore do not incorrectly imply multiple puzzles.
Certificates and authoring metadata never enter the search or canonical clue key.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import re
import statistics
import time

INDEPENDENT_NODE_LIMIT = 200000

PUBLIC_FIELDS = ('size', 'trees', 'rowCounts', 'columnCounts')
LEGACY_FIELDS = PUBLIC_FIELDS + ('title', 'solution', 'authoringNodes', 'authoringCandidates')


def read_levels(path):
    """Decode inert JSON/literal TypeScript data, never execute its source."""
    path = Path(path)
    source = path.read_text()
    appendix = []
    if path.suffix == '.ts':
        match = re.search(r'export const tents(?:Levels|Expansion)[^=]*=\s*(\[)', source)
        if not match:
            raise ValueError('Expected a literal Tents array; executable source is not accepted')
        start = match.start(1)
        depth = 0
        quoted = False
        escaped = False
        end = None
        for offset, char in enumerate(source[start:], start):
            if quoted:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    quoted = False
            elif char == '"':
                quoted = True
            elif char == '[':
                depth += 1
            elif char == ']':
                depth -= 1
                if depth == 0:
                    end = offset + 1
                    break
        if end is None:
            raise ValueError('Unterminated literal Tents data array')
        source = source[start:end]
        if '...tentsExpansion' in source:
            if source.count('...tentsExpansion') != 1 or not re.search(r'\.\.\.tentsExpansion\s*,?\s*\]$', source):
                raise ValueError('tentsExpansion may appear once at the end only')
            source = re.sub(r'\.\.\.tentsExpansion\s*,?\s*\]$', ']', source)
            # Tie the inert adapter to the actual shipped wrapper. A changed import
            # must fail closed instead of silently auditing an unused JSON file.
            wrapper = path.with_name('tentsExpansion.ts').read_text()
            if (not re.search(r'import\s+data\s+from\s+[\"\']\./tentsExpansionData\.json[\"\']\s*;', wrapper)
                or not re.search(r'export const tentsExpansion\s*:\s*TentsLevel\[\]\s*=\s*data\s*;\s*$', wrapper)):
                raise ValueError('Expansion wrapper does not expose the agreed inert data array')
            appendix = read_levels(path.with_name('tentsExpansionData.json'))
        source = re.sub(r'([\{,]\s*)([A-Za-z_$][\w$]*)(\s*:)', r'\1"\2"\3', source)
        source = re.sub(r',\s*([}\]])', r'\1', source)
    data = json.loads(source)
    if isinstance(data, dict):
        data = data.get('levels', data.get('tentsLevels'))
    if not isinstance(data, list):
        raise ValueError('Expected a level array or an object containing levels/tentsLevels')
    return data + appendix


def integral(value):
    return isinstance(value, int) and not isinstance(value, bool)


def validate_public(level):
    if not isinstance(level, dict):
        return ['level is not an object']
    n = level.get('size')
    if not integral(n) or not 4 <= n <= 7:
        return ['size must be an integer from 4 through 7']
    errors = []
    trees = level.get('trees')
    if not isinstance(trees, list) or not 1 <= len(trees) <= math.ceil(n/2)**2:
        return ['invalid tree list length']
    if not all(integral(t) and 0 <= t < n*n for t in trees):
        return ['invalid tree coordinate']
    if len(set(trees)) != len(trees):
        errors.append('repeated tree coordinates')
    for field in ('rowCounts', 'columnCounts'):
        counts = level.get(field)
        if not isinstance(counts, list) or len(counts) != n:
            errors.append(f'{field} must contain exactly size counts')
        elif not all(integral(x) and 0 <= x <= math.ceil(n/2) for x in counts):
            errors.append(f'{field} contains an invalid count')
        elif sum(counts) != len(trees):
            errors.append(f'{field} sum differs from tree count')
    return errors


def adjacent(n, a, b):
    return abs(a//n-b//n) + abs(a%n-b%n) == 1


def touches(n, a, b):
    return max(abs(a//n-b//n), abs(a%n-b%n)) <= 1


def tree_domains(level):
    n = level['size']
    trees = set(level['trees'])
    # Deliberately scan board coordinates, independently of runtime neighbors().
    return tuple(tuple(p for p in range(n*n) if p not in trees and adjacent(n,t,p))
                 for t in level['trees'])


def has_bijection(level, tents):
    """Independent subset-DP matching, not the runtime augmenting-path algorithm."""
    if len(set(tents)) != len(level['trees']) or len(tents) != len(level['trees']):
        return False
    reachable = {0}
    for tree in level['trees']:
        next_masks = set()
        for used in reachable:
            for j, tent in enumerate(tents):
                if not (used >> j & 1) and adjacent(level['size'], tree, tent):
                    next_masks.add(used | 1 << j)
        reachable = next_masks
        if not reachable:
            return False
    return (1 << len(tents))-1 in reachable


def validate_placement(level, tents):
    errors = validate_public(level)
    if errors:
        return errors
    n = level['size']
    if not isinstance(tents, (list, tuple)) or not all(integral(t) and 0 <= t < n*n for t in tents):
        return ['invalid tent coordinates']
    if len(tents) != len(level['trees']) or len(set(tents)) != len(tents):
        errors.append('tent count/uniqueness differs from tree count')
    if set(tents) & set(level['trees']):
        errors.append('a tent occupies a tree')
    if any(touches(n,a,b) for j,a in enumerate(tents) for b in tents[j+1:]):
        errors.append('tents touch horizontally, vertically, or diagonally')
    if [sum(t//n == r for t in tents) for r in range(n)] != level['rowCounts']:
        errors.append('row counts do not match')
    if [sum(t%n == c for t in tents) for c in range(n)] != level['columnCounts']:
        errors.append('column counts do not match')
    if not has_bijection(level, tents):
        errors.append('no tree/tent bijection exists')
    return errors


def solve_public(level, budget=INDEPENDENT_NODE_LIMIT, timeout=10.0, limit=2,
                 force_tents=(), force_grass=(), omit_rows=(), omit_columns=()):
    """Exhaustive bounded search over tree assignments; placements are distinct.

    An exhausted one-placement search is unique. An interrupted one-placement
    search is always budget/timeout/limit, never unique. Tree ordering, pruning,
    matching, and representation are independent of the runtime row-mask solver.
    """
    start = time.monotonic()
    result = {'status':'invalid', 'nodes':0, 'solutions':[], 'assignments':0}
    if validate_public(level) or not integral(budget) or not 0 <= budget <= INDEPENDENT_NODE_LIMIT or not integral(limit) or limit < 1 or not isinstance(timeout,(int,float)) or timeout < 0:
        return result
    n = level['size']
    trees = level['trees']
    if any(not integral(p) or not 0 <= p < n*n for p in (*force_tents,*force_grass)):
        return result
    required, forbidden = set(force_tents), set(force_grass) | set(trees)
    if required & forbidden or any(touches(n,a,b) for a in required for b in required if a != b):
        return {**result, 'status':'no_solution'}
    rows, cols = level['rowCounts'], level['columnCounts']
    omitted_r, omitted_c = set(omit_rows), set(omit_columns)
    if any(not integral(i) or not 0 <= i < n for i in omitted_r | omitted_c):
        return result
    domains = tuple(tuple(p for p in d if p not in forbidden) for d in tree_domains(level))
    row_used = [0]*n
    col_used = [0]*n
    placements = set()
    status = 'complete'
    nodes = 0
    assignments = 0

    def visit(remaining, chosen):
        nonlocal status,nodes,assignments
        if status != 'complete':
            return
        if nodes >= budget:
            status = 'budget'
            return
        if time.monotonic()-start >= timeout:
            status = 'timeout'
            return
        nodes += 1
        if not remaining:
            if not required <= set(chosen):
                return
            if any(row_used[r] != rows[r] for r in range(n) if r not in omitted_r):
                return
            if any(col_used[c] != cols[c] for c in range(n) if c not in omitted_c):
                return
            assignments += 1
            placements.add(tuple(sorted(chosen)))
            if len(placements) >= limit:
                status = 'multiple' if limit > 1 else 'limit'
            return
        live = []
        for tree_index in remaining:
            possible = tuple(p for p in domains[tree_index]
                             if (p//n in omitted_r or row_used[p//n] < rows[p//n])
                             and (p%n in omitted_c or col_used[p%n] < cols[p%n])
                             and all(not touches(n,p,q) for q in chosen))
            if not possible:
                return
            live.append((tree_index, possible))
        union = set(p for _, choices in live for p in choices)
        if len(union) < len(remaining) or not required <= union | set(chosen):
            return
        for r in range(n):
            if r not in omitted_r and row_used[r] + sum(p//n == r for p in union) < rows[r]:
                return
        for c in range(n):
            if c not in omitted_c and col_used[c] + sum(p%n == c for p in union) < cols[c]:
                return
        owner, choices = min(live, key=lambda item:(len(item[1]), item[0]))
        rest = tuple(t for t in remaining if t != owner)
        for p in choices:
            row_used[p//n] += 1
            col_used[p%n] += 1
            visit(rest, chosen+(p,))
            row_used[p//n] -= 1
            col_used[p%n] -= 1
            if status != 'complete':
                return

    visit(tuple(range(len(trees))), ())
    if status == 'complete':
        status = 'unique' if len(placements) == 1 else 'multiple' if placements else 'no_solution'
    return {'status':status, 'nodes':nodes, 'solutions':[list(p) for p in sorted(placements)],
            'assignments':assignments, 'seconds':round(time.monotonic()-start,6)}


def transform_index(n, index, symmetry):
    """Eight explicit square isometries. No production canonicalization helpers."""
    r,c = divmod(index,n)
    positions = ((r,c),(c,n-1-r),(n-1-r,n-1-c),(n-1-c,r),
                 (r,n-1-c),(n-1-c,n-1-r),(n-1-r,c),(c,r))
    y,x = positions[symmetry]
    return y*n+x


def transform_public(level, symmetry):
    n = level['size']
    transformed = {'size':n, 'trees':sorted(transform_index(n,t,symmetry) for t in level['trees']),
                   'rowCounts':[None]*n, 'columnCounts':[None]*n}
    # Transform complete labeled source lines geometrically; do not read solution.
    for field in ('rowCounts','columnCounts'):
        for line, count in enumerate(level[field]):
            original = [line*n+i if field == 'rowCounts' else i*n+line for i in range(n)]
            cells = [transform_index(n,p,symmetry) for p in original]
            rr,cc = {p//n for p in cells},{p%n for p in cells}
            target,index = ('rowCounts',next(iter(rr))) if len(rr)==1 else ('columnCounts',next(iter(cc)))
            transformed[target][index] = count
    return transformed


def canonical_keys(level, independent_solution):
    n = level['size']
    public = []
    structure = []
    for symmetry in range(8):
        transformed = transform_public(level,symmetry)
        public.append((tuple(transformed['trees']),tuple(transformed['rowCounts']),tuple(transformed['columnCounts'])))
        structure.append(tuple(sorted(transform_index(n,p,symmetry) for p in independent_solution)))
    return (n,min(public)), (n,min(structure))


def normalized_tent_key(n, tents):
    """Remove board size and translations after each of the eight isometries."""
    variants=[]
    for symmetry in range(8):
        cells=[transform_index(n,p,symmetry) for p in tents]
        coordinates=[divmod(p,n) for p in cells]
        min_row=min(r for r,c in coordinates)
        min_column=min(c for r,c in coordinates)
        variants.append(tuple(sorted((r-min_row,c-min_column) for r,c in coordinates)))
    return min(variants)


def structural_metrics(level, independent_solution):
    """Descriptive diversity, not a claim about human difficulty."""
    n = level['size']
    domains = tree_domains(level)
    active = [tuple(p for p in d if level['rowCounts'][p//n] and level['columnCounts'][p%n]) for d in domains]
    by_tent = [sum(adjacent(n,t,p) for t in level['trees']) for p in independent_solution]
    unseen = set(range(len(domains)))
    components = []
    while unseen:
        todo = [min(unseen)]
        unseen.remove(todo[0])
        group = []
        while todo:
            at = todo.pop()
            group.append(at)
            linked = [i for i in unseen if set(active[at]) & set(active[i])]
            for i in linked:
                unseen.remove(i)
                todo.append(i)
        components.append(len(group))
    counts = level['rowCounts']+level['columnCounts']
    return {'size':n,'treeCount':len(level['trees']),
            'zeroLines':counts.count(0), 'zeroLineFraction':round(counts.count(0)/(2*n),4),
            'candidateCells':len(set(p for domain in active for p in domain)),
            'initialSingleTreeDomains':sum(len(d)==1 for d in active),
            'candidateDomainSizes':dict(sorted(Counter(map(len,active)).items())),
            'treeCompetitionComponents':sorted(components,reverse=True),
            'maxTreeCompetitionComponent':max(components),
            'extraTreeAdjacencyTents':sum(x>1 for x in by_tent),
            'treeAdjacencyDegreeHistogram':dict(sorted(Counter(by_tent).items()))}


def axis_ablation(level, budget=INDEPENDENT_NODE_LIMIT, timeout=3.0):
    """Measure loss of constraints, without confusing redundant final line with difficulty.

    Dropping one row is always redundant because all column counts fix the total;
    instead remove the entire opposite axis and inspect whether one axis plus
    tree/tent rules still uniquely determines the board. Also remove pairs of row
    or column counts, the smallest nontrivial within-axis ablation.
    """
    n = level['size']
    outcomes = {}
    for label, rr, cc in [('rowsOnly', (), tuple(range(n))), ('columnsOnly',tuple(range(n)),())]:
        result = solve_public(level,budget,timeout,omit_rows=rr,omit_columns=cc)
        outcomes[label] = result['status']
    pair_necessary = {'rowPairs':0,'columnPairs':0,'inconclusive':0}
    for axis in ('rowPairs','columnPairs'):
        for first in range(n):
            for second in range(first+1,n):
                omit = (first,second)
                result = solve_public(level,budget,timeout,omit_rows=omit if axis=='rowPairs' else (),
                                      omit_columns=omit if axis=='columnPairs' else ())
                if result['status']=='multiple':
                    pair_necessary[axis] += 1
                elif result['status'] != 'unique':
                    pair_necessary['inconclusive'] += 1
    return {**outcomes, **pair_necessary}


def summarize(rows):
    if not rows:
        return {}
    sizes=Counter(r['metrics']['size'] for r in rows)
    metrics = lambda field:[r['metrics'][field] for r in rows]
    def spread(values):
        return {'min':min(values),'median':statistics.median(values),'max':max(values)}
    result = {'count':len(rows),'boardSizes':dict(sorted(sizes.items())),
              'treeCounts':dict(sorted(Counter(metrics('treeCount')).items())),
              'zeroLines':spread(metrics('zeroLines')),
              'candidateCells':spread(metrics('candidateCells')),
              'maxTreeCompetitionComponent':spread(metrics('maxTreeCompetitionComponent')),
              'initialSingleTreeDomains':spread(metrics('initialSingleTreeDomains')),
              'withExtraTreeAdjacency':sum(bool(r['metrics']['extraTreeAdjacencyTents']) for r in rows),
              'independentSearchNodes':spread([r['oracle']['nodes'] for r in rows])}
    if all('ablation' in r for r in rows):
        result['rowsOnlyStatuses']=dict(Counter(r['ablation']['rowsOnly'] for r in rows))
        result['columnsOnlyStatuses']=dict(Counter(r['ablation']['columnsOnly'] for r in rows))
        result['nontrivialRowPairs']=spread([r['ablation']['rowPairs'] for r in rows])
        result['nontrivialColumnPairs']=spread([r['ablation']['columnPairs'] for r in rows])
        result['inconclusiveAblations']=sum(r['ablation']['inconclusive'] for r in rows)
    return result


def verify_corpus(levels, legacy, expect_count=None, budget=INDEPENDENT_NODE_LIMIT, timeout=10.0, ablate=False):
    failures=[]
    reports=[]
    if expect_count is not None and len(levels)!=expect_count:
        failures.append(f'Expected {expect_count} levels, found {len(levels)}')
    if len(legacy)!=12:
        failures.append('Legacy fixture must contain exactly 12 original levels')
    if len(levels)<len(legacy):
        failures.append('Legacy levels are missing')
    for index, original in enumerate(legacy):
        if index<len(levels) and levels[index]!=original:
            failures.append(f'Legacy level {index+1} changed')
    public_seen={}
    structure_seen={}
    normalized_seen={}
    duplicate_normalized=[]
    duplicate_public=[]
    duplicate_structures=[]
    for index, level in enumerate(levels):
        number=index+1
        errors=validate_public(level)
        if errors:
            failures.append(f'Level {number}: {"; ".join(errors)}')
            continue
        # Build a new dict of public fields, proving no certificate can enter oracle.
        public={k:level[k] for k in PUBLIC_FIELDS}
        result=solve_public(public,budget,timeout)
        report={'level':number, 'title':level.get('title'), 'oracle':result}
        reports.append(report)
        if result['status']!='unique':
            failures.append(f'Level {number}: independent oracle is {result["status"]}')
            continue
        solution=result['solutions'][0]
        errors=validate_placement(public,solution)
        if errors:
            failures.append(f'Level {number}: oracle output failed independent checks: {errors}')
        certificate=level.get('solution')
        if not isinstance(certificate,list) or not all(integral(p) for p in certificate) or sorted(certificate)!=solution:
            failures.append(f'Level {number}: stored certificate differs from independently derived solution')
        pkey,skey=canonical_keys(public,solution)
        if pkey in public_seen:
            duplicate_public.append([public_seen[pkey],number])
        else:
            public_seen[pkey]=number
        if skey in structure_seen:
            duplicate_structures.append([structure_seen[skey],number])
        else:
            structure_seen[skey]=number
        normalized=normalized_tent_key(public['size'],solution)
        if normalized in normalized_seen:
            duplicate_normalized.append([normalized_seen[normalized],number])
        else:
            normalized_seen[normalized]=number
        report['metrics']=structural_metrics(public,solution)
        if ablate:
            report['ablation']=axis_ablation(public,budget,min(timeout,3.0))
    for a,b in duplicate_public:
        failures.append(f'Public clue D4 duplicate: levels {a} and {b}')
    for a,b in duplicate_structures:
        failures.append(f'Tent-layout D4 duplicate: levels {a} and {b}')
    for a,b in duplicate_normalized:
        if b>12:
            failures.append(f'Translation-normalized tent-layout D4 duplicate: levels {a} and {b}')
    good=[r for r in reports if 'metrics' in r]
    chapters=[]
    # Range report remains useful if chapter names/metadata change.
    for start,end in [(1,12),(13,40),(41,90),(91,140),(141,200)]:
        subset=[r for r in good if start<=r['level']<=end]
        if subset:
            chapters.append({'range':[start,end],**summarize(subset)})
    return {'ok':not failures,'failures':failures,'levelCount':len(levels),
            'source':'public clues only; certificates compared after exhaustive solve',
            'legacyPreserved':not any('Legacy' in e for e in failures),
            'publicD4UniqueCount':len(public_seen),'tentLayoutD4UniqueCount':len(structure_seen),
            'publicD4Duplicates':duplicate_public,'tentLayoutD4Duplicates':duplicate_structures,
            'translationD4UniqueCount':len(normalized_seen),
            'translationD4Duplicates':duplicate_normalized,
            'legacyTranslationD4Duplicates':[pair for pair in duplicate_normalized if pair[1]<=12],
            'newTranslationD4Duplicates':[pair for pair in duplicate_normalized if pair[1]>12],
            'summary':summarize(good),'chapterSummaries':chapters,'levels':reports}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo',default='.')
    parser.add_argument('--input')
    parser.add_argument('--output',default='/tmp/tents-independent-report.json')
    parser.add_argument('--expect-count',type=int)
    parser.add_argument('--budget',type=int,default=INDEPENDENT_NODE_LIMIT)
    parser.add_argument('--timeout',type=float,default=10.0)
    parser.add_argument('--ablate',action='store_true')
    args=parser.parse_args()
    repo=Path(args.repo)
    levels=read_levels(args.input or repo/'src/games/tentsLevels.ts')
    legacy=read_levels(repo/'tests/fixtures/tentsLegacy.json')
    report=verify_corpus(levels,legacy,args.expect_count,args.budget,args.timeout,args.ablate)
    report['inputSha256']=hashlib.sha256(json.dumps(levels,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('levels',)},ensure_ascii=False,indent=2))
    raise SystemExit(0 if report['ok'] else 1)


if __name__=='__main__':
    main()
