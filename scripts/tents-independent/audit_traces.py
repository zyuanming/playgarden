#!/usr/bin/env python3
"""Independently audit Tents authoring traces and actual rule-family progression.

No production/generator imports. Reconstructs each premise from public clues;
line supports are enumerated by binary choices instead of authoring combinations.
Every claimed change is also checked by the independent tree-assignment oracle
under its opposite value. Separately computes parallel fixed-point closures of
weaker rule families; authoring trace length alone is not a difficulty proof.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import statistics

from verify import (PUBLIC_FIELDS, adjacent, integral, read_levels, solve_public,
                    touches, validate_placement, validate_public)


def initialize(level):
    n=level['size'];trees=set(level['trees'])
    return [-1 if p not in trees and any(adjacent(n,t,p) for t in trees) else 0
            for p in range(n*n)]


def line_data(level, axis, index):
    n=level['size']
    if axis not in ('row','column') or not integral(index) or not 0<=index<n:
        raise ValueError('invalid line identity')
    cells=[p for p in range(n*n) if (p//n if axis=='row' else p%n)==index]
    return cells,level['rowCounts' if axis=='row' else 'columnCounts'][index]


def line_supports(level, state, axis, index):
    cells,target=line_data(level,axis,index)
    supports=[]
    # Full local binary state space, independent of generator combinations().
    for bits in range(1<<len(cells)):
        if bits.bit_count()!=target or bits & (bits<<1):
            continue
        selected=tuple(p for bit,p in enumerate(cells) if bits>>bit&1)
        if all(state[p]==-1 or state[p]==int(p in selected) for p in cells):
            supports.append(selected)
    return supports


def supported_changes(level,state,step):
    """Return every unknown-cell implication licensed by a stated local premise."""
    n=level['size'];rule=step.get('rule');changes={}
    if rule=='spacing':
        tent=step.get('tent')
        if not integral(tent) or not 0<=tent<n*n or state[tent]!=1:
            raise ValueError('spacing premise is not an established tent')
        changes={p:0 for p in range(n*n) if state[p]==-1 and touches(n,p,tent)}
    elif rule in ('line-count','line-pattern'):
        axis,index=step.get('axis'),step.get('index')
        cells,target=line_data(level,axis,index)
        if step.get('target')!=target:
            raise ValueError('reported line target differs from public clue')
        if rule=='line-count':
            fixed=sum(state[p]==1 for p in cells)
            unknown=[p for p in cells if state[p]==-1]
            if fixed>target or fixed+len(unknown)<target:
                raise ValueError('line-count premise is inconsistent')
            if fixed==target:
                changes={p:0 for p in unknown}
            elif fixed+len(unknown)==target:
                changes={p:1 for p in unknown}
        else:
            supports=line_supports(level,state,axis,index)
            if not supports:
                raise ValueError('line-pattern premise has no possibilities')
            reported=step.get('patterns')
            if not isinstance(reported,list) or sorted(tuple(s) for s in reported)!=sorted(supports):
                raise ValueError('reported line patterns omit or invent local possibilities')
            for p in cells:
                values={int(p in support) for support in supports}
                if state[p]==-1 and len(values)==1:
                    changes[p]=values.pop()
    elif rule in ('tree-single','tree-space'):
        tree=step.get('tree')
        if tree not in level['trees']:
            raise ValueError('tree premise is not a public tree')
        domain=[p for p in range(n*n) if adjacent(n,tree,p) and state[p]!=0]
        if not domain:
            raise ValueError('tree premise has no available tent')
        if rule=='tree-single':
            if len(domain)==1 and state[domain[0]]==-1:
                changes={domain[0]:1}
        else:
            if sorted(step.get('domain',[]))!=domain:
                raise ValueError('reported tree domain differs from current public state')
            changes={p:0 for p in range(n*n) if state[p]==-1 and p not in domain
                     and all(touches(n,p,possible) for possible in domain)}
    else:
        raise ValueError(f'unknown trace rule {rule!r}')
    return changes


def audit_trace(level,metrics,oracle_checks=True):
    if validate_public(level):
        return {'ok':False,'errors':['invalid public level']}
    state=initialize(level);errors=[];rules=Counter();checked=0;oracle_nodes=0
    trace=metrics.get('trace')
    if not isinstance(trace,list):
        return {'ok':False,'errors':['trace is not an array']}
    if metrics.get('steps')!=len(trace):
        errors.append('step summary differs from trace length')
    if metrics.get('initialCandidates')!=state.count(-1):
        errors.append('initial candidate summary differs from public clues')
    for number,step in enumerate(trace,1):
        prefix=f'step {number}'
        try:
            supported=supported_changes(level,state,step)
            recorded=step.get('changes')
            if not isinstance(recorded,list) or not recorded:
                raise ValueError('step has no changes')
            seen=set()
            for item in recorded:
                if not isinstance(item,list) or len(item)!=2:
                    raise ValueError('invalid change record')
                p,value=item
                if not integral(p) or not 0<=p<len(state) or not integral(value) or value not in (0,1):
                    raise ValueError('invalid change coordinate/value')
                if p in seen or state[p]!=-1:
                    raise ValueError('step repeats or rewrites an established cell')
                seen.add(p)
                if supported.get(p)!=value:
                    raise ValueError(f'cell {p}={value} is not implied by its stated local premise')
                if oracle_checks:
                    tents=[i for i,s in enumerate(state) if s==1]
                    grass=[i for i,s in enumerate(state) if s==0]
                    (grass if value else tents).append(p)
                    opposite=solve_public({k:level[k] for k in PUBLIC_FIELDS},force_tents=tents,force_grass=grass)
                    oracle_nodes+=opposite['nodes']
                    if opposite['status']!='no_solution':
                        raise ValueError(f'opposite value oracle is {opposite["status"]} for cell {p}')
                    checked+=1
            # Audit the whole premise against the pre-step state before committing.
            for p,value in recorded:
                state[p]=value
            rules[step['rule']]+=1
        except (ValueError,TypeError,KeyError) as error:
            errors.append(f'{prefix}: {error}')
            break
    tents=[p for p,v in enumerate(state) if v==1]
    final_errors=validate_placement(level,tents)
    if final_errors:
        errors.append('trace does not finish a valid placement: '+', '.join(final_errors))
    if dict(rules)!=metrics.get('rules'):
        errors.append('rule summary differs from replayed steps')
    return {'ok':not errors,'errors':errors,'steps':len(trace),'rules':dict(rules),
            'oppositeValueChecks':checked,'oppositeOracleNodes':oracle_nodes,
            'remainingUnmarkedGrass':state.count(-1)}


def logical_closure(level, family):
    """Parallel least fixed point, independent of the author's priority scheduling."""
    if family not in ('basic','patterns','tree-space'):
        raise ValueError('unknown deduction family')
    state=initialize(level);n=level['size'];rounds=0;steps=0;rules=Counter()
    while True:
        tents=[p for p,v in enumerate(state) if v==1]
        if not validate_placement(level,tents):
            return {'status':'solved','rounds':rounds,'changes':steps,'rules':dict(rules)}
        deductions=defaultdict(set)
        events=[]
        for tent in tents:
            events.append({'rule':'spacing','tent':tent})
        for axis in ('row','column'):
            for index in range(n):
                cells,target=line_data(level,axis,index)
                events.append({'rule':'line-count','axis':axis,'index':index,'target':target})
                if family!='basic':
                    events.append({'rule':'line-pattern','axis':axis,'index':index,'target':target,
                                   'patterns':[list(x) for x in line_supports(level,state,axis,index)]})
        for tree in level['trees']:
            events.append({'rule':'tree-single','tree':tree})
            if family=='tree-space':
                domain=[p for p in range(n*n) if adjacent(n,tree,p) and state[p]!=0]
                events.append({'rule':'tree-space','tree':tree,'domain':domain})
        try:
            for event in events:
                changes=supported_changes(level,state,event)
                for p,value in changes.items():
                    deductions[p].add(value)
                if changes:
                    rules[event['rule']]+=1
        except ValueError as error:
            return {'status':'contradiction','error':str(error),'rounds':rounds}
        if any(len(values)>1 for values in deductions.values()):
            return {'status':'contradiction','error':'conflicting parallel deductions','rounds':rounds}
        if not deductions:
            return {'status':'stalled','rounds':rounds,'changes':steps,
                    'unknownCells':state.count(-1),'tentsFound':len(tents),'rules':dict(rules)}
        for p,values in deductions.items():
            state[p]=next(iter(values))
        steps+=len(deductions);rounds+=1
        if rounds>n*n:
            return {'status':'budget','rounds':rounds}


