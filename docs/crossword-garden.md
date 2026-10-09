# 交叉词园

Original GPL-3.0-only game, implementation, eight authored boards, clue text, and SVG cover. No external source or dependencies.

Select a numbered across/down entry and place a same-length word from the visible English bank. Each word can appear once. Overlapping letters are independently derived from the placed entries; conflicting crossings remain visible rather than silently overwriting. A win requires every clue's exact intended word and zero conflicts. Wrong same-length words are permitted to support deduction. Selecting and removing a word is reversible.

Eight boards have different coordinates, word lengths, crossing graphs and clue sets, from a three-word hook to two branched trunks. They are authored puzzles, not rotations or generated count padding. Unlisted neighboring cells are not additional entries; only numbered slots participate.

Pause and victory lock every game control. Restart remounts clean state; undo restores the complete previous assignment; current-state hints find an incorrect entry and tell the player when its needed word must first be removed elsewhere. No solver or hidden auto-fill.

The targeted E2E spec covers first/final wins using real controls, desktop keyboard versus mobile taps, current-state hint nonmutation, pause, undo, restart, disabled post-win shell undo, overflow, screenshots of both starting layouts and final victory, and browser errors. Not executed by the implementation worker; release owner runs the one final invocation.
