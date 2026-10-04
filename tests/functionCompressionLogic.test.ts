// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import {
  createFactoryState,
  editFactory,
  factoryHintFromSearch,
  initialFactoryProgram,
  interpretFactory,
  searchFactory,
  searchFactoryAsync,
  undoFactory,
  validFactoryLevel,
  verifyFactory,
  type FactoryLevel,
  type FactoryProgram,
  type PenCommand,
  type FunctionCall,
} from "../src/games/functionFactoryLogic";
import { functionFactoryLevels } from "../src/games/functionFactoryLevels";
import {
  appendPostPacket,
  compressionHint,
  compressionWon,
  createCompressionState,
  decodePostPackets,
  planPostSuffix,
  postOptions,
  postTotalCost,
  undoPostPacket,
  validCompressionLevel,
  type CompressionLevel,
  type PostPacket,
} from "../src/games/compressionPostLogic";
import { compressionPostLevels } from "../src/games/compressionPostLevels";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function programOf(level: FactoryLevel): FactoryProgram {
  return {
    A: [...level.certificate.A] as PenCommand[],
    B: [...level.certificate.B] as PenCommand[],
    main: [...level.certificate.main] as FunctionCall[],
  };
}
// Independent coordinate interpreter: unit-vector rotation, no production execution helpers.
function turtleOracle(p: FactoryProgram) {
  let x = 0,
    y = 0,
    dx = 1,
    dy = 0;
  const points: string[] = ["0,0"];
  let directions = "";
  for (const name of p.main) {
    if (!name) return null;
    for (const op of p[name]) {
      if (op === "F") {
        x += dx;
        y += dy;
        points.push(`${x},${y}`);
        directions += dx === 1 ? "E" : dx === -1 ? "W" : dy === 1 ? "S" : "N";
      } else if (op === "L") [dx, dy] = [dy, -dx];
      else if (op === "R") [dx, dy] = [-dy, dx];
      else return null;
    }
  }
  return {
    directions,
    points,
    heading: dx === 1 ? "E" : dx === -1 ? "W" : dy === 1 ? "S" : "N",
  };
}
function goalOracle(level: FactoryLevel, p: FactoryProgram) {
  const result = turtleOracle(p);
  return (
    !!result &&
    result.directions === level.target &&
    result.heading === level.finalHeading &&
    p.main.filter((v) => v === "A").length >= 2 &&
    (!p.B.length ||
      (p.main.filter((v) => v === "B").length >= 2 &&
        p.A.join("") !== p.B.join("")))
  );
}
function smallFactoryOracle(level: FactoryLevel, p: FactoryProgram): boolean {
  for (const section of ["main", "B", "A"] as const) {
    const index = p[section].indexOf(null);
    if (index < 0) continue;
    return (
      section === "main" ? (p.B.length ? ["B", "A"] : ["A"]) : ["R", "F", "L"]
    ).some((v) => {
      const next = { A: [...p.A], B: [...p.B], main: [...p.main] };
      (next[section] as string[])[index] = v;
      return smallFactoryOracle(level, next);
    });
  }
  return goalOracle(level, p);
}
// Independent cost graph and decoder, never using production packet options/DP/cost functions.
function packetOracle(
  level: CompressionLevel,
  packet: PostPacket,
): { text: string; cost: number } {
  if (packet.kind === "literal") {
    if (!/^[A-F]+$/.test(packet.text) || packet.text.length > level.maxLiteral)
      throw Error("literal");
    return { text: packet.text, cost: 1 + packet.text.length };
  }
  if (packet.kind === "run") {
    if (
      !level.runs ||
      !/^[A-F]$/.test(packet.symbol) ||
      !Number.isInteger(packet.count) ||
      packet.count < 2 ||
      packet.count > level.maxRun
    )
      throw Error("run");
    return { text: Array(packet.count).fill(packet.symbol).join(""), cost: 3 };
  }
  if (!Number.isInteger(packet.index) || !level.dictionary[packet.index])
    throw Error("dict");
  return { text: level.dictionary[packet.index], cost: 2 };
}
function suffixOracle(level: CompressionLevel, start = 0): number {
  const distance = new Array(level.message.length + 1).fill(Infinity);
  distance[start] = 0;
  for (let position = start; position < level.message.length; position++) {
    const edges: [number, number][] = [];
    for (
      let end = position + 1;
      end <= level.message.length && end - position <= level.maxLiteral;
      end++
    )
      edges.push([end, 1 + end - position]);
    if (level.runs)
      for (
        let end = position + 2;
        end <= level.message.length && end - position <= level.maxRun;
        end++
      ) {
        const chars = [...level.message.slice(position, end)];
        if (chars.every((c) => c === chars[0])) edges.push([end, 3]);
      }
    for (const phrase of level.dictionary)
      if (level.message.slice(position, position + phrase.length) === phrase)
        edges.push([position + phrase.length, 2]);
    for (const [end, cost] of edges)
      distance[end] = Math.min(distance[end], distance[position] + cost);
  }
  return distance.at(-1)!;
}
function poison<T extends { certificate: unknown }>(level: T): T {
  const copy = { ...level };
  Object.defineProperty(copy, "certificate", {
    get() {
      throw Error("Certificate read forbidden");
    },
  });
  return copy;
}