def audit_campaign(levels,authoring,oracle_checks=True):
    failures=[];reports=[]
    entries=authoring.get('levels',[])
    digest=lambda value:hashlib.sha256(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
    if authoring.get('total')!=len(levels):
        failures.append('Authoring total differs from corpus length')
    if authoring.get('legacyHash')!=digest(levels[:12]):
        failures.append('Legacy provenance hash mismatch')
    if authoring.get('expansionHash')!=digest(levels[12:]):
        failures.append('Expansion provenance hash mismatch')
    if len(entries)!=len(levels)-12:
        failures.append('Authoring entry count differs from expansion length')
    for index,level in enumerate(levels[12:],12):
        entry=entries[index-12] if index-12<len(entries) else {}
        if entry.get('id')!=level.get('id') or entry.get('index')!=index:
            failures.append(f'Level {index+1}: trace identity/index mismatch')
        raw=[level[k] for k in PUBLIC_FIELDS]
        digest=hashlib.sha256(json.dumps(raw,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
        if entry.get('clueHash')!=digest:
            failures.append(f'Level {index+1}: public-clue trace hash mismatch')
        audit=audit_trace({k:level[k] for k in PUBLIC_FIELDS},entry.get('metrics',{}),oracle_checks)
        if not audit['ok']:
            failures.extend(f'Level {index+1}: {e}' for e in audit['errors'])
        closure={family:logical_closure(level,family) for family in ('basic','patterns','tree-space')}
        chapter=level.get('chapter')
        expected={'basic':'solved'} if chapter==1 else {'basic':'stalled','patterns':'solved'} if chapter==2 else {'patterns':'stalled','tree-space':'solved'} if chapter in (3,4) else None
        if expected is None:
            failures.append(f'Level {index+1}: invalid chapter metadata')
        else:
            for family,status in expected.items():
                if closure[family]['status']!=status:
                    failures.append(f'Level {index+1}: {family} closure {closure[family]["status"]}, expected {status}')
        if chapter==4 and (level['size']!=7 or len(level['trees'])<8 or sum(x==0 for x in level['rowCounts']+level['columnCounts'])>2 or audit.get('rules',{}).get('line-pattern',0)<2 or audit.get('steps',0)<18):
            failures.append(f'Level {index+1}: challenge minimums not met')
        reports.append({'level':index+1,'id':level.get('id'),'chapter':chapter,'trace':audit,'closure':closure})
    chapters=[]
    for chapter in range(1,5):
        group=[r for r in reports if r['chapter']==chapter]
        if not group:
            continue
        steps=[r['trace']['steps'] for r in group]
        chapters.append({'chapter':chapter,'count':len(group),
                         'traceSteps':{'min':min(steps),'median':statistics.median(steps),'max':max(steps)},
                         'closureStatuses':{f:dict(Counter(r['closure'][f]['status'] for r in group)) for f in ('basic','patterns','tree-space')},
                         'closureRounds':{f:statistics.median(r['closure'][f]['rounds'] for r in group) for f in ('basic','patterns','tree-space')},
                         'ruleUses':dict(sum((Counter(r['trace']['rules']) for r in group),Counter()))})
    return {'ok':not failures,'failures':failures,'auditedLevels':len(reports),
            'auditedSteps':sum(r['trace'].get('steps',0) for r in reports),
            'oppositeValueChecks':sum(r['trace'].get('oppositeValueChecks',0) for r in reports),
            'method':'independent local-premise replay, opposite-value exhaustive checks, and parallel weaker-family closures',
            'chapters':chapters,'levels':reports}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo',default='.')
    parser.add_argument('--output',default='/tmp/tents-trace-audit.json')
    parser.add_argument('--skip-opposite-checks',action='store_true')
    args=parser.parse_args();root=Path(args.repo)
    levels=read_levels(root/'src/games/tentsLevels.ts')
    authoring=json.loads((root/'docs/tents/authoring-report.json').read_text())
    report=audit_campaign(levels,authoring,not args.skip_opposite_checks)
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='levels'},ensure_ascii=False,indent=2))
    raise SystemExit(0 if report['ok'] else 1)


if __name__=='__main__':
    main()
