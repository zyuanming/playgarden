// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameProps } from "../src/lib/types";
import VoxelViews from "../src/games/VoxelViews";
import CubeNetWorkshop from "../src/games/CubeNetWorkshop";
import {
  createVoxelBoard,
  solveVoxel,
  toggleVoxel,
  validVoxelBoard,
  voxelProjection,
  voxelViewsCertificates,
  voxelViewsLevels,
  voxelWon,
  VOXEL_SEARCH_LIMIT,
  type VoxelLevel,
} from "../src/games/voxelViewsLogic";
import {
  createCubeNetBoard,
  cubeNetCertificates,
  cubeNetLevels,
  cubeNetWon,
  foldCubeNet,
  placeNetFace,
  solveCubeNet,
  validCubeNetBoard,
  CUBE_NET_SEARCH_LIMIT,
  type CubeNetLevel,
} from "../src/games/cubeNetLogic";
afterEach(cleanup);
const props = (overrides: Partial<GameProps> = {}): GameProps => ({
  level: 0,
  paused: false,
  resetToken: 0,
  hintToken: 0,
  undoToken: 0,
  onStatus: vi.fn(),
  onComplete: vi.fn(),
  ...overrides,
});
const button = (selector: string) => {
  const result = document.querySelector<HTMLButtonElement>(selector);
  expect(result, selector).not.toBeNull();
  return result!;
};
const voxel = (index: number) => button(`[data-voxel-cell="${index}"]`);
const face = (index: number) => button(`[data-net-face="${index}"]`);
const cell = (index: number) => button(`[data-net-cell="${index}"]`);
function replayVoxels(index: number) {
  const level = voxelViewsLevels[index];
  voxelViewsCertificates[index]
    .filter((i) => level.locked[i] !== 1)
    .forEach((i) => fireEvent.click(voxel(i)));
}
function replayNet(index: number) {
  const level = cubeNetLevels[index];
  cubeNetCertificates[index].forEach((p, f) => {
    if (level.fixed[f] === undefined) {
      fireEvent.click(face(f));
      fireEvent.click(cell(p));
    }
  });
}
function freeze<T>(v: T): T {
  if (v && typeof v === "object") {
    Object.freeze(v);
    Object.values(v).forEach(freeze);
  }
  return v;
}
/** Independent voxel oracle uses xyz nested loops, no production indices/rays/projections. */
function voxelOracle(level: VoxelLevel, board: readonly number[]): boolean {
  const n = level.size;
  if (board.length !== n * n * n || board.some((v) => v !== 0 && v !== 1))
    return false;
  for (const [p, v] of Object.entries(level.locked))
    if (board[Number(p)] !== v) return false;
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      let count = 0;
      for (let y = 0; y < n; y++) count += board[(z * n + y) * n + x];
      if (count !== level.front[z * n + x]) return false;
    }
  for (let z = 0; z < n; z++)
    for (let y = 0; y < n; y++) {
      let count = 0;
      for (let x = 0; x < n; x++) count += board[(z * n + y) * n + x];
      if (count !== level.side[z * n + y]) return false;
    }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let count = 0;
      for (let z = 0; z < n; z++) count += board[(z * n + y) * n + x];
      if (count !== level.top[y * n + x]) return false;
    }
  return true;
}
type V = [number, number, number];
const plus = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: V, b: V) => a.reduce((s, v, i) => s + v * b[i], 0);
const equal = (a: V, b: V) => a.every((v, i) => v === b[i]);
/** Independent rigid-hinge oracle. Rotates coordinates about shared edges by
 * Rodrigues' exact quarter-turn formula, then checks six physical face centers. */
