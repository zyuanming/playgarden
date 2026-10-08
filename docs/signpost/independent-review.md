# Signpost independent rules and playability review

Reviewed 2026-10-08, separately from the module author. Scope: the 30-level
Signpost candidate based on main `6c7161f`, plus the author's bounded-budget
hardening following this review. The reviewer changed only
`scripts/signpost-independent/` and this report. No author generator was used
as an oracle, and no author solver or certificate was used to establish
uniqueness.

## Verdict and limits

**Rules, unique finite campaign, certificate agreement, and distinct mechanism:
PASS.** No unresolved rule blocker found. The exported solver's NaN/Infinity
budget hole was reported, fixed by the author, and independently regression-tested.

**Rendered UI, full DOM suite, typecheck, production build and screenshots remain
separate release gates.** This review read the UI and tests but did not run a
browser or inspect pixels. Do not treat this report as browser, true-device or
accessibility certification. The author's small-cell layout changes require
final-commit desktop/mobile screenshot inspection.

Audited rule/data SHA256 values (re-run the commands below after any changes):

- `src/games/signpostLogic.ts`: `311436231ab2bfd6cb5386e74c2c65ed4d11d5efcbc99930c3cfb083ffe68ca7`
- `src/games/signpostLevels.ts`: `cd99614067c0ed284aac6b2351b308764c7baa4845f04001f19e3a762c211daa`

## Independent method and checks

`verify.py` models each number's **cell domain**, rather than extending an
answer path. It applies all-different constraints, anchor restrictions and
bidirectional adjacent-number arc consistency, then branches on the smallest
remaining domain. Geometry uses vector collinearity and a positive dot product,
not the runtime ray loop. It searches until exhaustion or the second solution.
Only after all 30 searches does it load and compare the author's certificates.

Results:

- Exactly 30 stable level IDs, five chapters of six, all with exactly one solution.
- All independently obtained solutions match the separate certificates.
- No rotation/reflection-equivalent duplicate puzzle, including rectangular transforms.
- Every puzzle has at least two cells with multiple locally accepted successors,
  at least two long jumps and at least two diagonal solution edges.
- Both vendored files' SHA256 and Git blob identities match `source.json`.

Counterchecks against false confidence:

- All 324 in-board-arrow / start-and-end combinations on 2×2 boards are checked
  against brute-force permutations, independent of domain propagation.
- 300 deterministic random six-cell boards are also checked against brute force,
  plus explicit impossible, unique and two-solution fixtures. The ambiguous
  fixture is an anchor-ablated 4×3 board with two independently checked paths.
- Truncated, duplicate, reversed and wrong-arrow certificates are rejected.
  Duplicate/out-of-range-format anchors, a wrong intermediate clue, a malformed
  arrow array and an outgoing terminal also fail their applicable checks.
- Local-state tests reject self-links, cycles, duplicate predecessors, anchor
  interval conflicts and duplicate implied numbers across separate components.

`runtime.mjs` executes the actual TypeScript functions using Node's type stripping
and compares them to a second Python oracle. The oracle propagates signed
number-difference equations over an undirected graph, rather than walking chain
heads as the implementation does.

- 18,173 state validity/completion/anchored-number comparisons.
- 9,036 ordered-cell ray comparisons, covering all campaign geometries.
- 150 shuffled full-campaign replays, with intermediate split/rejoin and
  current-state solver checks.
- Explicit unanchored A1–A4 segment, backward anchor propagation into 2–6,
  and disconnect back to relative labels.
- Locally accepted wrong edges return `none` under full search; budgets 0 and 1
  return `budget`. A branching 6×6 fixture actually reaches the 50,000-node cap,
  so NaN, both infinities and a billion-node argument cannot silently bypass it.
  Fractional and negative arguments are normalized. The reported 50,001st visit
  is the budget sentinel, before expanding that node.
- Invalid indices/types, malformed saves, impossible multi-edit history jumps,
  transitions after completion, terminal link/unlink lock and valid history reload
  are checked. A valid nonempty first history snapshot remains allowed, necessary
  for capped-history persistence.

## Meaningful choices and differentiation

