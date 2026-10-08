# 花瓣猜词

Original GPL-3.0-only finite letter-guessing game. The 12 familiar English words,
authored Chinese clues and teaching order are not copied from a word list or
dictionary. All interface code and SVG artwork are original contributions. No
third-party game code, commercial branding, imagery or dependency is included.

Choose an A–Z letter. A correct guess reveals every occurrence; an absent letter
uses one of six flower petals. Repeated guesses are inert. Reveal the complete
word before petals run out. A hint reveals the first unguessed distinct letter
and costs one petal; with one petal left it is refused unless it completes the
word, so asking for help cannot directly fail the round. A finishing hint can
use the final petal and still succeed. The UI discloses this cost.

There is no timer. Undo restores the last guess and any corresponding hint cost,
including after a failed round. On loss the answer is shown, without awarding
completion. Restart clears this round; normal local progress remains in the
shared shell. Versioned per-stage saves validate bounds, distinct uppercase
letters, hint membership and cost. Pause blocks guesses/hints. Controls support
touch buttons and A–Z keyboard input when the letter grid has focus.

Lessons introduce three-letter words, repeated vowels/consonants, five/six-letter
words and the difference between letter count and distinct letters. These are
12 actual word lessons, not 100 generated permutations.

One targeted `e2e/petal-words.spec.ts` desktop/mobile invocation covers real
first/repeated-letter/final words, wrong guess, duplicate protection, charged
hint/undo, pause, local return and loss/retry. No unit or campaign sweep is run.
