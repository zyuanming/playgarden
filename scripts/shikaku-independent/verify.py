#!/usr/bin/env python3
"""Original independent Shikaku corpus reviewer; standard library only.

Reads JSON or a literal TypeScript level array without executing source code.
Enumerates all coordinate rectangles, then performs bounded clue-domain search.
Never imports, invokes, or copies the production solver/generator.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import time


def read_levels(path):
    text = Path(path).read_text()
    appendix = []
    if Path(path).suffix == '.ts':
        found = re.search(r'export const shikaku(?:Levels|Expansion)[^=]*=\s*(\[.*\]);?\s*$', text, re.S)
        if not found:
            raise ValueError('Expected literal Shikaku data array; code execution is not supported')
        text = found.group(1)
        if '...shikakuExpansion' in text:
            if not re.search(r'\.\.\.shikakuExpansion\s*,?\s*\]$', text):
                raise ValueError('Expansion spread must occur once, at the end')
            text = re.sub(r'\.\.\.shikakuExpansion\s*,?\s*\]$', ']', text)
            appendix = read_levels(Path(path).with_name('shikakuExpansion.ts'))
        text = re.sub(r'([\{,]\s*)([A-Za-z_$][\w$]*)(\s*:)', r'\1"\2"\3', text)
        text = re.sub(r',\s*([}\]])', r'\1', text)
    data = json.loads(text)
    if isinstance(data, dict):
        for key in ('levels', 'shikakuLevels'):
            if key in data:
                return data[key]
    if not isinstance(data, list):
        raise ValueError('Corpus must be an array or contain levels/shikakuLevels')
    return data + appendix


def integral(x):
    return isinstance(x, int) and not isinstance(x, bool)


def rectangle_cells(n, rect):
    a,b,c,d = rect
    return frozenset(y*n+x for y in range(a,c+1) for x in range(b,d+1))


def validate(level):
    errors = []
    if not isinstance(level, dict):
        return ['level is not an object']
    n = level.get('size')
    if not integral(n) or not 3 <= n <= 7:
        return ['size is not an integer from 3 through 7']
    clues = level.get('clues')
    if not isinstance(clues, list) or not clues:
        return ['clues must be a nonempty list']
    for i, clue in enumerate(clues):
        if not isinstance(clue, dict):
            errors.append(f'clue {i} is not an object')
        elif not integral(clue.get('index')) or not 0 <= clue['index'] < n*n:
            errors.append(f'clue {i} index is invalid')
        elif not integral(clue.get('area')) or not 1 <= clue['area'] <= n*n:
            errors.append(f'clue {i} area is invalid')
    if errors:
        return errors
    positions = [c['index'] for c in clues]
    if len(set(positions)) != len(positions):
        errors.append('clue positions repeat')
    if sum(c['area'] for c in clues) != n*n:
        errors.append('clue areas do not sum to board area')
    rects = level.get('solution')
    if not isinstance(rects, list) or len(rects) != len(clues):
        return errors + ['certificate count does not equal clue count']
    covered = Counter()
    clues_used = Counter()
    for i, rect in enumerate(rects):
        if (not isinstance(rect, list) or len(rect) != 4
            or not all(integral(x) for x in rect)
            or not 0 <= rect[0] <= rect[2] < n
            or not 0 <= rect[1] <= rect[3] < n):
            errors.append(f'certificate rectangle {i} has invalid coordinates')
            continue
        cells = rectangle_cells(n, rect)
        covered.update(cells)
        inside = [j for j,c in enumerate(clues) if c['index'] in cells]
        if len(inside) != 1:
            errors.append(f'certificate rectangle {i} contains {len(inside)} clues')
        else:
            j = inside[0]
            clues_used[j] += 1
            if len(cells) != clues[j]['area']:
                errors.append(f'certificate rectangle {i} area differs from its clue')
    if set(covered) != set(range(n*n)):
        errors.append('certificate does not cover every cell')
    if any(count != 1 for count in covered.values()):
        errors.append('certificate rectangles overlap')
    if clues_used != Counter(range(len(clues))):
        errors.append('certificate does not use each clue exactly once')
    return errors


def coordinate_domains(level):
    """Enumerate every top/left/bottom/right, without area-factor construction."""
    n = level['size']
    clues = level['clues']
    domains = [[] for _ in clues]
    for top in range(n):
        for left in range(n):
            for bottom in range(top,n):
                for right in range(left,n):
                    rect = (top,left,bottom,right)
                    cells = rectangle_cells(n,rect)
                    owners = [i for i,c in enumerate(clues) if c['index'] in cells]
                    if len(owners) == 1 and len(cells) == clues[owners[0]]['area']:
                        mask = sum(1 << cell for cell in cells)
                        domains[owners[0]].append((rect,mask))
    return domains


def layout(rects):
    return tuple(sorted(tuple(r) for r in rects))


def count_solutions(level, domains, budget=200000, timeout=10.0):
    start = time.monotonic()
    nodes = 0
    status = 'complete'
    solutions = []
    all_cells = (1 << (level['size']**2)) - 1

    def visit(remaining, occupied, chosen):
        nonlocal nodes,status
        if status != 'complete':
            return
        if nodes >= budget:
            status = 'budget'
            return
        if time.monotonic()-start > timeout:
            status = 'timeout'
            return
        nodes += 1
        if not remaining:
            if occupied == all_cells:
                solutions.append(layout(chosen))
                if len(solutions) >= 2:
                    status = 'multiple'
            return
        # Independent branch variable: next clue with fewest disjoint rectangles.
        feasible = [(i, [x for x in domains[i] if not x[1] & occupied]) for i in remaining]
        owner, options = min(feasible, key=lambda pair:(len(pair[1]),pair[0]))
        if not options:
            return
        # Impossible uncovered cells prune before assignment.
        possible = occupied
        for _, candidates in feasible:
            for _, mask in candidates:
                possible |= mask
        if possible != all_cells:
            return
        rest = tuple(i for i in remaining if i != owner)
        for rect,mask in options:
            visit(rest, occupied|mask, chosen+(rect,))
            if status != 'complete':
                return

    visit(tuple(range(len(domains))),0,())
    if status == 'complete':
        status = 'unique' if len(solutions) == 1 else 'no_solution'
    return {'status':status, 'nodes':nodes, 'solutionsFound':len(solutions),
            'certificateMatches':len(solutions)==1 and solutions[0]==layout(level['solution']),
            'seconds':round(time.monotonic()-start,6)}


def point(n, y, x, transform):
    if transform >= 4:
        x = n-1-x
    for _ in range(transform%4):
        y,x = x,n-1-y
    return y,x


def canonical_keys(level):
    n = level['size']
    clue_keys, partition_keys = [],[]
    for transform in range(8):
        clue_key=[]
        for clue in level['clues']:
            y,x = point(n,clue['index']//n,clue['index']%n,transform)
            clue_key.append((y*n+x,clue['area']))
        clue_keys.append(tuple(sorted(clue_key)))
        partition=[]
        for top,left,bottom,right in level['solution']:
            corners=[point(n,y,x,transform) for y,x in ((top,left),(top,right),(bottom,left),(bottom,right))]
            partition.append((min(y for y,x in corners),min(x for y,x in corners),
                              max(y for y,x in corners),max(x for y,x in corners)))
        partition_keys.append(layout(partition))
    return (n,min(clue_keys)),(n,min(partition_keys))


def logical_analysis(level, domains, mode):
    """Sound, solution-blind eliminations; no contradiction probing or search.

    singles: fixed rectangles exclude overlap.
    coverage: additionally a cell supported by only one clue forces that clue to cover it.
    shared_cells: additionally intersect each clue's candidates and exclude overlaps.
    exclusion: additionally exclude candidates with no disjoint support from another clue.
    """
    active = [list(d) for d in domains]
    events=[]
    cycles=0
    while True:
        cycles+=1
        if any(not d for d in active):
            return {'status':'contradiction','cycles':cycles,'events':events}
        changed=False

        def prune(owner, predicate, rule, detail):
            nonlocal changed
            before=active[owner]
            after=[item for item in before if predicate(item)]
            if len(after) < len(before):
                events.append({'rule':rule,'clue':owner,'removed':len(before)-len(after),'detail':detail})
                active[owner]=after
                changed=True

        for owner,options in enumerate(active):
            if len(options)==1:
                fixed=options[0][1]
                for other in range(len(active)):
                    if other != owner:
                        prune(other,lambda c: not c[1]&fixed,'single_rectangle',{'fixedClue':owner})
        if mode in ('coverage','shared_cells','exclusion'):
            for cell in range(level['size']**2):
                bit=1 << cell
                supports=[i for i,opts in enumerate(active) if any(mask&bit for _,mask in opts)]
                if not supports:
                    return {'status':'contradiction','cycles':cycles,'events':events}
                if len(supports)==1:
                    prune(supports[0],lambda c:bool(c[1]&bit),'exclusive_coverage',{'cell':cell})
        if mode in ('shared_cells','exclusion'):
            for owner,options in enumerate(active):
                if not options:
                    continue
                core=options[0][1]
                for _,mask in options[1:]:
                    core &= mask
                for other in range(len(active)):
                    if other != owner:
                        prune(other,lambda c:not c[1]&core,'required_cell_exclusion',{'requiredByClue':owner})
        if mode=='exclusion':
            for owner in range(len(active)):
                for other in range(len(active)):
                    if owner != other:
                        prune(owner,lambda c:any(not c[1]&mask for _,mask in active[other]),
                              'pairwise_support',{'otherClue':other})
        if not changed:
            break
    solved=all(len(d)==1 for d in active)
    if solved:
        masks=[d[0][1] for d in active]
        occupied=0
        for mask in masks:
            if occupied&mask:
                return {'status':'contradiction','cycles':cycles,'events':events}
            occupied |= mask
        if occupied != (1 << (level['size']**2))-1:
            return {'status':'contradiction','cycles':cycles,'events':events}
    return {'status':'solved' if solved else 'stalled','cycles':cycles,
            'remainingCandidates':sum(map(len,active)),
            'unresolvedClues':sum(len(d)>1 for d in active),
            'events':events,'ruleCounts':dict(Counter(e['rule'] for e in events))}


def compact_logic(result):
    return {k:v for k,v in result.items() if k!='events'}


def review(levels, legacy, budget, timeout, require_count=None):
    clue_seen=defaultdict(list)
    partition_seen=defaultdict(list)
    results=[]
    for i,level in enumerate(levels,1):
        errors=validate(level)
        row={'level':i,'title':level.get('title'),'size':level.get('size'),'errors':errors}
        if errors:
            row['status']='invalid'
            results.append(row)
            continue
        clues,partition=canonical_keys(level)
        clue_seen[clues].append(i)
        partition_seen[partition].append(i)
        domains=coordinate_domains(level)
        row['search']=count_solutions(level,domains,budget,timeout)
        row['status']=row['search']['status']
        row['clues']=len(domains)
        row['initialCandidates']=sum(map(len,domains))
        row['initialForcedClues']=sum(len(d)==1 for d in domains)
        row['maxClueCandidates']=max(map(len,domains))
        row['logic']={mode:compact_logic(logical_analysis(level,domains,mode))
                      for mode in ('singles','coverage','shared_cells','exclusion')}
        row['logicClass']=next((mode for mode in ('singles','coverage','shared_cells','exclusion')
                               if row['logic'][mode]['status']=='solved'),'search_required')
        if row['logicClass']!='singles':
            row['deductionTrace']=logical_analysis(level,domains,'exclusion')['events']
        results.append(row)
    duplicate_clues=[v for v in clue_seen.values() if len(v)>1]
    duplicate_partitions=[v for v in partition_seen.values() if len(v)>1]
    preserved=(levels[:len(legacy)]==legacy) if legacy else None
    statuses=Counter(row['status'] for row in results)
    summary={'levels':len(levels),'statusCounts':dict(statuses),
             'legacyPrefixPreserved':preserved,'clueD4Duplicates':duplicate_clues,
             'partitionD4Duplicates':duplicate_partitions,
             'maxSearchNodes':max((r.get('search',{}).get('nodes',0) for r in results),default=0),
             'logicClassCounts':dict(Counter(r.get('logicClass','invalid') for r in results)),
             'sizeCounts':dict(Counter(r['size'] for r in results)),
             'allCertified':all(r['status']=='unique' and r['search']['certificateMatches'] for r in results),
             'nodeBudget':budget,'timeoutSecondsPerBoard':timeout}
    summary['requiredCount']=require_count
    summary['requiredCountMatches']=require_count is None or len(levels)==require_count
    summary['allGatesPassed']=(summary['allCertified'] and not duplicate_clues
                              and not duplicate_partitions and preserved is not False
                              and summary['requiredCountMatches'])
    return {'summary':summary,'levels':results}


def selftest():
    unique={'size':3,'clues':[{'index':x,'area':3} for x in range(3)],
            'solution':[[0,x,2,x] for x in range(3)]}
    assert not validate(unique)
    assert count_solutions(unique,coordinate_domains(unique))['status']=='unique'
    assert count_solutions(unique,coordinate_domains(unique),1)['status']=='budget'
    assert count_solutions(unique,coordinate_domains(unique),timeout=-1)['status']=='timeout'
    ambiguous={'size':3,'clues':[{'index':x,'area':3} for x in (0,4,8)],
               'solution':[[y,0,y,2] for y in range(3)]}
    assert count_solutions(ambiguous,coordinate_domains(ambiguous))['status']=='multiple'
    broken={**unique,'solution':[[0,0,2,0]]*3}
    assert validate(broken)
    assert validate({**unique,'size':True})
    rotated={'size':3,'clues':[{'index':3*x+2,'area':3} for x in range(3)],
             'solution':[[y,0,y,2] for y in range(3)]}
    assert canonical_keys(unique)==canonical_keys(rotated)
    moved={**unique,'clues':[{'index':x+3,'area':3} for x in range(3)]}
    assert canonical_keys(unique)[0] != canonical_keys(moved)[0]
    assert canonical_keys(unique)[1] == canonical_keys(moved)[1]
    for mode in ('singles','coverage','shared_cells','exclusion'):
        assert logical_analysis(unique,coordinate_domains(unique),mode)['status']=='solved'
    assert logical_analysis(ambiguous,coordinate_domains(ambiguous),'exclusion')['status']=='stalled'
    return 'Independent verifier self-checks passed'


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('corpus',nargs='?')
    parser.add_argument('--repo',help='Repository root; reads literal source arrays, never executes TypeScript')
    parser.add_argument('--legacy',default=str(Path(__file__).with_name('legacy12.json')))
    parser.add_argument('--output')
    parser.add_argument('--budget',type=int,default=200000)
    parser.add_argument('--timeout',type=float,default=10.0)
    parser.add_argument('--selftest',action='store_true')
    parser.add_argument('--require-200',action='store_true',help='Fail unless there are exactly 200 levels')
    parser.add_argument('--require-count',type=int)
    args=parser.parse_args()
    if not 1 <= args.budget <= 200000:
        parser.error('budget must be between 1 and 200000')
    if args.repo and args.corpus:
        parser.error('provide corpus or --repo, not both')
    if args.require_200 and args.require_count not in (None,200):
        parser.error('--require-200 conflicts with --require-count')
    if args.repo:
        args.corpus=str(Path(args.repo)/'src/games/shikakuLevels.ts')
    if args.selftest:
        print(selftest())
    if args.corpus:
        data=read_levels(args.corpus)
        required=200 if args.require_200 else args.require_count
        result=review(data,read_levels(args.legacy) if args.legacy else [],args.budget,args.timeout,required)
        result['sourceSha256']=hashlib.sha256(Path(args.corpus).read_bytes()).hexdigest()
        public=[{'size':l['size'],'clues':l['clues']} for l in data]
        result['publicClueSha256']=hashlib.sha256(json.dumps(public,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
        if args.output:
            Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(result['summary'],ensure_ascii=False,indent=2))
        if not result['summary']['allGatesPassed']:
            raise SystemExit(1)
    elif not args.selftest:
        parser.error('provide corpus, --repo, or --selftest')
