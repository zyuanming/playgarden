# Independent review: Shikaku 200-level expansion

Reviewed corpus public-clue SHA-256:
`dd617e7c28adb69b2798b50e83d55639f5825433563fa0d3a565095b6a5e9d14`.

## Results

- All 200 have exactly one independently enumerated solution matching a valid certificate.
- The original twelve objects are preserved exactly and in place.
- No rotated/reflected clue duplicate or solution-partition duplicate among all 200.
- Maximum independent search: 62 nodes. Limit: 200000; per-board timeout: 10 seconds.
  There were no invalid, exhausted-budget, timeout, no-solution, or multiple-solution results.
- All 188 supplied authoring proof traces pass step-by-step checks, including removals.
- All 200 solve by sound candidate elimination, with no guessing or uniqueness assumption.
- Independent recursive analysis finds 67 non-guillotine partitions. The author report's
  43 boards with no first full-board cut are a stricter subset, not the complete count.
- The portable verifier has 14 passing positive/negative unit tests.

## Teaching groups

| Levels | Independent finding | Median excess candidates over final region count |
| --- | --- | --- |
| 1–12 | 2 singleton, 9 coverage, 1 shared-cell | 14.5 |
| 13–40 | 16 singleton, 12 coverage | 9 |
| 41–90 | All 50 require coverage beyond singleton propagation | 15 |
| 91–140 | All 50 stall under coverage; shared-cell exclusions solve them | 23 |
| 141–200 | All 60 stall under coverage; shared-cell exclusions solve them | 32 |

The revised groups have a genuine logical distinction, rather than only larger
boards or more clicks. Later challenge boards also have longer reported deductions
and more alternatives. These are relative-to-rule-set observations, not a validated
human difficulty scale or a guarantee of strictly increasing difficulty each level.
The preserved legacy sequence precedes a new foundational chapter, so level 13 is
intentionally easier than level 12.

## Representative decision checks

- Level 1: three top-row area-3 clues force three columns; a clear introductory case.
- Level 13: the area-6 clue at row 2, column 1 can only occupy rows 1–2, columns 1–3.
  It eliminates two competing regions before the rest of this five-region board settles.
- Level 41: after the three lower small regions, top-left ownership and the top-row
  fourth cell constrain two different larger clues. Singletons alone cannot finish it.
- Level 100: no clue starts with a single candidate. Ownership of cells in the left
  column constrains area 6; the area-5 clue's candidates all cover rows 2–5 of the last
  column, excluding two candidates elsewhere. Coverage and shared cells interact.
- Level 200: 44 starting candidates for nine regions; the sound author trace uses nine
  shared-cell eliminations and two ownership restrictions, eliminating 35 alternatives.
  Shared-cell reasoning is necessary within the reviewed rule set, not just listed as a theme.

## Scope

This is independent data/source mathematical review. Production runtime tests,
real-browser play, desktop/mobile visual QA, and CI were not performed by this corpus
reviewer in this phase. No repository files were changed by this reviewer.
