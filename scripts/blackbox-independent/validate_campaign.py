"""Validate campaign JSON using independent exhaustive Python geometry.

No production JavaScript/TypeScript is imported or executed. The generated TS
arrays are parsed as JSON data only to detect runtime/certificate divergence.
"""
from __future__ import annotations
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import argparse
import json
import re
import sys
import time
from oracle import Universe, checked_cells, d4_canonical, signature, trace
from selftest import basic_tests, transform_cells


class ValidationError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ValidationError(message)


def canonical_string(n, cells):
    return min(','.join(map(str,transform_cells(n,cells,t))) for t in range(8))


def digest(data):
    return sha256(data).hexdigest()


def parse_exported_json(source, name):
    match=re.search(r'\bexport\s+const\s+'+re.escape(name)+r'\b[^=]*=\s*',source)
    require(match is not None, f'Runtime export missing: {name}')
    try:
        value,_=json.JSONDecoder().raw_decode(source[match.end():])
    except ValueError as exc:
        raise ValidationError(f'Runtime export is not plain JSON: {name}') from exc
    return value


def measure(n,atoms,sig,probes):
    return {'greedyProbes':probes,
            'edge':sum(c%n in (0,n-1) or c//n in (0,n-1) for c in atoms),
            'adjacent':sum(abs(a%n-b%n)+abs(a//n-b//n)==1 for j,a in enumerate(atoms) for b in atoms[j+1:]),
            'hits':sig.count(-1),'returns':sig.count(-2),'through':sum(r>=0 for r in sig)}


def validate(repo):
    start=time.monotonic()
    basic_tests()
    path=repo/'docs/blackbox/campaign.json'
    runtime_path=repo/'src/games/blackboxLevels.ts'
    raw=path.read_bytes()
    data=json.loads(raw)
    require(type(data)==dict and data.get('version')==1,'Unknown campaign version')
    levels=data.get('levels')
    chapters=data.get('chapters')
    require(type(levels)==list and type(chapters)==list,'Campaign arrays missing')
    require(len(chapters)==6 and len(levels)==84,'Expected six chapters, 84 levels')
    expected_counts=[3,9,12,16,20,24]
    expected_scopes=[(3,1),(4,2),(4,3),(5,2),(5,3),(5,4)]
    require(len(set(c['id'] for c in chapters))==len(chapters),'Repeated chapter ID')
    for c,count,scope in zip(chapters,expected_counts,expected_scopes):
        require((c['size'],c['countAtoms'])==scope and c['count']==count,f'Chapter definition mismatch: {c}')
    source=runtime_path.read_text()
    runtime_levels=parse_exported_json(source,'blackboxLevels')
    runtime_chapters=parse_exported_json(source,'blackboxChapters')
    expected_runtime=[{key:l[key] for key in ('id','title','chapter','size','atoms')} for l in levels]
    expected_chapters=[{key:c[key] for key in ('id','title','lesson','count')} for c in chapters]
    require(runtime_levels==expected_runtime,'Runtime levels differ from campaign certificates')
    require(runtime_chapters==expected_chapters,'Runtime chapters differ from campaign certificates')
    universes={}
    proofs=[]
    seen_ids=set();seen_canonical=set()
    counts=Counter();depths={i:[] for i in range(len(chapters))}
    chapter_sequence=[]
    for level in levels:
        lid=level['id'];n=level['size'];atoms=level['atoms'];ci=level['chapter']
        require(type(lid)==str and lid not in seen_ids,f'Duplicate/invalid ID {lid}')
        seen_ids.add(lid)
        require(type(ci)==int and 0<=ci<len(chapters),f'{lid}: invalid chapter')
        require(type(n)==int and n in (3,4,5) and type(atoms)==list,f'{lid}: invalid dimensions')
        checked_cells(n,atoms)
        require(atoms==sorted(atoms) and 1<=len(atoms)<=4,f'{lid}: unsorted/invalid atoms')
        require((n,len(atoms))==expected_scopes[ci],f'{lid}: wrong chapter scope')
        chapter_sequence.append(ci);counts[ci]+=1
        key=n,len(atoms)
        if key not in universes: universes[key]=Universe(*key)
        u=universes[key]
        expected_sig=signature(n,atoms)
        require(level['signature']==list(expected_sig),f'{lid}: signature mismatch')
        for p,r in enumerate(expected_sig):
            require(r<0 or expected_sig[r]==p,f'{lid}: nonreciprocal port {p}')
        require(len(u.groups[expected_sig])==1,f'{lid}: full signature has equivalent layouts')
        canonical=canonical_string(n,atoms)
        require(level['canonical']==canonical,f'{lid}: canonical mismatch ({canonical})')
        require((n,canonical) not in seen_canonical,f'{lid}: D4 duplicate')
        seen_canonical.add((n,canonical))
        observations={};trace_proof=[]
        for step_number,step in enumerate(level['probeTrace'],1):
            ids=u.candidates(observations)
            require(len(ids)>1,f'{lid}: redundant trace step {step_number}')
            best=u.best_probe(observations,ids)
            require(best is not None,f'{lid}: no discriminating trace probe')
            require(step['port']==best['port'],f'{lid}: step {step_number} probe is not expected-first optimum ({step["port"]} vs {best["port"]})')
            require(step['result']==expected_sig[step['port']],f'{lid}: trace response mismatch')
            require(step['worst']==best['worstRemaining'],f'{lid}: worst-bucket mismatch')
            require(step['partitions']==best['partitions'],f'{lid}: partition count mismatch')
            observations=u.add_observation(observations,step['port'],step['result'])
            remaining=u.candidates(observations)
            require(step['candidates']==len(remaining),f'{lid}: remaining-candidate count mismatch')
            require(0<len(remaining)<len(ids),f'{lid}: trace did not narrow candidates')
            # Fair deductions must hold for every remaining layout, not target-only.
            facts=u.facts(remaining)
            require(set(facts['stars'])<=set(atoms) and not set(facts['empty'])&set(atoms),f'{lid}: unsound candidate facts')
            trace_proof.append({'port':step['port'],'result':step['result'],'remaining':len(remaining),
                                'sumSquares':best['sumSquares'],'worst':best['worstRemaining']})
        ids=u.candidates(observations)
        require(len(ids)==1 and u.layouts[ids[0]]==tuple(atoms),f'{lid}: trace does not identify unique layout')
        metrics=measure(n,atoms,expected_sig,len(level['probeTrace']))
        require(level['metrics']==metrics,f'{lid}: metrics mismatch {level["metrics"]} != {metrics}')
        depths[ci].append(metrics['greedyProbes'])
        proofs.append({'id':lid,'size':n,'stars':len(atoms),'canonical':canonical,
                       'universe':len(u.layouts),'signatureMatches':1,'greedyProbes':metrics['greedyProbes'],
                       'signatureSha256':digest(json.dumps(expected_sig,separators=(',',':')).encode()),
                       'probeTrace':trace_proof})
    require(chapter_sequence==sorted(chapter_sequence),'Campaign chapters interleaved')
    stats=[]
    for ci,c in enumerate(chapters):
        require(counts[ci]==expected_counts[ci],f'{c["id"]}: level count mismatch')
        require(depths[ci]==sorted(depths[ci]),f'{c["id"]}: not ordered by strategy depth')
        u=universes[expected_scopes[ci]]
        unique=[indices[0] for indices in u.groups.values() if len(indices)==1]
        st={'chapter':c['id'],'universe':len(u.layouts),'uniqueLayouts':len(unique),
            'uniqueD4Classes':len({d4_canonical(u.n,u.layouts[i]) for i in unique}),
            'selected':counts[ci],'greedyRange':[min(depths[ci]),max(depths[ci])]}
        stats.append(st)
    require(data['stats']==stats,'Chapter metadata statistics mismatch')
    witness=[0,8],[2,6]
    witness_sig=signature(3,witness[0])
    require(witness_sig==signature(3,witness[1]),'Equivalence selftest failed')
    return {'status':'passed','schemaVersion':1,'checkedAt':datetime.now(timezone.utc).isoformat(),
            'seconds':round(time.monotonic()-start,3),'campaignSha256':digest(raw),
            'runtimeSha256':digest(runtime_path.read_bytes()),'levelsVerified':len(proofs),
            'chaptersVerified':len(chapters),'allSelectedLayoutsUnique':True,'allSelectedD4Distinct':True,
            'probePolicy':'sumSquares, worstBucket, port; known observations only',
            'difficultyClaim':'Recorded strategy trace length; not a minimum-probe proof',
            'progression':'Nondecreasing within chapters; chapter 4 intentionally resets to two stars on a larger grid',
            'equivalentAnswerWitness':{'size':3,'atomsA':witness[0],'atomsB':witness[1],'signature':witness_sig},
            'universeLayoutsEnumerated':sum(len(u.layouts) for u in universes.values()),
            'universePortsComputed':sum(4*u.n*len(u.layouts) for u in universes.values()),
            'chapterStats':stats,'levels':proofs}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--repo',required=True,type=Path)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    try:
        result=validate(args.repo)
    except (ValidationError,ValueError,KeyError,TypeError,AssertionError) as exc:
        print(f'FAIL: {exc}',file=sys.stderr)
        sys.exit(1)
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='levels'},ensure_ascii=False,indent=2))
