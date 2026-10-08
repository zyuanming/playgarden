# Ataxx: source and rule adaptation

Fixed upstream: [kz04px/libataxx](https://github.com/kz04px/libataxx/tree/4226c26dd11a1f74be708882ece6fd9dc96c767b), commit `4226c26dd11a1f74be708882ece6fd9dc96c767b`, MIT, Copyright (c) 2019 kz04px.

Selected full unchanged source files and LICENSE are retained in `vendor/libataxx`, with Git blob and SHA256 identities in source.json. These C++ files are read as source; they are not installed, compiled or executed. Playgarden's port, interface, original lessons, AI, storage and graphics are GPL-3.0-only contributions. No upstream pictures, sounds, fonts, GUI, engine binaries or level collection are included.

Substantive port map:
- `is_legal_move.cpp`: empty destination, friendly source, one- or two-square reach, terminal rejection and forced pass.
- `legal_moves.cpp`: enumerate clone destinations once, enumerate jumps by source and destination, offer pass only if no move exists in a live position.
- `makemove.cpp`: clones retain the origin, jumps clear it, all eight adjacent opponents convert, turn changes. Only clones reset the no-clone counter; captures do not.
- `gameover.cpp` and `position.hpp::get_result`: elimination or mutual immobility is scored by actual pieces; otherwise 100 consecutive jump/pass plies are a draw. Empty inaccessible spaces are not awarded to either side.
- `bitboard.hpp::singles/doubles`: port the neighborhood geometry to bounded coordinates. A jump may cross gaps and occupied squares. Teaching boards may be smaller than upstream's fixed 7×7.

The clone UI asks for a source to teach the rule; any adjacent friendly source is accepted, even though clones with the same destination are equivalent search actions. The standard free match uses 7×7 with one central gap. Its bounded local AI is a lightweight opponent, not an optimal-play guarantee.

Ataxx differs from the existing Reversi game: moves originate from your own pieces, cloning adds a piece while jumping vacates its origin, and captures affect every adjacent opponent without bracketing. It is not a new name for Reversi, Hex or Gomoku.

Base repository inspected: main `e78bccecca2ca8aacee7358caf7662251914d7b9`, all 94 registered games. No AGENTS.md or repository-local skill files are present at this base.
