# The Pond / 彩游池塘

Full endless original mechanism adaptation from Zolmeister/pond, fixed 68fa8b542bff6c405cce83a6bd433e16e7b4e7f6. Original GPL-3.0-or-later code and procedural drawing retain © 2013 Zolmeister. The Chinese host is GPL-3.0-only. The directory source chain is pinned in vendor/pond-original/source-records.json.

## Complete scope

Continuous curved movement with inertia; six-circle body collision; larger fish absorbing smaller fish; equal-size collision resolved by original iteration order; AI fish also eat each other; original raster-derived particles drive size growth and transfer colors; four extra fully loaded colors transfer into one bar step, ten steps form an orb, ten orbs produce a celebration and reset the orb row; new surrounding zones generate as the player swims. There is no final win state or campaign. Catalog count is zero finite levels.

## Adaptation boundaries

The native host owns pointer/keyboard input, pause, focus loss, reset, scoped local best-size storage and disposal. Original procedural curves and palette are retained; unknown third-party music/font bytes and optional images/Stats/loader are excluded. Index HTML with its old account identifier is excluded even from the redistributed source snapshot. Original source snapshots are inert text and never loaded by the website. No network is used by the adapted game.

All devices use a780x540 logical canvas, original desktop particle density and32ms simulation steps. This intentionally removes the historical Cocoon mobile density/growth multiplier and screen-size-dependent spawn density difference. Original code bookkeeping faults are corrected without adding prey, progress or a winning shortcut: undefined keyboard variable, nested shared loop indices, stale progress object references during catch-up, dropped concurrent progress flights, and raster creation before a rendered frame.

The displayed local highest size is a Playgarden statistic; original gameplay has no numeric high-score service. Test observations are read-only and do not set positions, spawn prey, force deaths or advance progress.

## Verification

Run python3 scripts/pond/verify-sources.py for exact source/license checks. Final targeted browser journey: e2e/pond.spec.ts, desktop and mobile. Gameplay and screenshot evidence must be reviewed for the final tested revision before release.
