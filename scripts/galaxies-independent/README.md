# Independent Galaxies checks

This code was written by a reviewer independently of the campaign generator and
runtime domain solver. `verify.py` parses only the public clue data, enumerates
whole connected half-turn-symmetric regions, and counts exact covers up to a
second solution. The completion oracle uses geometric star-cell contact and BFS.
Certificates are read only after independent solving, for comparison.

The enumerator is checked against all cell labelings for 129 small clue sets and
against every subset on 25 single-star 3×3 boards. `fixtures.py` supplies independent
expected completion results to `runtime.mjs`, which imports the TypeScript system
under test and exercises hints, editing guards, save validation and alternative
valid solutions. It does not use the runtime solver as an oracle.

From the repository root:

    python3 scripts/galaxies-independent/verify.py --repo . --output /tmp/galaxies-campaign-review.json
    node scripts/galaxies-independent/runtime.mjs . /tmp/galaxies-runtime-review.json

These are rule/campaign checks. They do not claim browser, accessibility,
performance-on-device, build, CI or final publication verification.
