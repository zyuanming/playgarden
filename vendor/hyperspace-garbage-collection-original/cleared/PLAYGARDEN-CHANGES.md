# Hyperspace Garbage Collection: cleared source subset

Upstream: https://github.com/razh/game-off-2013

Commit: `f5b93cbb57f653be4455f9dd5c130463b11abe2a` (2013-12-02).

The original author is razh. The original first-party game code and its
programmatic Canvas rendering are MIT licensed; the full original grant is
in `LICENSE`. Playgarden's small modifications below are GPL-3.0-only, with
the full GPL in `licenses/GPL-3.0.txt`. Original notices remain applicable.

This source package preserves the original four playable maps, their level
scripts, physics, sprites drawn in code, emitters, material collision rules,
lasers, tractor beams, capture triggers, doors, and final ending scene. It is
source prepared for integration, not a claim of a tested Playgarden release.

Changes made on 2026-10-11:

1. `js/color.js`: preserve the original constructor, inheritance, and RGBA
   serialization. Replace the externally sourced RGB/HSL snippet with a
   small Playgarden mathematical implementation. Omit the unused `fromHSL`
   and `lerp` methods, including the unlicensed gist-derived code. The original
   mixed-permission file is not included in this package.
2. `index.html` and `js/entities/trigger.js`: remove the audio element and
   activation playback because the exact MP3's asset license was not verified.
   This is an explicitly silent derivation; it does not contain substitute music.
3. `stylesheets/screen.css`: remove the embedded, version-unrecorded Compass
   reset and compiler path comments. Add a small authored reset. Preserve all
   game-specific visual rules and responsive media rules.
4. Include only the runtime dependency closure, its unminified Box2D source,
   notices, and provenance. No editor, playground, experimental map, screenshot,
   audio, font, build tooling, analytics, or unrelated assets are included.

Third-party code:

- Box2dWeb 2.1.a.3 is frozen exactly as bundled by the pinned game. Its complete
  zlib notice is retained in the unminified source and `licenses/box2dweb-zlib.txt`.
  Keep the notice with the minified version too. No engine rebuild was performed.
- RequireJS 2.1.9 carries its original header. The full official dual-license
  notice at `requirejs/requirejs@a11c37db8f908a26fc245fc82f849761f53f4262`
  is in `licenses/requirejs-2.1.9.txt`; the MIT option is selected.
  Its official unminified preferred source is included in
  `corresponding-source/requirejs-2.1.9.js`.
- RequireJS text 2.0.10 is byte-identical to official `text.js` at
  `requirejs/text@35c3ead097a9ede09469172666cc96349d2ce3e4`.
  Its full dual-license notice is in `licenses/requirejs-text-2.0.10.txt`;
  the MIT option is selected.
- There are no bundled images, fonts, audio files, shaders, or other media.
  System font family names merely request fonts already installed by the browser.

`corresponding-source/original-screen.scss` is the original MIT authoring
reference. Its Compass imports name build dependencies but contain no copied
Compass implementation. The game runs directly from the included, readable
adapted CSS; no Sass/Compass build is necessary or has been run.

The repository's unrelated mixed-permission original files are intentionally
absent. Do not add them back from an audit directory to a public source archive.

Source discovery follows the user's list:
`bobeff/open-source-games` → `leereilly/games` → `razh/game-off-2013`.
The lists are discovery evidence; the game commit above is its provenance.
