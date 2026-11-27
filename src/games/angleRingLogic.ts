// SPDX-License-Identifier: GPL-3.0-only
type Mark = "A" | "B" | "C";
type Wedge = { span: number; from: Mark; to: Mark };
type Frame = Wedge & { pin?: { at: number; mark: Mark } };
export type Layout = readonly (readonly number[])[];
export type AngleLevel = {
  id: string;
  pieces: Wedge[];
  frames: Frame[];
  solution: Layout;
};
const data = [
  ["60AB 30BC 90CA", "180AA", "1-2-3"],
  ["30AC 75BA 90CA 30AB", "225AA@105A", "4-2-1-3"],
  ["120AB 45AA 45BA 30BB", "240AA@165B", "2-1-4-3"],
  ["120BA 60AB 30CA 75AB", "285CB@90B", "3-2-1-4"],
  ["75BC 75CC 30BA 30CA 120AB 90CB", "225CC / 195CA", "4-5-1 / 2-6-3"],
  ["75AB 30CB 120AA 75CA 60BA 120BC", "210CA / 270BB", "2-5-3 / 6-4-1"],
  ["120CB 90AC 60BB 75BA 60CC 60AA", "270AB / 195BA", "2-5-1 / 3-4-6"],
  [
    "30BB 60BA 60AC 75BC 60CA 45CB 90AC 90CB",
    "270BC@120C / 240CB@165C",
    "2-3-5-7 / 8-4-6-1",
  ],
  [
    "75CC 90BC 60AA 30BA 45AB 45CA 45BA 120AB",
    "330CC@165B / 180BA@105A",
    "6-8-2-1 / 7-3-5-4",
  ],
  [
    "45BA 120CC 120CA 120AB 75AB 120BC 45AC 60CC",
    "360AC@165A / 345AA@105C",
    "4-1-5-6 / 7-8-2-3",
  ],
  [
    "60BB 45BC 60AC 60AA 75CB 60AB 30CA 90BB 75AB",
    "225AB@165B / 180AC@135B / 150CB@90A",
    "9-8-1 / 3-5-2 / 7-4-6",
  ],
  [
    "30AA 60CA 60AB 90BA 120AB 60BB 90BB 120BC 120BB",
    "210BA@180A / 330AB@210B / 210BB@150A",
    "8-2-1 / 5-7-9 / 6-4-3",
  ],
] as const;
const parseFrame = (s: string): Frame => {
  const m = /^(\d+)([ABC])([ABC])(?:@(\d+)([ABC]))?$/.exec(s);
  if (!m) throw new Error("invalid angle fixture");
  return {
    span: Number(m[1]),
    from: m[2] as Mark,
    to: m[3] as Mark,
    ...(m[4] ? { pin: { at: Number(m[4]), mark: m[5] as Mark } } : {}),
  };
};
export const angleLevels: AngleLevel[] = data.map(
  ([pieces, frames, solution], i) => ({
    id: `angle-ring-${String(i + 1).padStart(3, "0")}`,
    pieces: pieces.split(" ").map(parseFrame),
    frames: frames.split(" / ").map(parseFrame),
    solution: solution
      .split(" / ")
      .map((line) => line.split("-").map((id) => Number(id) - 1)),
  }),
);

export const marks: Record<Mark, string> = { A: "●", B: "▲", C: "■" };
export const emptyLayout = (level: AngleLevel): Layout =>
  level.frames.map(() => []);
export function progress(
  frame: Frame,
  pieces: Wedge[],
  path: readonly number[],
) {
  let angle = 0,
    seam = frame.from;
  for (const id of path) {
    angle += pieces[id].span;
    seam = pieces[id].to;
  }
  return { angle, seam };
}
export const isUsed = (layout: Layout, piece: number) =>
  layout.some((path) => path.includes(piece));

export function won(level: AngleLevel, layout: Layout): boolean {
  return (
    layout.every(
      (path, i) =>
        progress(level.frames[i], level.pieces, path).angle ===
        level.frames[i].span,
    ) && new Set(layout.flat()).size === level.pieces.length
  );
}
export type Choice = { frame: number; piece: number };
export function place(
  level: AngleLevel,
  layout: Layout,
  { frame: index, piece: id }: Choice,
): { layout: Layout } | { reason: string } {
  const frame = level.frames[index],
    piece = level.pieces[id];
  if (!frame || !piece || isUsed(layout, id))
    return { reason: "这块扇片不可用。" } as const;
  const { angle, seam } = progress(frame, level.pieces, layout[index]);
  if (angle === frame.span)
    return { reason: "这个拼环已经拼满，请换一个。" } as const;
  const end = angle + piece.span;
  if (piece.from !== seam)
    return { reason: `接缝对不上，起端需要 ${marks[seam]}。` } as const;
  if (end > frame.span)
    return { reason: `超过目标 ${frame.span}°，换一块更小的。` } as const;
  if (
    frame.pin &&
    angle < frame.pin.at &&
    end >= frame.pin.at &&
    (end !== frame.pin.at || piece.to !== frame.pin.mark)
  )
    return {
      reason: `必须在 ${frame.pin.at}° 留下 ${marks[frame.pin.mark]} 接缝，不能跨过定位钉。`,
    } as const;
  if (end === frame.span && piece.to !== frame.to)
    return { reason: `结束接缝需要 ${marks[frame.to]}。` } as const;
  return {
    layout: layout.map((path, f) => (f === index ? [...path, id] : path)),
  } as const;
}

export function suggest(
  level: AngleLevel,
  layout: Layout,
  preferred: number,
): { kind: "step"; choice: Choice } | { kind: "dead" | "budget" } {
  // Fill one frame at a time. Placement order between frames cannot alter legality.
  const frames = [
    preferred,
    ...level.frames.map((_, i) => i).filter((i) => i !== preferred),
  ];
  const seen = new Set<string>();
  let nodes = 0;
  function visit(state: Layout): Choice[] | null {
    if (++nodes > 4000) return null;
    if (won(level, state)) return [];
    const frame = frames.find(
      (i) =>
        progress(level.frames[i], level.pieces, state[i]).angle <
        level.frames[i].span,
    );
    if (frame === undefined) return null;
    const key = `${frame};${state[frame].join(",")};${state
      .flat()
      .sort((a, b) => a - b)
      .join(",")}`;
    if (seen.has(key)) return null;
    seen.add(key);
    for (let piece = 0; piece < level.pieces.length && nodes <= 4000; piece++) {
      const choice = { frame, piece };
      const result = place(level, state, choice);
      if ("reason" in result) continue;
      const tail = visit(result.layout);
      if (tail) return [choice, ...tail];
    }
    return null;
  }
  const path = visit(layout);
  if (path?.[0]) return { kind: "step", choice: path[0] };
  return { kind: nodes > 4000 ? "budget" : "dead" };
}