describe("Function Factory original bounded synthesis", () => {
  it("has 12 unique public traces and valid staged certificates checked by an independent coordinate interpreter", () => {
    expect(functionFactoryLevels).toHaveLength(12);
    expect(new Set(functionFactoryLevels.map((l) => l.target))).toHaveLength(
      12,
    );
    functionFactoryLevels.forEach((level) => {
      expect(validFactoryLevel(level)).toBe(true);
      const p = programOf(level);
      expect(goalOracle(level, p)).toBe(true);
      expect(verifyFactory(level, p)).toBe(true);
      expect(interpretFactory(level, p).trace).toBe(
        turtleOracle(p)!.directions,
      );
    });
  });
  it.each(functionFactoryLevels.map((l, i) => [i, l] as const))(
    "finds public-goal completion for level %i without reading certificates",
    (_, level) => {
      const publicLevel = poison(level),
        result = searchFactory(publicLevel, initialFactoryProgram(publicLevel));
      expect(result.status).toBe("solved");
      expect(result.checked).toBeLessThanOrEqual(419904);
      expect(goalOracle(publicLevel, result.program!)).toBe(true);
    },
  );
  it("uses semantic goals, including swapped function names and equivalent half-turns", () => {
    const level = functionFactoryLevels[4],
      p = programOf(level),
      swapped: FactoryProgram = {
        A: p.B,
        B: p.A,
        main: p.main.map((c) => (c === "A" ? "B" : "A")),
      };
    expect(verifyFactory(poison(level), swapped)).toBe(true);
    const turnLevel = functionFactoryLevels[9],
      equivalent = programOf(turnLevel);
    equivalent.A = [..."FLLF"] as PenCommand[];
    expect(verifyFactory(turnLevel, equivalent)).toBe(true);
  });
  it("rejects same-endpoint wrong stroke order and incorrect final orientation", () => {
    const level = functionFactoryLevels[1],
      wrong = programOf(level);
    wrong.A = ["F", "R"];
    expect(turtleOracle(wrong)!.points.at(-1)).toBe("0,0");
    expect(verifyFactory(level, wrong)).toBe(false);
    expect(
      verifyFactory({ ...level, finalHeading: "N" }, programOf(level)),
    ).toBe(false);
    expect(verifyFactory({ ...level, target: "EEEE" }, programOf(level))).toBe(
      false,
    );
  });
  it("agrees with a separate small exhaustive oracle on 27 actual partial states", () => {
    const level = functionFactoryLevels[4];
    for (const a of [null, "F", "L"] as const)
      for (const b of [null, "R", "L"] as const)
        for (const call of [null, "A", "B"] as const) {
          const p = programOf(level);
          p.A[0] = a;
          p.B[1] = b;
          p.main[0] = call;
          p.main[3] = null;
          expect(searchFactory(level, p).status === "solved").toBe(
            smallFactoryOracle(level, p),
          );
        }
  });
  it("hints preserve every filled slot, recommend undo for dead ends, and report caps honestly", () => {
    const level = functionFactoryLevels[4],
      p = programOf(level);
    p.A[0] = null;
    const result = searchFactory(level, p),
      hint = factoryHintFromSearch(p, result);
    expect(hint.slot).toEqual({ section: "A", index: 0 });
    expect(hint.value).toBe("F");
    expect(result.program!.main).toEqual(p.main);
    const dead = programOf(level);
    dead.A = ["L", "L"];
    expect(
      factoryHintFromSearch(dead, searchFactory(level, dead)).text,
    ).toContain("撤销");
    const capped = searchFactory(
      functionFactoryLevels[11],
      initialFactoryProgram(functionFactoryLevels[11]),
      1,
    );
    expect(capped).toEqual({ status: "limit", program: null, checked: 1 });
    expect(factoryHintFromSearch(p, capped).text).toContain("尚不能判断");
  });
  it("cancels asynchronous exhaustive search before and between bounded chunks", async () => {
    const controller = new AbortController();
    controller.abort();
    const level = functionFactoryLevels[11],
      current = initialFactoryProgram(level);
    expect(
      (await searchFactoryAsync(level, current, { signal: controller.signal }))
        .status,
    ).toBe("cancelled");
    const later = new AbortController();
    let yields = 0;
    const result = await searchFactoryAsync(level, current, {
      signal: later.signal,
      onProgress: (n) => {
        expect(n).toBe(128);
        later.abort();
      },
      yieldTask: async () => {
        yields++;
      },
    });
    expect(result).toEqual({
      status: "cancelled",
      program: null,
      checked: 128,
    });
    expect(yields).toBe(1);
  });
  it("keeps editor history immutable and rejects invalid/corrupted levels and programs", () => {
    const level = functionFactoryLevels[0],
      initial = freeze(createFactoryState(level));
    const one = editFactory(level, initial, { section: "A", index: 0 }, "F"),
      two = editFactory(level, freeze(one), { section: "A", index: 1 }, "R");
    expect(initial.program.A).toEqual([null, null]);
    expect(undoFactory(freeze(two)).program).toEqual(one.program);
    expect(
      editFactory(level, initial, { section: "main", index: 0 }, "B"),
    ).toBe(initial);
    expect(searchFactory({ ...level, calls: 7 }, initial.program).status).toBe(
      "invalid",
    );
    expect(
      verifyFactory(level, { ...programOf(level), main: ["A", null, "A"] }),
    ).toBe(false);
  });
});

