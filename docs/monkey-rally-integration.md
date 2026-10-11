# Integration handoff

Copy only this adaptation's `public/monkey-rally/`, `vendor/monkey-rally-original/`, `src/games/MonkeyRallyOriginal.tsx`, `src/games/monkeyRallyOriginal.css`, `scripts/monkey-rally/`, and `e2e/monkey-rally.spec.ts` into the release tree. There are no shared-file changes in this directory.

Register `monkey-rally` using `catalog-entry.json`, lazy import `../games/MonkeyRallyOriginal`, and exactly eight levels. Add `CC-BY-4.0` honestly to the adapted-source license enum. The shared optional `GameProps.onLevelChange` already supports the required host-owned zero-based navigation. Add the source verifier to the build command and include the full notice/source entry in shared dependency notices. One required final invocation: `npm run test:e2e -- e2e/monkey-rally.spec.ts` after independent source review. Review both desktop/mobile screenshots. Browser runs were not attempted here.

Preparation/reproduction commands (all standard-library static file processing):

1. `python3 scripts/monkey-rally/adapt.py`
2. `python3 scripts/monkey-rally/package.py`
3. `python3 scripts/monkey-rally/verify-sources.py`

The package script creates complete notices, runtime hash metadata, exact corresponding-source ZIP and an optional deterministic `vendor/monkey-rally-original/images.zip`. `image-manifest.json` lists each original image once with its two unchanged materialization paths. Normal unpacked files remain present. If opting into packed Git storage, run `python3 scripts/monkey-rally/unpack-assets.py` before build/dev and source verification; the script checks every image byte/hash before writing. This affects repository transport only, not browser URLs or game code. Repack corresponding source after any adapter or host change.

Source tree inputs are restricted to the cleared publication whitelist. No `audit-reference`, raw engine, music/font files, transport JSON or unknown upstream build/install scripts are present.

Completion focus lifecycle: the shell focuses its victory action after a genuine win. Iframe blur freezes live attempts (including celebration), but does not freeze the already-earned `won` state or static `ending` scene. This leaves Next/Stop/Reset reachable and permits the final deferred ending transition. Explicit host pause, manual pause and document visibility pause continue to gate all scenes. The targeted journey covers that focus transfer, won-state pause/resume, real host-owned Next, Stop/Reset without losing earned marks, and ending-menu reentry. Runtime behavior must be verified by the targeted desktop/mobile CI journey; static packaging verification is not a runtime pass.
