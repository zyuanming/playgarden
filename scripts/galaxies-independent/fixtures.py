#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Small exhaustive oracle cases for the TS completion validator."""
import itertools,json
from verify import valid,touches
cases=[]
pts=list(itertools.product(range(1,4),repeat=2))
for k in range(1,4):
 for cs in itertools.combinations(pts,k):
  if any(touches(2,a)&touches(2,b) for a,b in itertools.combinations(cs,2)):continue
  states=list(itertools.product(range(-1,k),repeat=4))
  cases.append({'size':2,'centers':cs,'states':states,'expected':[valid(2,cs,s) for s in states]})
for cs,values in [([(3,3)],range(-1,1)), ([(1,3),(3,3),(5,3)],range(3))]:
 states=list(itertools.product(values,repeat=9))
 cases.append({'size':3,'centers':cs,'states':states,'expected':[valid(3,cs,s) for s in states]})
print(json.dumps(cases,separators=(',',':')))
