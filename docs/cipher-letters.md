# 密码花信

Original GPL-3.0-only alphabet-substitution game, eight authored everyday English practice phrases and Chinese clues, interface and SVG cover. No quotations, external dictionary, game code or commercial assets are used. The deterministic bijection is educational puzzle data, not a secure encryption recommendation.

Every encrypted letter maps to one real letter throughout the message. The player chooses a cipher symbol and assigns A–Z, observing all occurrences change. Different cipher symbols cannot share an assigned real letter. Players can clear an occupied mapping before reallocating. Only a complete correct plaintext wins; filling every slot alone does not.

Unlike hidden-letter guessing, all cipher patterns and word boundaries are visible and player decisions concern a globally consistent substitution map. No guess penalty, timer or alphabet correctness feedback is used. Hints identify a needed mapping from the live state; if its real letter is held elsewhere, the hint explains the two-stage repair. Hints never silently alter the map. Undo restores the previous full mapping; pause and victory lock actions, reset clears the round.

A single targeted E2E file performs real first/final decoding through touch/keyboard controls, duplicate assignment rejection, wrong mapping, clear, current-state hints, pause, undo, restart, terminal lock, screenshots and overflow checks. No unit suites are requested.