The 93 preceding registry entries were reviewed for overlap. The nearest games
are Knight Tour, One Stroke, Town Tour, Postman Routes and Memory Routes.
`knightLogic.ts` stores one path from a prescribed start and permits only an L
move from its final cell. One Stroke covers undirected edges and can revisit
nodes. Town Tour optimizes weighted travel; Postman covers edges; Memory Routes
reproduces a remembered sequence. Signpost's fixed per-cell ray directions,
variable distances, exact numeric anchor gaps and freely assembled disconnected
segments create a different puzzle. It is not merely a new knight-board size or
a reskinned path tracer.

Concrete authored-puzzle observations, using 1-based row/column coordinates:

- **Level 1:** four initially branching cells, three long jumps, four diagonals.
  The fixed 1 at (3,1) points upward to either (2,1) or (1,1). But (2,1)'s only
  outgoing ray reaches fixed 7 at (1,2), so (2,1) must be 6, not 2. The player must
  choose the longer jump to (1,1). This is real anchor/distance reasoning even in
  the introduction.
- **Level 15:** thirteen initially branching cells, seven long jumps, two
  diagonals. The player can first assemble (1,2) → (1,4) → (1,3) → (1,1), shown as
  A1–A4, and later connect (1,1) to fixed 6 at (2,1). That backward anchor assigns
  the segment numbers 2–5. Separately, connecting (3,2) to terminal 16 at (3,4)
  gives 15, then (3,3) → (3,2) gives 14 before joining fixed 13 at (4,3).
  These disconnected local deductions do not require playing out from 1.
- **Level 30:** twenty-one initially branching cells, eighteen long jumps,
  twelve diagonals. The fixed 1 at (3,5) has four locally accepted westward
  targets, but the exact route to fixed 4 at (1,3) is (3,5) → (3,1) → (5,3) →
  (1,3). Later anchors 10 and 15 constrain how separately assembled fragments
  can meet. More interactions and anchor gaps, not simply more forced clicks.

Search node counts are implementation metrics, not a claim about human difficulty.

## UI source review, not rendered verification

The opening instruction gives a goal, two-click first action, long-jump rule and
permission to build the middle first. The notes explain relative labels, one
predecessor/successor, no cycles, terminal behavior and how to disconnect or undo.
Ray highlighting is honestly labeled direction-only. Hints explicitly identify
search, preserve the board until confirmation and distinguish exhausted budget
from a proven dead end.

Cells have stable index keys, native button Enter/Space activation, arrow-key
focus navigation with inner modifier guards, accessible coordinate/number/ray/
predecessor/successor labels, and non-color selected/fixed/hint cues. The hint
focus call uses `preventScroll`. Pause and won states block edits; token values
are consumed while blocked; the completion callback is once per round; reset or
level changes remount the round. The shell separately moves focus to the new
level heading and completion action. External restart-control focus is not
intentionally stolen. Storage failures leave a playable in-memory round.

Existing DOM/e2e source covers saves, splits, undo, pause/resume, tokens, restart,
completion and all 30 control-driven certificates. Final CI must establish that
these tests actually pass. In particular, inspect narrow 5×5 number/arrow/relative
label separation, focus after interrupted control use, 44px targets and absence
of horizontal overflow. No browser observations are asserted here.

## Provenance

Read `NEW_GAME_GUIDE.md`, `PLAYABILITY_REVIEW.md`, `signpost-provenance.md`, the
complete vendored MIT notice, and relevant upstream `whichdir`, `ispointing`,
`isvalidmove`, link and completion sections. The local geometry, chain consistency
and explicit completion meet the documented adaptation. Deliberately requiring
all n−1 entered edges, refusing silent occupied-link replacement and separately
marking search hints are documented differences. No upstream media, generator,
networking or unlicensed dependency is introduced by this adaptation.

## Reproduce / append to npm test

```sh
python3 -m unittest discover -s scripts/signpost-independent -p 'test_*.py'
python3 scripts/signpost-independent/verify.py --repo . --output /tmp/signpost-independent-report.json
node --experimental-strip-types scripts/signpost-independent/runtime.mjs . /tmp/signpost-independent-report.json
```

The generated report contains each independently enumerated path and concrete
local-choice/wrong-edge witnesses; it is a test artifact, not runtime game data.
