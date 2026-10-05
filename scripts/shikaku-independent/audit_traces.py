#!/usr/bin/env python3
"""Validate supplied author deductions as proofs, without executing their generator."""
from collections import Counter
import argparse
import hashlib
import json
from pathlib import Path
import statistics
from verify import coordinate_domains, layout, read_levels, rectangle_cells, review


def validate_trace(level, entry):
    n=level['size']
    initial=coordinate_domains(level)
    domains={i:[(r,rectangle_cells(n,r)) for r,m in d] for i,d in enumerate(initial)}
    initial_singles=sum(len(d)==1 for d in domains.values())
    initial_count=sum(map(len,domains.values()))
    occupied=set()
    placed=[]
    errors=[]
    removals=0
    types=Counter()
    metrics=entry['metrics']
    for i,step in enumerate(metrics['trace']):
        kind=step['rule']
        owner=step['clue']
        if owner not in domains:
            errors.append(f'step {i}: owner already placed or unknown')
            break
        removed=0
        if kind=='single':
            if len(domains[owner])!=1:
                errors.append(f'step {i}: single is not forced')
                break
            rect,cells=domains.pop(owner)[0]
            if list(rect)!=step['rectangle'] or occupied&cells:
                errors.append(f'step {i}: single rectangle is incorrect or overlapping')
                break
            occupied.update(cells)
            placed.append(rect)
            for other in domains:
                before=domains[other]
                domains[other]=[(r,c) for r,c in before if not c&cells]
                removed+=len(before)-len(domains[other])
        elif kind=='coverage':
            cell=step['cell']
            options=[(j,r,c) for j,ds in domains.items() for r,c in ds if cell in c]
            if cell in occupied or not options or {j for j,r,c in options}!={owner}:
                errors.append(f'step {i}: coverage is not owned by exactly one clue')
                break
            removed=len(domains[owner])-len(options)
            domains[owner]=[(r,c) for j,r,c in options]
            if not removed:
                errors.append(f'step {i}: coverage does not remove a candidate')
        elif kind=='intersection':
            common=set.intersection(*(set(c) for r,c in domains[owner]))
            if sorted(common)!=step['cells']:
                errors.append(f'step {i}: stated shared cells differ from actual intersection')
                break
            for other in domains:
                if other==owner:
                    continue
                before=domains[other]
                domains[other]=[(r,c) for r,c in before if not c&common]
                removed+=len(before)-len(domains[other])
            if not removed:
                errors.append(f'step {i}: shared cells do not eliminate a candidate')
        else:
            errors.append(f'step {i}: unknown proof rule {kind}')
            break
        if removed!=step['removed']:
            errors.append(f'step {i}: removed count mismatch {removed} vs {step["removed"]}')
        if any(not ds for ds in domains.values()):
            errors.append(f'step {i}: empty candidate domain')
            break
        removals+=removed
        types[kind]+=1
    if domains or occupied!=set(range(n*n)):
        errors.append('trace does not finish a full tiling')
    if layout(placed)!=layout(level['solution']):
        errors.append('trace result differs from independently validated certificate')
    expected={'initialSingles':initial_singles,'candidates':initial_count,
              'singles':types['single'],'coverage':types['coverage'],
              'intersection':types['intersection'],'eliminated':removals,
              'steps':sum(types.values())}
    for field,value in expected.items():
        if metrics.get(field)!=value:
            errors.append(f'metric {field} mismatch')
    group=entry['chapter']
    if group=='factors' and not(initial_singles>=1 and types['intersection']==0):
        errors.append('factors trace gate failed')
    if group=='coverage' and not(types['coverage']>=2 and types['intersection']==0):
        errors.append('coverage trace gate failed')
    if group=='intersections' and not(types['intersection']>=1 and types['coverage']>=1):
        errors.append('intersections trace gate failed')
    if group=='challenge' and not(types['intersection']>=2 and types['coverage']>=2 and initial_singles<=2):
        errors.append('challenge trace gate failed')
    return {'level':entry['index']+1,'errors':errors,'metrics':expected}


