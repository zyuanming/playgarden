# BlicblockJS source and asset audit

Audited 2026-10-10 before executing the adapted runtime. First-party repository:
https://github.com/cheshire137/blicblock-js/tree/05bafeedb8684e478cda9061e98406acff8d9a83

The fixed commit's LICENSE.txt grants MIT permission and credits Copyright (c)
2014 Sarah Vessels. The full license is preserved verbatim both in upstream and
public/blicblock-LICENSE.txt. manifest.json pins every retained upstream file by
SHA-256. No upstream installers, dependencies, Rails, Grunt, Bower, or tests ran.

Reviewed the entire Block model, Tetromino service, MainCtrl controller, compiled
first-party bundle, app wiring, main/help templates, and main.scss. Runtime code
reuses the original compiled Block/Tetromino/MainCtrl function bodies directly.
The editable CoffeeScript originals remain beside the unmodified compiled bundle.
Only those three first-party bodies are extracted. Angular's registration surface
is replaced with a small local dependency adapter. It does not load Angular or
execute the original routing, directives, score/country API factories, or any
third-party vendor bundle. The retained MainCtrl's online-score callback is removed
from the local scope immediately; no score submission UI or API transport exists.

Verified actual gameplay: six colors (not the README's four-color description of
the referenced commercial game), board 5 columns × 7 rows, one falling block,
two-block preview, all seven tetromino families and their original rotations,
gravity and cascading matches, 1,000 points for four-block removal, level increment
every 4,000 points, 1,200 ms initial falling interval reduced 9% per level, 25 ms
hard-drop animation, 100 ms side-step lock, and loss when the seven-cell center
column cannot accept the next block. The four existing cascade teaching layouts
are retained and explicitly not counted as campaign levels. Six-color endless
play is the default. This is one distinct game and has **0 finite levels**.

Only the author's programmatic block colors/stripe treatment from main.scss are
adapted. The commercial Sims screenshots/video, Simlish and pixel fonts, flag
sprites, vector maps, Bootstrap, third-party JS, and every binary asset are excluded.
Raw documentation mentioning excluded assets is preserved as source documentation,
never rendered as game UI. The adapted UI uses system fonts and CSS geometry only.

Integration additions (GPL-3.0-only): Chinese responsive React UI, distinct pattern
symbols for the six colors, keyboard/touch controls, a pausable/disposable timer
adapter, blur/visibility pause, and isolated local best-score storage. The actual
upstream game rules and timers retain their original values. All scheduled callbacks
freeze together, including cascade/drop animation, when the host pauses. Unmount
disposes every timer. The normal-mode best score is saved only after game over, as
in the original; a new visit starts a new round. Storage errors cannot stop play.

Security review: the retained gameplay code makes no network calls, installs
nothing, evaluates no downloaded strings, has no credentials or account data, and
does not require a server. The adapter has no writable game-state test hook. Its
optional __blicblockRead hook returns detached snapshots only.
