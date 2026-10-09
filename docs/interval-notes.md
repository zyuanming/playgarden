# 音程阶梯

Original GPL-3.0-only component, eight authored lessons, Chinese instructions,
position diagram and SVG artwork. No copied source, recordings, external assets,
new packages, microphone access, recording, or network calls.

## Rules and distinct mechanic

Each lesson has three fixed pairs drawn from C4, D4, E4, F4, G4, A4, B4, C5.
The answer is the generic diatonic interval size: the absolute difference of
zero-based scale positions plus one. Both endpoints count. The choices are 同度,
二度, 三度, 四度, 五度, 六度, 七度, 八度. Direction does not change interval size.
No major/minor/perfect/augmented/diminished classification is claimed. Adjacent
scale positions are not necessarily equal in semitones. The diagram is explicitly
a scale-position diagram, not complete staff notation or a semitone ruler.

The eight lessons introduce same-note and adjacent pairs, small steps, thirds,
fourths/fifths, sixths/sevenths, octave versus unison, descending pairs, and mixed
review. These are three-question teaching lessons, not 24 separately counted
levels. This pitch-relationship classification mechanic is distinct from Rhythm
Echo's temporal pattern reproduction and Memory Routes' route recall.

Answers are checked against the active pitch pair. A wrong choice gives feedback
without advancing. Three correct choices finish the lesson. Undo returns to the
previous correctly answered question; wrong choices do not add history. Hints
show the inclusive sequence of pitch names and highlight its positions without
submitting. Reset remounts an empty lesson. Pause and completion lock answers and
playback; completion is reported once. Numeric keys 1–8 work only within the game
workspace, with modifier, composition, and repeat guards. Native buttons support
touch, Tab, Enter and Space; no timed response is required.

## Optional audio, complete public visual path

The current two pitch names, their 1–8 positions, and the entire labeled scale
remain visible. This public visual mode has the same scoring and completion as
using sound, including when globally muted or Web Audio is unavailable.

Only an explicit press of the play button creates or resumes an AudioContext.
Two short sine oscillators play sequentially at MIDI values
`[60, 62, 64, 65, 67, 69, 71, 72]`, calculated with
`440 * 2 ** ((midi - 69) / 12)`. The gain has a short attack and release envelope.
Playback alone never changes a score. No sound starts automatically on a new
question, lesson, unmute, or resume. The host's separate completion chime remains
under the host's existing sound setting.

Pause, mute, hidden page, question changes, undo, reset, and unmount cancel and
disconnect scheduled voices. Generation checks and the live question/blocked
state prevent late resume promises or old ended callbacks from reviving playback
or overwriting a newer session. Unmount closes the owned audio context. Unsupported
or rejected audio requests show an explicit visual-only fallback.

## Integration and verification boundary

- Component: default export `IntervalNotes`, `src/games/IntervalNotes.tsx`
- Level export: `intervalNotesLevels`, `src/games/intervalNotesLogic.ts`
- Stable ID: `interval-notes`; level count: 8
- Manifest: `staging/interval-notes.json`
- Targeted final E2E: `e2e/interval-notes.spec.ts`

The spec covers first and final lessons using visible pitch-position captions,
wrong answers, playback not scoring, mute, pause, hint, undo, reset during optional
playback, question-transition cleanup, modifier/repeat guards, native keyboard
and mobile taps, disabled terminal controls, stored completion, page errors,
console errors, horizontal overflow, touch sizes, and four screenshots per
desktop/mobile run. It does not import answers or use a hidden solver.

The contributor authors but does not run browser/E2E/unit/campaign/proof suites.
The sole integration owner runs the one final targeted desktop/mobile invocation
after registration. Visual acceptance and Web Audio state checks do not certify
acoustic output, speaker output, device latency, or perceived pitch; no such
acoustic certification is claimed.
