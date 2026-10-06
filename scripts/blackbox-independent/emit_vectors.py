"""Emit all supported 1–4-star oracle signatures for JS differential tests."""
from itertools import combinations
from pathlib import Path
import argparse,json
from oracle import signature

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path);args=p.parse_args()
    vectors=[{'size':n,'atoms':list(c),'signature':list(signature(n,c))}
             for n in (3,4,5) for k in (1,2,3,4) for c in combinations(range(n*n),k)]
    document={'portOrder':'N,E,S,W; natural coordinate order','hit':-1,'reflection':-2,
              'layouts':len(vectors),'ports':sum(len(v['signature']) for v in vectors),'vectors':vectors}
    text=json.dumps(document,separators=(',',':'))+'\n'
    if args.output:args.output.write_text(text)
    else:print(text,end='')
