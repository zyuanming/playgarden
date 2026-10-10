# Beatrix / 鼓点迷径

Complete 12-puzzle adaptation of [Cong's Beatrix](https://github.com/cxong/Beatrix/tree/059b74a3e9d9ec2bffee0a72ba8a53be107fe8b3), fixed at commit `059b74a3e9d9ec2bffee0a72ba8a53be107fe8b3`. Source discovery: bobeff/open-source-games → leereilly/games → cxong/Beatrix.

## Original campaign and rules

The 12 playable definitions are level1_1, level1_2, level2_1 through level2_5, level3_1 through level3_4, and levelbonus_1. The six title/chapter/credit/end display scenes are not counted as puzzles. All original 32×32 layouts, drum definitions, emitter periods/directions, BPM values and complete 8/12/16-column target scores are retained.

Each step is a sixteenth note, 60000/BPM/4 milliseconds. Existing pulses move before fixed drums emit new pulses on their own square. Each drum is struck at most once per step; distinct drums of the same instrument contribute duplicate sounds. A reflector changes only the first colliding pulse in insertion order, matching the source's early loop break. Instruments are compared as multisets at the original fixed cycle phase. Failure starts the next comparison cycle without clearing traveling pulses or resetting emitters. Later puzzles depend on delayed and returning pulses. Editing positions during playback also preserves pulse travel and phase.

Source defects repaired explicitly: escaped pulses are removed, including the original missing x≥32 boundary; restart resets playback counters; input and saved arrangements are validated against the 32×32 board and occupied/fixed cells. These fixes do not replace puzzle rules or target rhythms.

## Modern interface and lifecycle

The board supports click placement and dragging. A drum list, 1-based row/column fields, four large direction buttons and an optional enlarged board provide the same full placement range on touch screens. Start is explicit for browser audio consent. Pausing freezes world time and stops active sounds; target preview freezes both the board and editing, then resumes the original world position without elapsed wall-time catch-up. Replay from the first beat preserves the arrangement while restarting pulses. Undo restores the previous arrangement and restarts playback.

Only placements are saved under `playgarden.beatrix.arrangements.v1`; the common shell stores completed levels. Returning to a saved arrangement requires a new explicit start and genuine rhythm match. Reset restores the original arrangement. Blur and document hiding stop playback. Unmount cancels the animation callback, removes listeners and closes the private AudioContext. A read-only observation function exposes current state for browser verification; it cannot set state or inject victory.

## Code and asset boundary

Original first-party code/data: MIT, Copyright (c) 2014 Cong. All 14 retained source-reference files match the fixed upstream Git blobs; they are stored as non-executable `.txt` files under `vendor/beatrix-original/upstream`. Editable TypeScript, React, CSS, procedural percussion and original SVG additions are GPL-3.0-only.

No original MP3/WAV sample, image, font, logo, Phaser bundle or other legacy runtime dependency is redistributed. The upstream SampleSwap notice does not assure clear sample rights; those recordings are completely excluded. Percussion is synthesized locally from oscillators and independently generated noise, with no recordings or encoded source audio. The original rhythm identifiers and puzzle timings remain unchanged. New SVG and system fonts render the interface. Runtime makes no remote network request.

`scripts/beatrix/verify-sources.py` verifies exact source bytes, the public MIT notice, original-level data correspondence and excluded asset boundaries. Browser acceptance uses real controls on selected first, middle and final puzzles, together with negative rhythm checks, pause, target preview, undo, saved arrangements, audio mute and disposal. This is representative targeted verification, not an exhaustive gameplay proof of every possible arrangement.
