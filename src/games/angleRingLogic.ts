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
  ["120CA 60CC 90AB 30BC","300AA","3-4-2-1"], // 13
  ["90AB 30BB 45CA 90AA 30CC","285CB","5-3-4-1-2"], // 14
  ["105CC 105AC 75CB 60BA","345AA","2-1-3-4"], // 15
  ["60AC 45CC 45AB 120CA","270AB","1-2-4-3"], // 16
  ["45AA 60BC 60BA 60CB","225BA","2-4-3-1"], // 17
  ["45CB 105AA 30BA 75BC","255BA","4-1-3-2"], // 18
  ["60CB 90AA 45BA 75CC","270CA","4-1-3-2"], // 19
  ["30BA 60AC 90CC 45CA","225BA","1-2-3-4"], // 20
  ["30BB 60BA 45AC 90CB 90CC","315AA","3-5-4-1-2"], // 21
  ["105AC 75CC 30BB 90CB","300AB","1-2-4-3"], // 22
  ["45CB 90AC 75AA 60BA","270BB","4-3-2-1"], // 23
  ["30CA 120BB 120AC 90BC","360BC","2-4-1-3"], // 24
  ["45CB 105AC 60BA 105AA","315CC","1-3-4-2"], // 25
  ["30CC 90BA 30BB 105CB","255CA","1-4-3-2"], // 26
  ["75CB 60AC 75AC 90CC 60CA","360AB@210A","2-4-5-3-1"], // 27
  ["90CA 90BB 75BC 30AB","285BB@195B","3-1-4-2"], // 28
  ["60CB 30BB 60BC 45BC 120CB","315CC@105C","1-4-5-2-3"], // 29
  ["45BB 105AC 30BA 75CB","255BB@45B","1-3-2-4"], // 30
  ["75AC 60BB 30BA 120CB","285BB@225B","3-1-4-2"], // 31
  ["90AA 30AC 105CA 75CC","300CC@270A","4-3-1-2"], // 32
  ["45BC 45AB 60BC 30AA 90CB","270AC@225B","4-2-3-5-1"], // 33
  ["90AB 30CA 60BA 30AB","210CB@120B","2-1-3-4"], // 34
  ["60AA 105AC 30CC 105CA","300CC@105A","4-1-2-3"], // 35
  ["60AC 45CB 120BC 120CA","345CC@45B","2-3-4-1"], // 36
  ["30BA 105AB 105BA 60BB","300BA@30A","1-2-4-3"], // 37
  ["105BB 75AB 90BC 60BA","330BC@135B","4-2-1-3"], // 38
  ["120CB 105CC 60BB 30BC","315CC@120B","1-3-4-2"], // 39
  ["45BB 75CA 30BC 75AA 75AB","300AA@150C","5-1-3-2-4"], // 40
  ["90BA 105CA 75AC 60CB","330CA@240B","2-3-4-1"], // 41
  ["120AA 60CC 75CA 105CC","360CA@105C","4-2-3-1"], // 42
  ["75BA 120CA 45CC 90AB 45CB 120AC 30AC","330AB@240A / 195BB","6-2-4 / 1-7-3-5"], // 43
  ["30BB 75CA 45CB 45CC 75AC 90CC 45AC","165AA@45C / 240AB","7-4-2 / 5-6-3-1"], // 44
  ["120AB 45BA 75AA 90CB 120AC 45CA","255CB / 240CC","4-2-1 / 6-3-5"], // 45
  ["105BB 45AA 75AB 120CB 60BC 45BB","225BB@180B / 225AB","5-4-6 / 2-3-1"], // 46
  ["60BC 30CB 45AC 75CC 75AA 90CC","165CC@105B / 210AC","4-2-1 / 5-3-6"], // 47
  ["45BB 45AA 120AA 75AC 105CA 60AB","225CC / 225AB","5-2-4 / 3-6-1"], // 48
  ["105AC 30BC 45AC 120AA 120BA 45CB 120CB","270BB / 315AC","5-1-6 / 4-3-7-2"], // 49
  ["30CA 120AA 30AB 75CC 45BC 45CA 30CC","150CA@30C / 225BB","7-4-6 / 5-1-2-3"], // 50
  ["60BB 90CA 60CC 105BC 60BC 75CC","195BC@60B / 255BA","1-5-6 / 4-3-2"], // 51
  ["105CA 45CC 60AB 45AA 75AC 30BA","150BC@105C / 210CB","6-5-2 / 1-4-3"], // 52
  ["75AB 75CA 90CB 60CC 45BC 120BB","270CB@75A / 195BB","2-1-6 / 5-4-3"], // 53
  ["60AC 60BA 120AC 75CA 60BB 120BC","180BC@120A / 315BC","5-2-1 / 6-4-3"], // 54
  ["60CA 30BC 105AC 90AA 60BA 30CB 60AC","150BB@60A / 285BC","5-7-6 / 2-1-4-3"], // 55
  ["75AA 90AB 75CC 60BC 90CA 45BC","210AC@90B / 225BA","2-6-3 / 4-5-1"], // 56
  ["45CC 30BC 105AB 60AB 90AA 60BB 105CA","210AB / 285BB","5-4-6 / 2-1-7-3"], // 57
  ["60CC 90BA 45CB 105BB 105BC 75AB","210CB@135A / 270BC","3-2-6 / 4-5-1"], // 58
  ["30AB 45AA 30CB 60BC 45CC 45BC 90AB","120AC@75C / 225AB","1-6-5 / 2-7-4-3"], // 59
  ["105CB 60CC 75BA 75AA 60BA 30AB 75AB","165BB / 315CB","5-4-6 / 2-1-3-7"], // 60
  ["45CC 45AB 60AA 75BC 75BB 120AA 105BA 30CA","285BB@165A / 270BA@150A","7-3-2-5 / 4-1-8-6"], // 61
  ["45AB 120BA 30BC 75BB 90CB 120AC 30AC 30BA","270BC@120A / 270AC@30C","2-1-4-3 / 7-5-8-6"], // 62
  ["120CB 30BB 120BA 75AC 45CA 120AC 120AB 90BA","360AA@270B / 360AA@315C","6-1-2-8 / 7-3-4-5"], // 63
  ["45CB 75BC 30CB 45BA 75AB 75BA 45BB 30AC","225BA@45B / 195AB@30C","7-2-3-6 / 8-1-4-5"], // 64
  ["90CA 45AA 45AC 120BC 105AA 75BA 30CA 30AB","285AA@105A / 255BA@120A","5-8-4-7 / 6-2-3-1"], // 65
  ["75CA 60CA 90AC 45AC 30BC 75AC 30CA 90CC","225BC@90A / 270CC@75A","5-2-4-8 / 1-3-7-6"], // 66
  ["105BC 30AB 30CB 90AC 90BA 120CA 120BC 30CA","270CC@150C / 345BA@105C","3-7-8-4 / 1-6-2-5"], // 67
  ["120BA 90CC 105AC 45CB 90BC 45AC 30BB 30CB","255AC@75B / 300CC@45B","6-8-5-2 / 4-7-1-3"], // 68
  ["45CC 75BA 90BC 75AC 45CB 30BB 45CA 60AC","210CC@45C / 255BC@180A","1-5-6-3 / 2-8-7-4"], // 69
  ["75AC 45BA 30BB 90CA 45AB 60AB 30BC 30CA","255CB@165C / 150BC@90B","4-1-8-6 / 2-5-3-7"], // 70
  ["45CC 60CC 30BC 105CA 120AB 75AB 45CB 45BA","270CA@45C / 255AB@150C","1-4-6-8 / 5-3-2-7"], // 71
  ["30CA 60BC 75BB 105BC 90CC 60CB 30AB 105BB","300BB@195B / 255AA@225C","2-6-3-8 / 7-4-5-1"], // 72
  ["120BA 90AA 30AB 60CC 75BA 45CB 90CA 90CC","270CA@60C / 330CA@120B","4-8-6-5 / 7-3-1-2"], // 73
  ["45CA 75CB 60BC 75BC 30CB 75AB 75CC 105BC","285BB@180B / 255BB@180A","8-2-4-5 / 3-7-1-6"], // 74
  ["60CA 45AC 45BC 75AB 105AC 120CA 60AA 75AA","315AB@120C / 270BC@105A","8-2-6-4 / 3-1-7-5"], // 75
  ["105BA 30AA 45AC 105CB 45CA 105AC 45BC 105AB","285AC@240B / 300AA@255C","2-6-4-7 / 8-1-3-5"], // 76
  ["60CA 90AC 45BA 60BC 120CB 60AA 30BB 60AB","210AA@60B / 315CC@225A","8-7-4-1 / 5-3-6-2"], // 77
  ["120BB 75AB 105BC 30CB 90AC 30AA 120CC 45CA","285CB@255C / 330AC@225B","7-8-5-4 / 6-2-1-3"], // 78
  ["120BB 75BC 105BB 45CA 60CB 105AC 105BC 60BB 30CC","180AA@105C / 255BC@60B / 270CC@60B","6-9-4 / 8-1-2 / 5-3-7"], // 79
  ["60BA 45BB 105BC 120BB 105AC 45AA 60AB 90AB 30CC","255AB@45A / 210BC@105A / 195AC@60B","6-8-4 / 2-1-5 / 7-3-9"], // 80
  ["120AB 45CB 120CB 90CC 60CC 75BC 45BC 60BA 45BB","225BB@180B / 225BB@45C / 210CC@120C","8-1-9 / 7-5-3 / 2-6-4"], // 81
  ["30CB 90CC 90BB 45CB 60AA 105AC 60BC 45AC 30CC","120CC@60B / 180AB@45C / 255AC@60A","9-1-7 / 8-4-3 / 5-6-2"], // 82
  ["105AC 120CC 90CA 90BA 120AB 60AC 105BC 120AA 105CB","255AC@105C / 345AC@225C / 315CA@105B","1-3-6 / 5-7-2 / 9-4-8"], // 83
  ["75AA 75BB 105AA 60AC 30BB 45BA 75CA 30BA 60AB","240CB@75A / 135BA@30B / 180BC@45A","7-3-9 / 5-2-8 / 6-1-4"], // 84
  ["30CA 75AC 120AA 75AB 105CA 60CB 105AA 45AC 60CC","210AB@150C / 300CB@225A / 165CC@30A","7-8-6 / 5-3-4 / 1-2-9"], // 85
  ["75CB 105CC 120BB 45CB 90BA 105BB 75CC 90BC 75AB","255CC@165B / 255CB@75C / 270BB@195A","4-3-8 / 7-2-1 / 6-5-9"], // 86
  ["30BC 105CB 75AC 60AB 90CA 75BC 90BB 120BC 45CA","210BA@165C / 210AC@75C / 270CC@90A","7-6-9 / 3-2-1 / 5-4-8"], // 87
  ["90BA 30BA 75AC 60AC 120AB 105AB 120CC 75CB 90CB","315AB@210A / 180AA@75C / 270AB@60C","5-1-6 / 3-8-2 / 4-7-9"], // 88
  ["30CB 30BB 45AB 45BA 75BC 120BB 75AC 75BA 30BA","180BC@30B / 150BA@105B / 195BB@120B","2-8-7 / 5-1-4 / 6-9-3"], // 89
  ["75AC 30CC 60CC 45CC 120AB 30CA 105AA 105BA 60AC","150AC@105C / 330AA@105A / 150CC@90A","1-2-4 / 7-5-8 / 3-6-9"], // 90
  ["60CB 120BC 30CB 45AC 75BC 30CA 75AA 30AB 105BA","150AC@45C / 180AA@150C / 240CA@60B","4-3-5 / 8-2-6 / 1-9-7"], // 91
  ["105AC 105BA 120BA 30AA 90CA 75AB 120AA 45CA 105AB","240CA@150C / 240BB@105A / 315AA@120A","8-1-5 / 2-4-9 / 7-6-3"], // 92
  ["90AB 45AA 75CA 120AC 105BC 30CA 120CC 90AA 120AA","285AC@120A / 270CC@75A / 240CA@150A","9-2-4 / 3-1-5 / 7-6-8"], // 93
  ["90BC 60CB 60BC 45CA 120CA 60AB 75BC 75CA 90AB","195BB@135A / 195CA@150C / 285BB@195A","3-8-6 / 2-1-4 / 7-5-9"], // 94
  ["90CA 120BB 105BB 75CC 90AC 45BB 90AA 105AB 60AB","210AB@165B / 255CC@90A / 315AB@90A","9-3-6 / 1-5-4 / 7-8-2"], // 95
  ["30AC 105AB 45BC 105AA 105CA 30BC 60AC 75BA 30CB","210BC@75A / 165AB@105B / 210BC@150A","8-4-1 / 2-6-9 / 3-5-7"], // 96
  ["30AA 75BA 90CA 30CA 45AC 60AA 45AB 60AC 90CB","225BB@135C / 165CB@120A / 135AA@75A","2-8-9 / 3-1-7 / 5-4-6"], // 97
  ["60BC 90CC 60AB 75BB 60BB 60CB 120BA 45AB 30CC","225CB@150B / 150AC@60B / 225BB@120A","2-6-4 / 3-1-9 / 7-8-5"], // 98
  ["45AB 45BA 60CA 75BA 60AC 45CA 30CB 90BA 75AB","180BB@90A / 180CA@105B / 165CA@45A","8-5-7 / 3-1-4 / 6-9-2"], // 99
  ["60CB 45CB 30BA 45BB 30AC 90AA 90AB 30BB 90BB","210BB@90B / 120CB@75B / 180AB@120C","9-3-7 / 2-8-4 / 6-5-1"], // 100
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
