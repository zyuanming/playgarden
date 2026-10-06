// Derived from markstent/runner, commit 22a0d0dd74f880025559235bf6139a85316da821.
// Upstream portions: Copyright (c) 2026 Mark Stent, MIT.
// Playgarden modifications: Copyright (c) 2026 YuanMing, GPL-3.0-only.
// Playgarden adaptations are documented in docs/cloudrunner.md; upstream LICENSE is preserved.
/**
 * Keyboard and touch input for player movement.
 *
 * The mapping from a `KeyboardEvent.code` to a movement `Intent` is a PURE
 * function (`keyToIntent`) so it can be unit-tested without a DOM. `attachInput`
 * is a thin imperative shell that wires a real keydown listener to a sink, so
 * main.ts can feed intents into the player `step`.
 *
 * Touch is the mobile mirror of the same seam: `swipeToIntent` is a PURE swipe
 * classifier (unit-tested like `keyToIntent`), and `attachTouchInput` is the
 * thin touchstart/touchend shell that measures the gesture and feeds the same
 * intent sink. Both feed the SAME intent queue in main.ts, so the player `step`
 * is driven identically by keyboard and touch.
 */
import type { Intent } from "../player/index.ts";

/** Map a `KeyboardEvent.code` to a movement intent, or null if unmapped. */
export function keyToIntent(code: string): Intent | null {
  switch (code) {
    case "ArrowLeft":
    case "KeyA":
      return "left";
    case "ArrowRight":
    case "KeyD":
      return "right";
    case "ArrowUp":
    case "KeyW":
    case "Space":
      return "jump";
    case "ArrowDown":
    case "KeyS":
      return "slide";
    default:
      return null;
  }
}

// --- Touch input --------------------------------------------------------
// Mobile mirror of the keyboard seam. A swipe is classified by its net travel
// (dx, dy) from touchstart to touchend; screen Y grows downward, so an upward
// swipe has a negative dy. The dominant axis wins and must itself clear the
// threshold; an exact tie favours the horizontal (lateral) move. Travel below
// the threshold is a tap, not a swipe, and maps to no intent.

/** Minimum dominant-axis travel (px) for a touch drag to count as a swipe. */
export const SWIPE_THRESHOLD = 30;

/**
 * Classify a swipe's net travel into a movement intent, or null if it is below
 * `threshold` (a tap). PURE: the touch equivalent of `keyToIntent`.
 *
 * - horizontal dominant: dx > 0 -> "right", dx < 0 -> "left"
 * - vertical dominant: dy < 0 (up) -> "jump", dy > 0 (down) -> "slide"
 * - |dx| >= |dy| breaks the tie toward the horizontal axis.
 */
export function swipeToIntent(dx: number, dy: number, threshold: number): Intent | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= ay) {
    if (ax < threshold) return null;
    return dx > 0 ? "right" : "left";
  }
  if (ay < threshold) return null;
  return dy > 0 ? "slide" : "jump";
}