function netOracle(
  size: number,
  board: readonly number[],
  opposites: number[][] = [],
): boolean {
  if (
    board.length !== 6 ||
    board.some((p) => !Number.isInteger(p) || p < 0 || p >= size * size) ||
    new Set(board).size !== 6
  )
    return false;
  type Face = { center: V; right: V; down: V };
  const frames = new Map<number, Face>([
      [0, { center: [0, 0, 0], right: [1, 0, 0], down: [0, 1, 0] }],
    ]),
    queue = [0];
  for (const f of queue) {
    const known = frames.get(f)!;
    for (let g = 0; g < 6; g++) {
      const dx = (board[g] % size) - (board[f] % size),
        dy = Math.floor(board[g] / size) - Math.floor(board[f] / size);
      if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
      const tangent = plus(scale(known.right, dx), scale(known.down, dy));
      const normal = cross(known.right, known.down),
        axis = dx ? known.down : known.right,
        direction = dx || -dy;
      const rotate = (v: V): V =>
        plus(scale(axis, dot(axis, v)), scale(cross(axis, v), direction));
      const next = {
        center: plus(plus(known.center, tangent), scale(normal, -1)),
        right: rotate(known.right),
        down: rotate(known.down),
      };
      const before = frames.get(g);
      if (before) {
        if (
          !equal(before.center, next.center) ||
          !equal(before.right, next.right) ||
          !equal(before.down, next.down)
        )
          return false;
      } else {
        frames.set(g, next);
        queue.push(g);
      }
    }
  }
  if (frames.size !== 6) return false;
  const centers = [...frames.values()].map((f) => f.center);
  if (new Set(centers.map((c) => c.join(","))).size !== 6) return false;
  if (
    [...frames.values()].some(
      (f) => !equal(plus(f.center, [0, 0, 1]), cross(f.right, f.down)),
    )
  )
    return false;
  return opposites.every(([a, b]) =>
    equal(plus(frames.get(a)!.center, frames.get(b)!.center), [0, 0, -2]),
  );
}
function netCertificate(level: CubeNetLevel, board: number[]) {
  expect(board).toHaveLength(6);
  expect(new Set(board).size).toBe(6);
  board.forEach((p) => expect(level.allowed).toContain(p));
  Object.entries(level.fixed).forEach(([f, p]) =>
    expect(board[Number(f)]).toBe(p),
  );
  expect(netOracle(level.size, board, level.opposites)).toBe(true);
}
function canonical(points: number[][]): string {
  const variants: string[] = [];
  for (const swap of [false, true])
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const transformed = points.map(([x, y]) => [
            sx * (swap ? y : x),
            sy * (swap ? x : y),
          ]),
          xmin = Math.min(...transformed.map((p) => p[0])),
          ymin = Math.min(...transformed.map((p) => p[1]));
        variants.push(
          transformed
            .map(([x, y]) => `${x - xmin},${y - ymin}`)
            .sort()
            .join(";"),
        );
      }
  return variants.sort()[0];
}
function hexominoes(): number[][][] {
  let shapes = new Map<string, number[][]>([["0,0", [[0, 0]]]]);
  for (let count = 1; count < 6; count++) {
    const next = new Map<string, number[][]>();
    for (const points of shapes.values())
      for (const [x, y] of points)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (points.some((p) => p[0] === x + dx && p[1] === y + dy)) continue;
          const key = canonical([...points, [x + dx, y + dy]]);
          next.set(
            key,
            key.split(";").map((p) => p.split(",").map(Number)),
          );
        }
    shapes = next;
  }
  return [...shapes.values()];
}
describe("original independent spatial construction certificates", () => {
  it("certifies all 12 voxel targets without the production solver or validator", () => {
    expect(voxelViewsLevels).toHaveLength(12);
    expect(voxelViewsCertificates).toHaveLength(12);
    expect(
      new Set(
        voxelViewsLevels.map((l) =>
          JSON.stringify([l.size, l.front, l.side, l.top]),
        ),
      ).size,
    ).toBe(12);
    voxelViewsLevels.forEach((level, i) => {
      const certificate = voxelViewsCertificates[i],
        board = Array(level.size ** 3).fill(0);
      expect(new Set(certificate).size).toBe(certificate.length);
      certificate.forEach((p) => {
        expect(Number.isInteger(p) && p >= 0 && p < board.length).toBe(true);
        board[p] = 1;
      });
      expect(voxelOracle(level, board)).toBe(true);
      expect(voxelWon(level, board)).toBe(true);
      expect(voxelWon(level, createVoxelBoard(level))).toBe(false);
      expect(level.front.reduce((a, b) => a + b, 0)).toBe(certificate.length);
    });
  });
  it("certifies all 12 labeled cube nets, including eleven distinct free shapes", () => {
    expect(cubeNetLevels).toHaveLength(12);
    cubeNetLevels.forEach((l, i) => {
      netCertificate(l, cubeNetCertificates[i]);
      expect(cubeNetWon(l, cubeNetCertificates[i])).toBe(true);
      expect(cubeNetWon(l, createCubeNetBoard(l))).toBe(false);
    });
    expect(
      new Set(
        cubeNetCertificates
          .slice(0, 11)
          .map((points) =>
            canonical(points.map((p) => [p % 5, Math.floor(p / 5)])),
          ),
      ).size,
    ).toBe(11);
    expect(cubeNetLevels.at(-1)!.opposites).toHaveLength(3);
  });
  it("agrees with a rigid-hinge oracle for all 35 free hexominoes; exactly eleven fold", () => {
    const shapes = hexominoes();
    expect(shapes).toHaveLength(35);
    let valid = 0;
    for (const shape of shapes) {
      const cells = shape.map(([x, y]) => y * 6 + x),
        result = foldCubeNet(6, cells),
        oracle = netOracle(6, cells);
      expect(result.connected && result.consistent && result.distinct).toBe(
        oracle,
      );
      if (oracle) valid++;
    }
    expect(valid).toBe(11);
  });
  it("exhaustively compares all 2³ boards with independent projection sums", () => {
    for (const level of voxelViewsLevels.filter((l) => l.size === 2))
      for (let mask = 0; mask < 256; mask++) {
        const board = Array.from({ length: 8 }, (_, i) => (mask >> i) & 1);
        expect(voxelWon(level, board)).toBe(voxelOracle(level, board));
      }
  });
  it("accepts alternative geometry instead of matching a hidden certificate", () => {
    const level: VoxelLevel = {
      title: "oracle",
      size: 2,
      front: [1, 1, 1, 1],
      side: [1, 1, 1, 1],
      top: [1, 1, 1, 1],
      locked: {},
      idea: "",
    };
    const a = [1, 0, 0, 1, 0, 1, 1, 0],
      b = a.map((v) => 1 - v);
    expect(voxelWon(level, a)).toBe(true);
    expect(voxelWon(level, b)).toBe(true);
    const net = {
      ...cubeNetLevels[0],
      allowed: Array.from({ length: 25 }, (_, i) => i),
      fixed: {},
      opposites: [],
    };
    expect(cubeNetWon(net, cubeNetCertificates[0])).toBe(true);
    expect(cubeNetWon(net, cubeNetCertificates[5])).toBe(true);
  });
});
describe("bounded solvers, immutable moves and invalid geometry", () => {
  it("finds certified completions from all starts and certificate prefixes", () => {
    let vmax = 0,
      nmax = 0;
    for (let i = 0; i < 12; i++) {
      const l = voxelViewsLevels[i],
        b = createVoxelBoard(l);
      for (const p of voxelViewsCertificates[i].slice(
        0,
        Math.floor(voxelViewsCertificates[i].length / 2),
      ))
        b[p] = 1;
      for (const start of [createVoxelBoard(l), b]) {
        const r = solveVoxel(l, freeze([...start]));
        expect(r.status).toBe("found");
        expect(voxelOracle(l, r.board!)).toBe(true);
        expect(start.every((v, p) => v === 0 || r.board![p] === 1)).toBe(true);
        vmax = Math.max(vmax, r.nodes);
      }
      const n = cubeNetLevels[i],
        s = createCubeNetBoard(n),
        remaining = cubeNetCertificates[i]
          .map((p, f) => ({ p, f }))
          .filter(({ f }) => n.fixed[f] === undefined);
      if (remaining.length) s[remaining[0].f] = remaining[0].p;
      for (const start of [createCubeNetBoard(n), s]) {
        const r = solveCubeNet(n, freeze([...start]));
        expect(r.status, `net ${i}`).toBe("found");
        netCertificate(n, r.board!);
        expect(start.every((v, f) => v < 0 || r.board![f] === v)).toBe(true);
        nmax = Math.max(nmax, r.nodes);
      }
    }
    expect(
      solveVoxel(voxelViewsLevels[11], createVoxelBoard(voxelViewsLevels[11]))
        .nodes,
    ).toBeGreaterThan(1);
    expect(vmax).toBeLessThan(VOXEL_SEARCH_LIMIT);
    expect(nmax).toBeLessThan(CUBE_NET_SEARCH_LIMIT);
  });
  it("reports zero-budget searches as limited, never impossible", () => {
    expect(
      solveVoxel(
        voxelViewsLevels[11],
        createVoxelBoard(voxelViewsLevels[11]),
        0,
      ),
    ).toEqual({ status: "limit", board: null, nodes: 0 });
    expect(
      solveCubeNet(cubeNetLevels[11], createCubeNetBoard(cubeNetLevels[11]), 0),
    ).toEqual({ status: "limit", board: null, nodes: 0 });
    expect(
      solveVoxel(
        voxelViewsLevels[0],
        createVoxelBoard(voxelViewsLevels[0]),
        NaN,
      ).status,
    ).toBe("limit");
  });
  it("distinguishes impossible additions from budget exhaustion", () => {
    const level = voxelViewsLevels[0],
      board = createVoxelBoard(level);
    board[7] = 1;
    expect(solveVoxel(level, board).status).toBe("impossible");
    const l = {
      ...cubeNetLevels[0],
      allowed: [0, 1, 2, 3, 4, 5],
      size: 6,
      fixed: { 0: 0 },
      opposites: [],
    };
    expect(solveCubeNet(l, createCubeNetBoard(l)).status).toBe("impossible");
  });
  it("preserves inputs and rejects overlap, fixed edits and malformed states", () => {
    const vl = voxelViewsLevels[8],
      vb = freeze(createVoxelBoard(vl));
    expect(toggleVoxel(vl, vb, 0)).toBeNull();
    expect(toggleVoxel(vl, vb, 27)).toBeNull();
    expect(toggleVoxel(vl, vb, 1.5)).toBeNull();
    expect(toggleVoxel(vl, vb, 1)).not.toBe(vb);
    expect(vb[1]).toBe(0);
    expect(validVoxelBoard(vl, [...vb, 0])).toBe(false);
    expect(voxelWon(vl, Array(27).fill(2))).toBe(false);
    const l = cubeNetLevels[0],
      b = freeze(createCubeNetBoard(l));
    expect(placeNetFace(l, b, 0, 2)).toBeNull();
    expect(placeNetFace(l, b, 4, b[0])).toBeNull();
    expect(placeNetFace(l, b, 4, 99)).toBeNull();
    expect(placeNetFace(l, b, 4, cubeNetCertificates[0][4])).not.toBe(b);
    expect(b[4]).toBe(-1);
    expect(validCubeNetBoard(l, [...b.slice(0, 5), b[0]])).toBe(false);
    expect(foldCubeNet(6, [0, 1, 2, 3, 4, 5]).distinct).toBe(false);
    const loop = foldCubeNet(5, [0, 1, 5, 6, 7, 8]);
    expect(loop.consistent && loop.distinct).toBe(false);
    expect(foldCubeNet(5, [0, 1, 2, 15, 16, 17]).connected).toBe(false);
  });
  it("independently brute-forces small constrained labeled workshops", () => {
    for (const level of cubeNetLevels.slice(0, 4)) {
      const start = createCubeNetBoard(level);
      let completions = 0;
      function visit(board: number[]) {
        const f = board.indexOf(-1);
        if (f < 0) {
          if (netOracle(level.size, board, level.opposites)) completions++;
          return;
        }
        for (const p of level.allowed)
          if (!board.includes(p)) {
            const next = [...board];
            next[f] = p;
            visit(next);
          }
      }
      visit(start);
      expect(completions).toBeGreaterThan(0);
      expect(solveCubeNet(level, start).status).toBe("found");
    }
  });
});
describe("all-level accessible DOM replays", () => {
  it.each(Array.from({ length: 12 }, (_, i) => i))(
    "completes voxel level %i without WebGL",
    (index) => {
      const p = props({ level: index });
      const view = render(<VoxelViews {...p} />);
      expect(document.querySelector("canvas")).toBeNull();
      replayVoxels(index);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        document.querySelectorAll('[data-voxel-projection][data-state="match"]')
          .length,
      ).toBe(3 * voxelViewsLevels[index].size ** 2);
      view.rerender(<VoxelViews {...p} hintToken={1} undoToken={1} />);
      replayVoxels(index);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it.each(Array.from({ length: 12 }, (_, i) => i))(
    "completes cube-net level %i without WebGL",
    (index) => {
      const p = props({ level: index });
      const view = render(<CubeNetWorkshop {...p} />);
      replayNet(index);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText("六个面各就各位，对面配对正确，纸盒完成！"),
      ).toBeTruthy();
      view.rerender(<CubeNetWorkshop {...p} hintToken={1} undoToken={1} />);
      expect(p.onComplete).toHaveBeenCalledTimes(1);
    },
  );
  it("voxel undo/reset and paused shell tokens never replay after resume", () => {
    const p = props();
    const view = render(<VoxelViews {...p} />);
    fireEvent.click(voxel(0));
    view.rerender(<VoxelViews {...p} undoToken={1} />);
    expect(voxel(0).dataset.filled).toBe("0");
    view.rerender(<VoxelViews {...p} paused hintToken={1} undoToken={2} />);
    fireEvent.click(voxel(0));
    expect(voxel(0).dataset.filled).toBe("0");
    view.rerender(<VoxelViews {...p} hintToken={1} undoToken={2} />);
    expect(document.querySelector(".sc-hinted")).toBeNull();
    fireEvent.click(voxel(0));
    view.rerender(
      <VoxelViews {...p} hintToken={1} undoToken={2} resetToken={1} />,
    );
    expect(voxel(0).dataset.filled).toBe("0");
    expect(document.querySelector(".sc-hinted")).toBeNull();
  });
  it("paper moves can be undone and removed; occupied/fixed/blocked cells are safe", () => {
    const p = props();
    const view = render(<CubeNetWorkshop {...p} />);
    const certificate = cubeNetCertificates[0];
    fireEvent.click(face(4));
    fireEvent.click(cell(certificate[4]));
    expect(face(4).dataset.position).toBe(String(certificate[4]));
    fireEvent.click(cell(certificate[0]));
    expect(face(4).dataset.position).toBe(String(certificate[4]));
    fireEvent.click(
      cell(cubeNetLevels[0].allowed.find((p) => !certificate.includes(p))!),
    );
    view.rerender(<CubeNetWorkshop {...p} undoToken={1} />);
    expect(face(4).dataset.position).toBe(String(certificate[4]));
    fireEvent.click(button('[data-net-action="remove"]'));
    expect(face(4).dataset.position).toBe("-1");
    view.rerender(<CubeNetWorkshop {...p} undoToken={2} />);
    expect(face(4).dataset.position).toBe(String(certificate[4]));
    view.rerender(
      <CubeNetWorkshop {...p} paused hintToken={2} undoToken={3} />,
    );
    fireEvent.click(button('[data-net-action="remove"]'));
    expect(face(4).dataset.position).toBe(String(certificate[4]));
    view.rerender(<CubeNetWorkshop {...p} hintToken={2} undoToken={3} />);
    expect(face(4).dataset.position).toBe(String(certificate[4]));
    expect(document.querySelector(".sc-hinted")).toBeNull();
  });
  it("hints are truthful selections without automatic mutation", () => {
    const p = props({ level: 11 });
    const view = render(<VoxelViews {...p} />);
    view.rerender(<VoxelViews {...p} hintToken={1} />);
    expect(document.querySelector(".sc-hinted")).not.toBeNull();
    expect(
      document
        .querySelector("[data-voxel-count]")
        ?.getAttribute("data-voxel-count"),
    ).toBe("0");
    expect(screen.getByRole("status").textContent).toContain("一种可行搭法");
    cleanup();
    const q = props({ level: 11 });
    const net = render(<CubeNetWorkshop {...q} />);
    net.rerender(<CubeNetWorkshop {...q} hintToken={1} />);
    expect(document.querySelector(".sc-hinted")).not.toBeNull();
    expect(
      document
        .querySelector("[data-net-count]")
        ?.getAttribute("data-net-count"),
    ).toBe("1");
    expect(screen.getByRole("status").textContent).toContain("一种完整方案");
  });
  it("keyboard-only construction supports arrow movement and native activation", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<VoxelViews {...p} />);
    voxel(0).focus();
    await user.keyboard(
      "{Enter}{ArrowRight}{Enter}{ArrowLeft}{ArrowDown}{Enter}",
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    cleanup();
    const q = props();
    render(<CubeNetWorkshop {...q} />);
    for (const f of [4, 5]) {
      face(f).focus();
      await user.keyboard("{Enter}");
      cell(cubeNetCertificates[0][f]).focus();
      await user.keyboard(" ");
    }
    expect(q.onComplete).toHaveBeenCalledTimes(1);
  });
  it("StrictMode completion stays one-shot, while new rounds reset all state", () => {
    const p = props({ hintToken: 5, undoToken: 8 });
    const view = render(
      <StrictMode>
        <VoxelViews {...p} />
      </StrictMode>,
    );
    replayVoxels(0);
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <VoxelViews {...p} paused />
      </StrictMode>,
    );
    view.rerender(
      <StrictMode>
        <VoxelViews {...p} />
      </StrictMode>,
    );
    expect(p.onComplete).toHaveBeenCalledTimes(1);
    view.rerender(
      <StrictMode>
        <VoxelViews {...p} resetToken={1} />
      </StrictMode>,
    );
    replayVoxels(0);
    expect(p.onComplete).toHaveBeenCalledTimes(2);
    cleanup();
    const q = props({ hintToken: 3, undoToken: 2 });
    const net = render(
      <StrictMode>
        <CubeNetWorkshop {...q} />
      </StrictMode>,
    );
    replayNet(0);
    expect(q.onComplete).toHaveBeenCalledTimes(1);
    net.rerender(
      <StrictMode>
        <CubeNetWorkshop {...q} level={11} />
      </StrictMode>,
    );
    expect(
      document
        .querySelector("[data-net-count]")
        ?.getAttribute("data-net-count"),
    ).toBe("1");
    expect(face(4).getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector(".sc-hinted")).toBeNull();
    replayNet(11);
    expect(q.onComplete).toHaveBeenCalledTimes(2);
  });
});
