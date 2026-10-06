# Lightweight independent Xiangqi checks

Copy these seven source/fixture files into `scripts/xiangqi-independent/`. They use Python 3 standard library and the project's existing Node 24 runtime; no extra packages. Run from the product repository root:

```sh
python3 -m unittest discover -s scripts/xiangqi-independent -p "test_*.py"
python3 scripts/xiangqi-independent/verify_campaign.py --repo . --expect-count 13 --self-test --output /tmp/xiangqi-independent-certificates.json
node scripts/xiangqi-independent/verify-runtime.mjs --repo . --certificates /tmp/xiangqi-independent-certificates.json
```

The first command verifies the independent oracle with 76 golden geometry/result vectors, malformed FEN rejection, repetition/counters, opening perft 0–3 and 44 depth-three divides. The second enumerates every legal candidate and every resulting opponent reply for each campaign puzzle, independently derives the exact full objective-satisfying solution set, and detects ten intentionally corrupted campaign examples. The third checks actual product core/practice functions and runtime level data against those independent vectors and certificates. Certificates are tied to the exact corpus and oracle hashes to reject stale evidence.

Do not replace this oracle with a call to the product's solvePuzzle or an imported Xiangqi library. The broader original audit (10,475 positions, 186,120 move/undo transitions, ten code mutations) remains in the full verifier deliverable; this smaller suite is intended for every CI run.
