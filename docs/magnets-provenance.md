# Magnets source and mechanism

Candidate game 93, not a deployed-count assertion. Fresh base main: 243f194192912533bf13bc0752a87584d04e1d14. All 772 source blobs verified; none of the 92 registered games uses domino opposite poles, optional neutral dominoes, separate row/column plus/minus quotas, and forbidden adjacent equal poles together.

Binary Balance instead uses equal A/B counts, forbidden triples, and unique rows/columns. Magnets is a distinct three-choice domino constraint game, not that game with new artwork.

Fixed upstream: https://github.com/chrisboyle/sgtpuzzles/blob/d1e10eb57dd80af4999e698a9ab31f546e9a0b9d/app/src/main/jni/magnets.c

MIT source and full unchanged licence are vendored, with Git blob and SHA256 identities in source.json. Adaptation maps OPPOSITE to oppositePole; count_rowcol and check_rowcol to per-pole line counters; check_completion to all-domino decisions, both quota families and orthogonal equal-pole rejection. Our state represents a whole domino, enforcing opposite poles or two neutral cells by construction. Unlike upstream variants, this campaign uses fully tiled rectangular boards without isolated cells.

Original additions: bounded MRV paired-domain search (not an upstream solver port), explicit unknown state, history validation, campaign generation, interface, accessible symbols and SVG illustration. Upstream Android/Play Store graphics, sounds, fonts and network code are not included. Runtime public puzzles never include the solution certificates.