def guillotine(rects):
    if len(rects)==1:
        return True
    ymin=min(r[0] for r in rects); ymax=max(r[2] for r in rects)
    xmin=min(r[1] for r in rects); xmax=max(r[3] for r in rects)
    for dim,lo,hi in [(0,ymin,ymax),(1,xmin,xmax)]:
        for cut in range(lo+1,hi+1):
            if not any(r[dim]<cut<=r[dim+2] for r in rects):
                first=[r for r in rects if r[dim+2]<cut]
                second=[r for r in rects if r[dim]>=cut]
                if first and second and guillotine(first) and guillotine(second):
                    return True
    return False


def audit(levels,author):
    results=[validate_trace(levels[e['index']],e) for e in author['levels']]
    non_slicing=[i+1 for i,l in enumerate(levels) if not guillotine(l['solution'])]
    groups=[]
    independent=review(levels,[],200000,10)
    for start,end in [(0,12),(12,40),(40,90),(90,140),(140,200)]:
        data=independent['levels'][start:end]
        groups.append({'startLevel':start+1,'endLevel':end,
                       'logicClassCounts':dict(Counter(l['logicClass'] for l in data)),
                       'medianInitialCandidates':statistics.median(l['initialCandidates'] for l in data),
                       'medianCandidateExcess':statistics.median(l['initialCandidates']-l['clues'] for l in data),
                       'medianClues':statistics.median(l['clues'] for l in data),
                       'medianCandidateRatio':round(statistics.median(l['initialCandidates']/l['clues'] for l in data),2),
                       'allSingletonLevels':[l['level'] for l in data if l['initialCandidates']==l['clues']]})
    public=[{'size':l['size'],'clues':l['clues']} for l in levels]
    public_hash=hashlib.sha256(json.dumps(public,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
    summary={'traceCount':len(results),'traceErrors':[r for r in results if r['errors']],
             'publicClueSha256':public_hash,'authorHashMatches':public_hash==author.get('contentHash'),
             'traceIndicesMatch':sorted(e['index'] for e in author['levels'])==list(range(12,len(levels))),
             'nonGuillotineCount':len(non_slicing),'nonGuillotineLevels':non_slicing,
             'groups':groups}
    summary['independentGroupingPassed']=(len(levels)==200
        and all(r['logicClass']=='coverage' for r in independent['levels'][40:90])
        and all(r['logicClass']=='shared_cells' for r in independent['levels'][90:200]))
    summary['allGatesPassed']=(not summary['traceErrors'] and summary['authorHashMatches']
                              and summary['traceIndicesMatch'] and independent['summary']['allGatesPassed']
                              and summary['independentGroupingPassed'])
    output={'summary':summary,'levels':results}
    return output


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--repo',help='Repository root; reads corpus source and authoring report as data only')
    parser.add_argument('--corpus')
    parser.add_argument('--author-report')
    parser.add_argument('--output')
    parser.add_argument('--require-200',action='store_true')
    args=parser.parse_args()
    if args.repo:
        if args.corpus or args.author_report:
            parser.error('--repo cannot be combined with --corpus/--author-report')
        args.corpus=str(Path(args.repo)/'src/games/shikakuLevels.ts')
        args.author_report=str(Path(args.repo)/'docs/shikaku/authoring-report.json')
    if not args.corpus or not args.author_report:
        parser.error('provide --repo or both --corpus and --author-report')
    levels=read_levels(args.corpus)
    result=audit(levels,json.loads(Path(args.author_report).read_text()))
    if args.require_200 and len(levels)!=200:
        result['summary']['allGatesPassed']=False
        result['summary']['requiredCountError']='Expected 200 levels'
    if args.output:
        Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['summary'],ensure_ascii=False,indent=2))
    if not result['summary']['allGatesPassed']:
        raise SystemExit(1)
