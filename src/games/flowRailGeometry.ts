// SPDX-License-Identifier: MIT
/** Presentation-only badge placement. No puzzle rules, targets or witnesses. */
export type RoutePoint = { x: number; y: number };
export type RouteBadge = RoutePoint & { anchor: RoutePoint; detached: boolean };
export function routeBadges(
  nodes: readonly RoutePoint[],
  routes: readonly RoutePoint[][],
): RouteBadge[] {
  const boxes = nodes.map((n) => ({
    left: n.x - 36,
    right: n.x + 36,
    top: n.y - 34,
    bottom: n.y + 62,
  }));
  const used: RouteBadge[] = [];
  const width = Math.max(...nodes.map((n) => n.x)) + 155,
    height = Math.max(...nodes.map((n) => n.y)) + 165;
  const clear = (x: number, y: number) =>
    x >= 13 &&
    y >= 12 &&
    x + 13 <= width &&
    y + 12 <= height &&
    !boxes.some(
      (b) =>
        x + 13 >= b.left &&
        x - 13 <= b.right &&
        y + 12 >= b.top &&
        y - 12 <= b.bottom,
    ) &&
    !used.some((b) => Math.abs(b.x - x) < 27 && Math.abs(b.y - y) < 25);
  for (const route of routes) {
    const segments = route
      .slice(1)
      .map((b, i) => ({
        a: route[i],
        b,
        length: Math.hypot(b.x - route[i].x, b.y - route[i].y),
      }))
      .sort((a, b) => b.length - a.length);
    let chosen: RouteBadge | undefined;
    for (const { a, b, length } of segments) {
      if (chosen || length < 26) continue;
      for (const fraction of [0.5, 0.3, 0.7, 0.15, 0.85]) {
        if (chosen) break;
        const anchor = {
          x: a.x + (b.x - a.x) * fraction,
          y: a.y + (b.y - a.y) * fraction,
        };
        if (
          boxes.some(
            (r) =>
              anchor.x >= r.left &&
              anchor.x <= r.right &&
              anchor.y >= r.top &&
              anchor.y <= r.bottom,
          )
        )
          continue;
        for (const shift of [0, 16, -16, 32, -32]) {
          const x = anchor.x + (a.x === b.x ? shift : 0),
            y = anchor.y + (a.y === b.y ? shift : 0);
          if (clear(x, y)) {
            chosen = { x, y, anchor, detached: false };
            break;
          }
        }
      }
    }
    // A visible numbered margin key is preferable to covering a station or another badge.
    if (!chosen) {
      let y = 20;
      const x = width - 32;
      while (!clear(x, y) && y < height - 15) y += 26;
      chosen = { x, y, anchor: { x, y }, detached: true };
    }
    used.push(chosen);
  }
  return used;
}
