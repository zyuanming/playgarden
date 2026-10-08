# 泡泡弹射 / Bubble Post

License: GPL-3.0-only, under the repository's complete LICENSE text and public/playgarden-COPYING.txt.

This is an original implementation of the general bubble-shooter rules: a circular projectile travels along an aim ray, reflects from side walls, stops at the first circle/ceiling contact, and attaches to a neighboring empty staggered hex cell. A connected same-color group of three or more is removed; remaining bubbles disconnected from the ceiling fall away. No external game repository, snippet, physics engine, artwork, sound, brand, or level was copied or incorporated. There is no upstream commit to report. React and the host application retain their existing separate notices.

Original deliverables:
- src/games/bubbleShooterLogic.ts: analytic ray/circle collision, wall reflection, hex adjacency, connected-group removal, ceiling connectivity and bounded one-shot hint scoring.
- src/games/bubbleShooterLevels.ts: 12 individually authored finite boards and ordered shot supplies. They are not rotations or recolorings of one board.
- src/games/BubbleShooterGarden.tsx and bubbleShooterGarden.css: original Chinese interface, SVG rendering, symbol-coded colors, explicit aim/fire controls and cancellable flight presentation.
- src/games/bubbleShooterStorage.ts: versioned angle-history replay. Saved boards, scores and victory flags are never trusted.
- public/bubble-shooter-art.svg: original editable vector illustration.
- e2e/bubble-shooter.spec.ts: one final targeted browser journey, not executed by the contributor.

## Authored progression

1. 初次相遇: one exposed matching pair.
2. 隔岸来信: separated ceiling islands and an optional right-wall bank to the left island.
3. 双色夹心: two-color vertical layering.
4. 三只风铃: three hanging chains with different terminal colors.
5. 松开的缎带: a narrow support over a multicolor ribbon.
6. 悬挂风车: four layers; a yellow match releases a green satellite.
7. 两侧航道: isolated edge islands around a deep central obstacle.
8. 纸风拱门: two ceiling supports sharing a transverse bridge.
9. 错层书架: asymmetric staggered branches.
10. 先交一个朋友: an isolated yellow bubble requires two additional matching shots.
11. 编织天幕: four independently anchored ceiling colors above interlocking lower clusters.
12. 灯会谢幕: asymmetric seven-row lanterns, with a deliberate eight-shot bottom-up color order.

Each queue is finite and visible. Queue entries whose color no longer exists on the board are skipped; there is no hidden infinite supply or timer. A run ends when the board is empty, the remaining queue is exhausted, or a surviving bubble reaches the danger row. Undo is available before victory, including after loss. Hints compare only immediate effects and explicitly do not promise victory or optimality.

## Verification status

Contributor performed source authoring and static inspection only. No unit test, campaign sweep, browser test, package installation, build, or deployment was run in the contributor workspace. The integration owner owns ordinary type/build/license checks and exactly one targeted final E2E invocation for this game. Representative first, middle, bank and final browser routes are written into the supplied journey and remain unrun until that invocation.
