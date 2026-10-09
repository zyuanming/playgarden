# Static review findings and resolution

An independent read-only review inspected the adapter, generated runtime, original source and React host without executing the game. Five concrete findings were corrected before packaging:

1. Explicit native resume while Help was open could advance gameplay behind its overlay. Local resume now also closes Help.
2. Iframe blur could overwrite an existing manual/Help pause reason. Blur creates a local pause only if the engine is not already locally or host paused.
3. A fractional spiral wave counter could create an illegal fractional falling lane. Save validation now requires integer counters for every pattern except crosswise, whose original counter advances in exact multiples of 1.5.
4. Unconditional pagehide disposal would leave a restored back/forward-cache page inert. Persisted navigation pauses/saves and retains listeners; only non-persisted navigation disposes. Persisted pageshow repaints/publishes without resuming time.
5. A large negative saved angle could force many iterations in original angle normalization. The transform replaces the addition loop with constant-time positive modulo, preserving normalized geometry.

MainHex.dt was also added to validated save fields to preserve the prior simulation step used by original draw effects after restoration.

This is source review only. It does not establish gameplay, browser screenshots, browser storage behavior, or deployment success. Actual desktop/mobile checks are delegated to the integration owner's one targeted E2E invocation.
