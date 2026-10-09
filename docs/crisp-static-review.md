# Independent static review

Review date: 2026-10-09. Scope: all archived runtime JS/TS, source and license records, generated engine/audio/lifecycle code, React cleanup, and focused E2E source. No original code or browser was executed in this review.

The review found and the implementation corrected:

1. Seven active jsfx `new Function` oscillators. All seven literal replacements exactly match the decoded original compiler prefix, fixed formula and suffix. Shared noise state is explicitly declared.
2. A hidden AudioContext opened only to obtain sampleRate. The owned context now supplies it; the audio library's optional unmanaged-context fallback was also removed.
3. External restart needed ticks = 0 because upstream initInGame expects its caller's enclosing frame increment. This is now explicit, with a run serial resetting read-only observation counters.
4. PARKING explosion sounds alone could not distinguish a crash from bottom loss. Observations now distinguish the original vector versus numeric X-marker draw calls and forward those calls unchanged.
5. Persistent runtime errors could continue scheduling frames. Fatal errors now dispose the original engine and audio.
6. A postMessage alone could race iframe removal. React cleanup invokes the same-origin child disposal synchronously before removing its message listener.
7. A disposal acknowledgement originally preceded AudioContext.close completion. The acknowledgement now waits for closure.
8. Paused DOM snapshots could retain the pre-suspend audio state. An owned AudioContext statechange listener now refreshes the snapshot while RAF is stopped. It is removed on close; the callback is cleared after the final closed publication.

The final reviewer confirmed no remaining blocking static findings in the reviewed scope. Browser behavior, actual controller success, sound output and screenshots remain unverified.

All three public game scripts are byte-identical to originals. Preferred mml-iterator 1.1.0 source files match their fixed Git blobs, contain only local module imports and parser/iterator logic, and match the bundled API/representative implementation on static comparison. Ordered method sets match: Scanner 8, MMLParser 21, MMLIterator 18. Constants and representative scanning, chord/tie/loop parsing, duration/note calculation and loop transitions match the expected Babel translation. The absent historical lockfile still prevents proving exact original npm resolution.

The E2E journeys use physical mouse/touch/keyboard input, read-only observations and one disclosed pre-load RNG stream. No position, score, tick, failure/success or collision state is injected.