describe("Compression Post original lossless segmentation", () => {
  it("has 12 distinct messages whose certificates independently decode at the exact optimum", () => {
    expect(compressionPostLevels).toHaveLength(12);
    expect(new Set(compressionPostLevels.map((l) => l.message))).toHaveLength(
      12,
    );
    compressionPostLevels.forEach((level) => {
      expect(validCompressionLevel(level)).toBe(true);
      const decoded = level.certificate.map((p) => packetOracle(level, p));
      expect(decoded.map((v) => v.text).join("")).toBe(level.message);
      expect(decoded.reduce((sum, v) => sum + v.cost, 0)).toBe(level.budget);
      expect(suffixOracle(level)).toBe(level.budget);
    });
  });
  it.each(compressionPostLevels.map((l, i) => [i, l] as const))(
    "matches independent cost graph for every suffix of level %i with poisoned certificates",
    (_, level) => {
      const publicLevel = poison(level);
      for (let cursor = 0; cursor <= level.message.length; cursor++) {
        const plan = planPostSuffix(publicLevel, cursor);
        expect(plan.cost).toBe(suffixOracle(publicLevel, cursor));
        const parts = plan.packets.map((packet) =>
          packetOracle(publicLevel, packet),
        );
        expect(parts.map((p) => p.text).join("")).toBe(
          level.message.slice(cursor),
        );
        expect(parts.reduce((sum, p) => sum + p.cost, 0)).toBe(plan.cost);
      }
      expect(
        compressionWon(publicLevel, planPostSuffix(publicLevel, 0).packets),
      ).toBe(true);
    },
  );
  it("accepts alternative optimal packet boundaries and rejects corruption, wrong messages, and over-budget complete data", () => {
    const level = compressionPostLevels[5],
      alternative: PostPacket[] = [
        { kind: "literal", text: "AABB" },
        { kind: "literal", text: "AABB" },
      ];
    expect(compressionWon(poison(level), alternative)).toBe(true);
    expect(
      compressionWon(level, [
        { kind: "literal", text: "ABAB" },
        { kind: "literal", text: "ABAB" },
      ]),
    ).toBe(false);
    expect(
      decodePostPackets(level, [{ kind: "run", symbol: "A", count: 100 }]),
    ).toBeNull();
    expect(decodePostPackets(level, [{ kind: "dict", index: 0 }])).toBeNull();
    const expensive = [...level.message].map(
      (text) => ({ kind: "literal", text }) as PostPacket,
    );
    expect(decodePostPackets(level, expensive)).toBe(level.message);
    expect(compressionWon(level, expensive)).toBe(false);
  });
  it("hints use the real prefix budget, preserve good prefixes and tell players to undo a longest-run trap", () => {
    const level = compressionPostLevels[11],
      greedy: PostPacket[] = [{ kind: "run", symbol: "A", count: 6 }],
      hint = compressionHint(poison(level), greedy);
    expect(hint.undo).toBe(true);
    expect(hint.packet).toBeNull();
    expect(hint.minimumTotal).toBeGreaterThan(level.budget);
    expect(hint.text).toContain("撤销");
    const prefix = [level.certificate[0]],
      next = compressionHint(poison(level), prefix);
    expect(next.undo).toBe(false);
    expect(next.packet).toEqual({ kind: "dict", index: 0 });
    expect(next.minimumTotal).toBe(level.budget);
    expect(compressionHint(level, [{ kind: "literal", text: "B" }]).undo).toBe(
      true,
    );
  });
  it("checks every first-packet choice against the independent suffix bound on all 12 levels", () => {
    for (const level of compressionPostLevels)
      for (const packet of postOptions(level, 0)) {
        const decoded = packetOracle(level, packet),
          total = decoded.cost + suffixOracle(level, decoded.text.length),
          hint = compressionHint(level, [packet]);
        expect(hint.minimumTotal).toBe(total);
        expect(hint.undo).toBe(total > level.budget);
      }
  });
  it("keeps append and undo history immutable and refuses wrong-prefix packets", () => {
    const level = compressionPostLevels[3],
      initial = freeze(createCompressionState()),
      first = appendPostPacket(level, initial, {
        kind: "run",
        symbol: "A",
        count: 5,
      });
    const second = appendPostPacket(level, freeze(first), {
      kind: "literal",
      text: "BC",
    });
    expect(initial.packets).toEqual([]);
    expect(first.packets).toHaveLength(1);
    expect(undoPostPacket(freeze(second)).packets).toEqual(first.packets);
    expect(postTotalCost(second.packets)).toBe(6);
    expect(
      appendPostPacket(level, initial, { kind: "literal", text: "B" }),
    ).toBe(initial);
    expect(planPostSuffix(level, -1).status).toBe("invalid");
  });
});
