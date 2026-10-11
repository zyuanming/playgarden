# Avabranch · 四线分流

This is the complete original endless Canvas survival game by Zolmeister,
adapted for Playgarden. Original source commit:
`4ab326b4a24d796328963da35c0d8d193d728496`.

There are **zero finite authored levels**. The original ten-second increasing
difficulty counter is not a campaign level count, and no victory is invented.

Two lines initially live, two wait to be revived. A/F steer the merged group;
Space toggles branching. Independent pairs are red A/S, yellow D/F, green J/K
and blue L/;. Four visible touch rows support simultaneous pointer steering.
The mean-position, twenty-frame merge, original rectangle/boundary collision,
color-specific revival or ten-second effects, and frame-rounded score survive.

Runtime entry: `index.html`, intended for an `allow-scripts` opaque iframe.
The same-origin parent provides a per-iframe session and validated records by
postMessage; the opaque child never accesses localStorage. The complete host,
scripts, original sources, MIT/GPL texts and E2E are in `source.zip`.

Source modifications are documented in the archive's
`docs/avabranch-adaptation.md` and reproducible `DERIVATION.patch`.
Run `python3 scripts/avabranch/adapt.py --check` to compare the generated core,
and `python3 scripts/avabranch/verify-sources.py` to verify exact source/archive
bytes without executing the game. The packaging script regenerates the
corresponding-source ZIP, its distribution manifest and local source map.

Original first-party code/procedural graphics remain MIT, Copyright (c) 2013
Zolmeister. New host, touch controls, safe mapping UI, styling, build scripts,
tests and original SVG card are GPL-3.0-only. See `NOTICE.txt`, `LICENSE` and
`Playgarden-GPL-3.0.txt` for the complete terms.

No third-party music, sprite/icon images, remote fonts, analytics, Crafty or
jQuery is included. Original audio was not independently cleared. There are
no remote runtime requests. Build/source checks alone do not establish browser
playability; the targeted desktop/mobile E2E and screenshots are required.
