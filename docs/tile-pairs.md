# 叠牌寻对

Original GPL-3.0-only implementation, eight authored tile geometries, glyph-based artwork and SVG cover. Uses generic Mahjong-solitaire freedom and matching, with no copied third-party source or assets. This is spatial removal with a visible layered layout, not face-down memory-pair matching. Upper layers may obscure lower glyphs until removed.

A tile is free iff it has no overlapping tile above and at least one unoccupied immediate horizontal side at its own level. Only matching free pairs may be removed. Every tile must be removed for victory. Layer 1–3 labels, visible raised edges, disabled blocked tiles and accessible labels explain freedom. Matching layouts are assigned along a constructive geometric removal order, rather than relying on random solvability. Later layouts repeat symbols, allowing meaningful partner choices. Eight geometries progress from rows to roofs, wings, bridges, towers and an interleaved layered garden.

Hints search the live remainder for a complete removal path; a bounded inconclusive search requests undo instead of claiming a proof of impossibility. Undo restores the previous pair. Pause and victory lock controls; restart reconstructs the layout. Native buttons handle touch and keyboard.

The integration owner runs the supplied single targeted first/final-level E2E invocation. Contributor did not run unit or browser suites.
