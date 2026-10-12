# 格境求生 · Gridland

Complete original match/build/survive campaign pinned to doublespeakgames/gridland commit06af02c3af7062aead04a1e6f67b6e59f3e4b6a1. Day matches yield material or healing; the autonomous worker constructs the settlement. Night matches refill equipment or spawn monsters. Loot, four fragments, magic, the Lich's dragon item, the actual dragon-clear screen, Continue and New Game+ remain. The game has no authored numbered levels and contributes0 to finite-level totals.

The original difficulty menu keeps standard and casual rules. Neither progression, loot probability, damage nor random selection is changed. The original nine sprite sheets are preserved exactly. The presentation is Chinese and local. Audio is omitted because separate redistribution rights were not established; the original silent behavior is used. No external requests, telemetry, account, donations or social actions are included.

The game runs in a reviewed same-origin iframe. Its local CSP disallows external resources, network connections, forms, media and eval. This is lifecycle/document isolation, not a claim that same-origin frames are a security sandbox. The host validates message origin, frame identity, per-mount session and resource revision. Pause freezes original timer delays, native RAF and in-progress CSS transitions. Exit disposes timers; death/prestige reinitialization clears old jQuery animation queues and frame bookkeeping.

Three slots and options use only playgarden:gridland:v1: keys. Saves preserve original checkpoint semantics: settlement progression at dawn and key events; they do not serialize the live night board or monsters. The normal slot menu retains import/export/deletion confirmation. Imports reconstruct only known buildings/resource types and bounded save fields, never code. Invalid imports preserve existing slots. Storage failures retain a session copy and display a warning. “重来” returns to original slot selection.

Code/design/graphics by Michael Townsend, MPL-2.0. Modified original files remain MPL-2.0. Separately authored Playgarden host, translation, lifecycle/storage bridges and build scripts are GPL-3.0-only. Exact official readable jQuery2.0.3/Sizzle and RequireJS2.1.8 sources and full MIT notices are retained. The uncleared WebToolkit Base64 helper is replaced with independent native UTF-8/base64 code.

Build: run python3 scripts/gridland/package-source.py after intentional source changes, then python3 scripts/gridland/verify-sources.py. The latter checks immutable original Git blobs, all runtime/archive bytes, licenses, local references and honest zero numbered-level metadata. npm run build includes this check and the repository TypeScript/build gate. Targeted browser journey: npm run test:e2e -- e2e/gridland.spec.ts. Test code uses normal mouse/touch input and read-only observations; it must not fabricate saves, use hidden multipliers, overwrite state or accelerate original progression to claim the ending.

Corresponding source: public/gridland-original/source.zip, including original inputs, exact dependencies, edited runtime, host, tests and reproducible packaging scripts. Source/distribution manifests identify every file and its license.

Matched/pooled tiles retain their original fade and reuse lifecycle but cannot intercept pointer input while hidden. Reusing a tile removes those classes and restores normal hit testing. This fixes an observed transparent pooled face covering a live mobile cell without changing tile rules, coordinates or animation timing.

New Game+ retains its original 1400ms lead-in and 1400ms fade completion. The final visual cleanup is registered after prestige resets the isolated clock, so restarting cannot discard the cleanup and leave an invisible overlay blocking the new board.
