#!/usr/bin/env python3
"""Batch-only test adapter. Does not import the TypeScript implementation."""
import json
import sys
from verify import partial, points

payload = json.load(sys.stdin)
results = []
for p, state in payload['states']:
    result = partial(p, state)
    results.append(result)
print(json.dumps({'states': results, 'rays': [points(p, a, b) for p, a, b in payload['rays']]}))
