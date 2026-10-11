# Integrator handoff

Game ID: `hyperspace-garbage-collection`; Chinese title: 反物质清运站.
Four authored playable stages. The original `the end` scene is not a fifth level.

Copy the exact isolated trees for this game from public/, vendor/, src/games/,
scripts/, docs/ and the single e2e spec into the integration checkout. Do not copy
the static coordinate-diagram scratch files or the top-level handoff into runtime.
The parent is the only owner of registry, catalog, shared notices, workflow and refs.

1. Add the one ID to the catalog and the provided catalog-entry object to the
   registry, translating its component string to a lazy import of
   `../games/HyperspaceGarbageCollection`.
2. Append the provided runtime-source-addendum object to vendoredComponents in
   docs/runtime-source-manifest.json, and the notices-addendum to
   THIRD_PARTY_NOTICES.md. Run the existing notice synchronization workflow.
3. Add `python3 scripts/hyperspace-garbage-collection/verify-sources.py` to the
   required source checks. It does not run a game, unit suite or upstream script.
4. Run the ordinary typechecked build/license checks, then exactly one targeted
   invocation: `npm run test:e2e -- e2e/hyperspace-garbage-collection.spec.ts`.
   Use the existing desktop/mobile projects; do not run unrelated games.
5. Review the actual first, middle, original-ending and mobile-paused screenshots.
   Do not treat the coordinate-only static map diagrams as screenshots.

The E2E physically steers with real mouse/touch joystick events, plus keyboard
movement/material checks. It plans only from copied, read-only original wall
observations, and never sets world positions, velocities, materials, keys,
trigger state or progress. It verifies first, middle and final real objectives;
checks level 2's actual material controls without claiming a level-2 win; checks
expired-debris non-completion, paused timing, restart, original ending and earned
persistence/reentry. Physical routes are authored but have not run in a browser.
CI may reveal steering/route or visual adjustments that static checks cannot.

No local browser sockets are available in this task environment. No attempt was
made to escalate, tunnel or bypass that restriction. Runtime browser playability,
actual screenshots and the full typechecked build are pending parent CI. No unit
suite or unfamiliar upstream installer/build was run. No external state, Git ref,
registry, catalog, shared shell or workflow was edited by this worker.

The source archive contains the exact legal pre-cleared 64-file input and all
own runtime/host/source-tool additions. Inherited input archive identity:
216206 bytes, SHA-256 a280af8b9dd6e636dc105bf77705ae5cd708c7b4ef10ed2f336cabd20d74b75b.
The final adapted archive has a separate identity in the package's PACKAGE.sha256.

## Storage write failure

The host loads validated disk records once, then treats accepted current-page memory as authoritative. If a later disk write fails, remounting or entering another level retains the new session record instead of reading stale disk data. A full page reload reads the last successful disk record; no persistence is claimed for rejected writes. The targeted E2E includes a namespace-only quota fault after real saved progress, without injecting gameplay results. Runtime verification remains pending.
