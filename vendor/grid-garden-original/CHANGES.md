# Grid Garden adaptation

Upstream: Thomas Park / Codepip, `thomaspark/gridgarden` at `0e262f7272d4992340eb556bdb9b2d502cc59932`.

The 28 authored lessons, original classes, all multilingual instructions/help, CSS, eight SVGs and one PNG are preserved byte-for-byte. `levelWin` is an uncounted ending. jQuery 3.5.1 and Animate.css 3.4.0 readable distributions are retained locally; no upstream package scripts or dependency installation is needed.

`scripts/grid-garden/adapt.py` reproduces narrow edits to the original controller. Startup waits for a validated host handshake. Generic storage, user tracking, analytics and social handlers are removed. Host navigation owns the lesson index; answers are saved on every input and completion. The original renderer and browser-computed rectangle, width, height and color comparison remain, with a one-to-one multiset to prevent duplicate-overlap acceptance. The checker never compares the user's answer text to a target string.

The owned bridge controls the original 200 ms input delay, one-second jQuery fade and 2.5-second next timer. Pause retains their remaining times; resume continues them. New input, lesson navigation and disposal cancel obsolete work. CSS animation play-state follows pause. The original hover-only help is displayed by accessible touch/keyboard controls using the exact original help text.

The opaque iframe allows scripts only. CSS declarations are restricted to grid placement/tracks/order and validated by the browser. URL-capable properties, selectors, escapes, custom variables and unrelated declarations are rejected; CSP blocks external resources, connections, forms, frames and fonts. Runtime promotion/social markup and remote fonts are removed. The complete untouched original HTML remains only in the source tree/archive as provenance, never as the executable entry page.

The additive shell supplies Chinese default UI, accessible editing, retry, local pause, language choice, responsive layout, namespaced persistence and source/license links. Host remount/StrictMode cleanup isolates each session and drains already-posted input snapshots before a replacement boots. A final-only solve earns only that lesson; the harvest ending requires all 28 lessons individually solved.

Original lesson 26 (`grid-template-rows 1`) includes an illustrative style value overridden by its `!important` target class. This original data discrepancy is not rewritten: the effective target is five rows `50px 0 0 0 1fr`, as required by the Chinese lesson. The inventory documents both.

Original code/data are MIT. The author's README explicitly licenses these nine images CC-BY-3.0; artwork bytes are unchanged and attribution does not imply endorsement. Owned host, bridge, shell, patch and verification code are GPL-3.0-only. Full notices, original translator credits and exact editable sources are shipped locally.
