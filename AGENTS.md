# Playgarden working rules

Current user direction (2026-10-08): fast incremental game integration.

- Stop unit tests and exhaustive campaign/proof sweeps for now. Do not run `npm test`, `node --test`, Vitest, Python unit suites, or old-game solver sweeps as a substitute. Existing test files remain historical assets.
- Make frequent small commits. Ordinary updates need only a valid typechecked build and required license/source checks (`npm run build` already includes both).
- After a game is finished, run exactly one targeted E2E invocation for that game, covering desktop and touch-size controls. Use `npm run test:e2e -- e2e/<game>.spec.ts`. Do not run the entire browser suite. A genuine failure can be fixed and the affected journey retried; do not repeat successful unrelated games.
- CI can request that final invocation by adding `Final E2E: e2e/<game>.spec.ts` on its own line to the PR body, then marking the finished draft ready for review. Alternatively use the manual workflow input. Do not trigger both routes for the same finished revision.
- Main builds and publishes; it must not repeat unit suites, campaign proofs, or E2E. Verify deployment identity and entry resources over HTTP. Reuse already-earned gameplay and visual evidence when game code is unchanged.
- Keep the number of games and levels truthful. Every registered game must have genuinely different playable rules; no reskins or rotated copies to inflate totals.
- Preserve explicit upstream source commit and full license for adaptations. Do not install or run unfamiliar third-party source. Original interfaces, level data and programmatic assets must be honestly labeled.
- One integration owner edits registry, catalog, shared shell, workflow and final branch refs. Parallel contributors work only in assigned isolated game files or staging directories, and return their exact paths and provenance.
- No credentials, private operational notes, tokens or user account data belong in Git. No main force pushes.
