"""Reject intentionally corrupted campaign certificates without production code."""
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
import argparse,json,time
from oracle import signature
from validate_campaign import ValidationError,canonical_string,validate


def write_fixture(root,data):
    (root/'docs/blackbox').mkdir(parents=True,exist_ok=True)
    (root/'src/games').mkdir(parents=True,exist_ok=True)
    (root/'docs/blackbox/campaign.json').write_text(json.dumps(data,ensure_ascii=False))
    levels=[{k:l[k] for k in ('id','title','chapter','size','atoms')} for l in data['levels']]
    chapters=[{k:c[k] for k in ('id','title','lesson','count')} for c in data['chapters']]
    (root/'src/games/blackboxLevels.ts').write_text('export const blackboxChapters = '+json.dumps(chapters,ensure_ascii=False)+';\nexport const blackboxLevels = '+json.dumps(levels,ensure_ascii=False)+';\n')


def mutations(original):
    cases=[]
    def case(name,change,error):
        value=deepcopy(original);change(value);cases.append((name,value,error))
    case('wrong response',lambda d:d['levels'][0]['signature'].__setitem__(0,-1),'signature mismatch')
    case('duplicate cell',lambda d:d['levels'][0]['atoms'].append(d['levels'][0]['atoms'][0]),'Invalid board or repeated cell')
    case('negative cell',lambda d:d['levels'][0]['atoms'].__setitem__(0,-1),'Invalid board or repeated cell')
    case('nonintegral cell',lambda d:d['levels'][0]['atoms'].__setitem__(0,1.5),'Invalid board or repeated cell')
    case('wrong D4 key',lambda d:d['levels'][0].__setitem__('canonical','bogus'),'canonical mismatch')
    case('wrong best probe',lambda d:d['levels'][0]['probeTrace'][0].__setitem__('port',0),'not expected-first optimum')
    case('wrong candidate count',lambda d:d['levels'][0]['probeTrace'][0].__setitem__('candidates',1),'remaining-candidate count mismatch')
    case('wrong worst bucket',lambda d:d['levels'][0]['probeTrace'][0].__setitem__('worst',0),'worst-bucket mismatch')
    case('wrong partition count',lambda d:d['levels'][0]['probeTrace'][0].__setitem__('partitions',1),'partition count mismatch')
    case('wrong metric',lambda d:d['levels'][0]['metrics'].__setitem__('hits',0),'metrics mismatch')
    def duplicate(d):
        level=deepcopy(d['levels'][0]);level['id']=d['levels'][1]['id'];d['levels'][1]=level
    case('D4 duplicate',duplicate,'D4 duplicate')
    def ambiguous(d):
        l=next(l for l in d['levels'] if l['size']==4 and len(l['atoms'])==3)
        l['atoms']=[0,2,14];l['signature']=list(signature(4,l['atoms']));l['canonical']=canonical_string(4,l['atoms'])
    case('observationally ambiguous level',ambiguous,'full signature has equivalent layouts')
    return cases


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--repo',required=True,type=Path);parser.add_argument('--output',type=Path)
    args=parser.parse_args();original=json.loads((args.repo/'docs/blackbox/campaign.json').read_text())
    start=time.monotonic();results=[]
    with TemporaryDirectory(prefix='blackbox-validation-') as directory:
        root=Path(directory)
        for name,data,expected in mutations(original):
            write_fixture(root,data)
            try:
                validate(root)
            except (ValidationError,ValueError) as exc:
                assert expected in str(exc),(name,expected,str(exc))
                results.append({'case':name,'rejected':True,'reason':str(exc)})
            else:
                raise AssertionError(f'Corrupt case passed: {name}')
        write_fixture(root,original)
        runtime=root/'src/games/blackboxLevels.ts';runtime.write_text(runtime.read_text().replace('blackbox-001','blackbox-corrupt'))
        try:
            validate(root)
        except ValidationError as exc:
            assert 'Runtime levels differ' in str(exc)
            results.append({'case':'runtime/certificate divergence','rejected':True,'reason':str(exc)})
        else:
            raise AssertionError('Runtime divergence passed')
    report={'status':'passed','mutationCases':len(results),'seconds':round(time.monotonic()-start,3),'cases':results}
    if args.output:args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
