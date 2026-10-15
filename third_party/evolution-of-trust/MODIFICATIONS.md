# Complete source and adaptation

The original game is Nicky Case's The Evolution of Trust, fixed at 6ec45d73befdb922bd40654dd1c1c903a953562f. This package preserves the complete guided choices, tournament, evolution, distrust/noise experiments, sandbox, conclusion and credits. It does not invent numbered lessons.

Original text/source is under `original/`. Immutable original media appears once in `public/evolution-of-trust/`; `upstream-manifest.json` maps every byte and fixed Git blob. Chinese text and its public-domain dedication are under `translation/`. Exact readable Pixi 4.4.3 and TweenJS 0.6.2 source is under `corresponding-source/`. The modified readable Howler/Q/other libraries and original minified distributions are supplied as well. Complete dependency declarations and version qualifications are under `licenses/`.

Runtime JavaScript is delivered directly without an unknown upstream build system. Changes can be edited in `public/evolution-of-trust/`, with its React host in `src/games/`. The repository's normal `npm ci` and `npm run build` build the host and copy these local assets. `scripts/evolution-of-trust/package-source.py` refreshes this source archive and its checked distribution manifest; `verify-sources.py` validates identity and source closure without playing the game.

New code is GPL-3.0-only. It provides lifecycle control, source/session checked messages, a mobile view that activates the original UI handlers, input accessibility and asset error handling. It selects Pixi's built-in CanvasRenderer instead of allowing WebGL shader-generated functions. It does not change the original strategy, payoff, probability, population, speed or result rules. The mobile range uses the original min/max/step and callbacks.

Only the explicitly identified seven sound files, font and third-party truce photograph/illustration are replaced. The included generator creates the seven new waveforms from mathematical formulas; the new peace SVG is original vector art. Other licensed original assets, including nine CC0 audio tracks, are retained.

The source HTML in original/ documents the old integration, including now-removed sharing and outbound links. It is an audit source, not the served entry point. The runtime has no account, analytics, remote CDNs, cross-game storage or player-supplied code. It is an audited same-origin iframe with restrictive CSP, not a security sandbox for hostile code. Removing the iframe is part of teardown. Lifecycle counters are diagnostics, not a hard browser-memory isolation claim.
