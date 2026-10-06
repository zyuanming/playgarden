import { describe, it, expect } from "vitest";
import { blackboxLevels, blackboxChapters } from "../src/games/blackboxLevels";
import {
  ABSORBED,
  REFLECTED,
  blackboxSignature,
  traceBlackbox,
  blackboxCandidates,
  createBlackboxState,
  markBlackbox,
  undoBlackbox,
  fireBlackbox,
  observedBlackbox,
  checkBlackbox,
  getBlackboxHint,
  portName,
  resultName,
} from "../src/games/blackboxLogic";
import {
  parseBlackboxRound,
  saveBlackboxRound,
  BLACKBOX_RESUME_KEY,
} from "../src/games/blackboxStorage";
describe("star probe physical rules", () => {
  it("labels all natural-order ports and symbolic outcomes", () => {
    expect(Array.from({ length: 12 }, (_, p) => portName(3, p))).toEqual([
      "北1",
      "北2",
      "北3",
      "东1",
      "东2",
      "东3",
      "南1",
      "南2",
      "南3",
      "西1",
      "西2",
      "西3",
    ]);
    expect(resultName(3, -1)).toBe("吸收 ●");
    expect(resultName(3, -2)).toBe("返回 ↩");
    expect(resultName(3, 6)).toBe("到 南1");
  });
  it("passes an empty box and gives absorption precedence at entry", () => {
    expect(blackboxSignature(3, [])).toEqual([
      6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5,
    ]);
    expect(traceBlackbox(3, [0, 1], 1)).toBe(ABSORBED);
    expect(traceBlackbox(3, [0], 1)).toBe(REFLECTED);
  });
  it("deflects away from an interior atom and reflects between front diagonals", () => {
    expect(traceBlackbox(3, [4], 0)).toBe(9);
    expect(traceBlackbox(3, [3, 5], 1)).toBe(REFLECTED);
    expect(traceBlackbox(3, [3, 4, 5], 1)).toBe(ABSORBED);
  });
  it("accepts an observationally identical alternative, not just preset coordinates", () => {
    const l = { id: "eq", title: "eq", chapter: 0, size: 3, atoms: [0, 8] };
    let s = createBlackboxState(l);
    s = markBlackbox(markBlackbox(s, 2, 1), 6, 1);
    expect(blackboxSignature(3, [0, 8])).toEqual(blackboxSignature(3, [2, 6]));
    expect(checkBlackbox(l, s).kind).toBe("won");
  });
  it("learns a reciprocal exit without a second charge and keeps evidence on undo", () => {
    const l = blackboxLevels[0];
    let s = fireBlackbox(l, createBlackboxState(l), 0);
    expect(s.probes).toEqual([{ port: 0, result: 9 }]);
    expect(observedBlackbox(s.probes)).toContainEqual({ port: 9, result: 0 });
    expect(fireBlackbox(l, s, 9)).toBe(s);
    expect(undoBlackbox(markBlackbox(s, 0, -1))).toEqual(s);
  });
  it("does not filter hints by arbitrary player guesses", () => {
    const l = blackboxLevels[83],
      s = fireBlackbox(l, createBlackboxState(l), 0),
      other = { ...s, marks: s.marks.map(() => 1 as const) };
    const n = blackboxCandidates(
      l.size,
      l.atoms.length,
      observedBlackbox(s.probes),
    ).length;
    expect(n).toBeGreaterThan(0);
    const h = getBlackboxHint(l.size, l.atoms.length, s),
      h2 = getBlackboxHint(l.size, l.atoms.length, other);
    expect(h.kind).not.toBe("invalid");
    expect(h2.kind).not.toBe("invalid");
  });
});
describe("original campaign and round certificates", () => {
  it("has six chapters of non-padding lesson sizes", () => {
    expect(blackboxLevels).toHaveLength(84);
    expect(blackboxChapters.map((c) => c.count)).toEqual([
      3, 9, 12, 16, 20, 24,
    ]);
    expect(new Set(blackboxLevels.map((l) => l.id)).size).toBe(84);
  });
  for (const [i, l] of blackboxLevels.entries())
    it(`level ${i + 1} accepts its real marks, locks and restores`, () => {
      let s = createBlackboxState(l);
      for (const cell of l.atoms) s = markBlackbox(s, cell, 1);
      const won = checkBlackbox(l, s);
      expect(won.kind).toBe("won");
      expect(won.state.submitted).toBe(true);
      expect(
        parseBlackboxRound(
          JSON.stringify({ version: 1, id: l.id, ...won.state }),
          l,
        ),
      ).toEqual(won.state);
      expect(undoBlackbox(won.state)).toBe(won.state);
      expect(markBlackbox(won.state, 0, -1)).toBe(won.state);
      expect(fireBlackbox(l, won.state, 0)).toBe(won.state);
    });
  it("rejects forged history and impossible observations", () => {
    const l = blackboxLevels[0],
      s = createBlackboxState(l);
    for (const value of [
      { ...s, history: [{ cell: 4, before: 1, after: 0 }] },
      { ...s, probes: [{ port: 0, result: -1 }] },
      { ...s, submitted: true },
    ])
      expect(
        parseBlackboxRound(
          JSON.stringify({ version: 1, id: l.id, ...value }),
          l,
        ),
      ).toEqual(s);
  });
  it("reports storage denial without blocking play", () => {
    const old = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        setItem() {
          throw Error("quota");
        },
      },
    });
    expect(
      saveBlackboxRound(
        0,
        blackboxLevels[0],
        createBlackboxState(blackboxLevels[0]),
      ),
    ).toBe(false);
    if (old) Object.defineProperty(globalThis, "localStorage", old);
    else Reflect.deleteProperty(globalThis, "localStorage");
    expect(BLACKBOX_RESUME_KEY).toBe("playgarden.blackbox.v1");
  });
});
