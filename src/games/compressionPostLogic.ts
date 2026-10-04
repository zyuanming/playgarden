// SPDX-License-Identifier: MIT
/** Original offline lossless packet puzzles. Token units are fictional, not byte sizes of a real protocol. */
export type PostPacket =
  | { kind: "literal"; text: string }
  | { kind: "run"; symbol: string; count: number }
  | { kind: "dict"; index: number };
export type CompressionLevel = {
  title: string;
  lesson: string;
  message: string;
  dictionary: readonly string[];
  runs: boolean;
  maxLiteral: number;
  maxRun: number;
  budget: number;
  certificate: readonly PostPacket[];
};
export type CompressionState = {
  packets: PostPacket[];
  history: PostPacket[][];
};
export type CompressionPlan = {
  status: "solved" | "invalid";
  cost: number;
  packets: PostPacket[];
};
export type CompressionHint = {
  text: string;
  packet: PostPacket | null;
  undo: boolean;
  minimumTotal: number | null;
};
export const POST_COSTS = { literalHeader: 1, run: 3, dictionary: 2 } as const;
const clonePackets = (packets: readonly PostPacket[]): PostPacket[] =>
  packets.map((packet) => ({ ...packet }));
export function validCompressionLevel(level: CompressionLevel): boolean {
  return (
    /^[A-F]{1,36}$/.test(level.message) &&
    level.dictionary.length <= 4 &&
    level.dictionary.every((s) => /^[A-F]{2,8}$/.test(s)) &&
    new Set(level.dictionary).size === level.dictionary.length &&
    typeof level.runs === "boolean" &&
    Number.isInteger(level.maxLiteral) &&
    level.maxLiteral >= 1 &&
    level.maxLiteral <= 6 &&
    Number.isInteger(level.maxRun) &&
    level.maxRun >= 2 &&
    level.maxRun <= 9 &&
    Number.isInteger(level.budget) &&
    level.budget > 0 &&
    level.budget <= 72
  );
}
/** A decoder receives actual serialized packet contents, not a start/end annotation or solution ID. */
export function decodePostPacket(
  level: CompressionLevel,
  packet: PostPacket,
): string | null {
  if (packet.kind === "literal")
    return typeof packet.text === "string" &&
      /^[A-F]+$/.test(packet.text) &&
      packet.text.length <= level.maxLiteral
      ? packet.text
      : null;
  if (packet.kind === "run")
    return level.runs &&
      /^[A-F]$/.test(packet.symbol) &&
      Number.isInteger(packet.count) &&
      packet.count >= 2 &&
      packet.count <= level.maxRun
      ? packet.symbol.repeat(packet.count)
      : null;
  if (packet.kind === "dict")
    return Number.isInteger(packet.index) &&
      packet.index >= 0 &&
      packet.index < level.dictionary.length
      ? level.dictionary[packet.index]
      : null;
  return null;
}
export function decodePostPackets(
  level: CompressionLevel,
  packets: readonly PostPacket[],
): string | null {
  if (!validCompressionLevel(level) || packets.length > level.message.length)
    return null;
  let decoded = "";
  for (const packet of packets) {
    const text = decodePostPacket(level, packet);
    if (text === null) return null;
    decoded += text;
    if (decoded.length > level.message.length) return null;
  }
  return decoded;
}
export function postPacketCost(packet: PostPacket): number {
  return packet.kind === "literal"
    ? POST_COSTS.literalHeader + packet.text.length
    : packet.kind === "run"
      ? POST_COSTS.run
      : POST_COSTS.dictionary;
}
export function postTotalCost(packets: readonly PostPacket[]): number {
  return packets.reduce((sum, p) => sum + postPacketCost(p), 0);
}
export const createCompressionState = (): CompressionState => ({
  packets: [],
  history: [],
});
export function validCompressionState(
  level: CompressionLevel,
  packets: readonly PostPacket[],
): boolean {
  const text = decodePostPackets(level, packets);
  return text !== null && level.message.startsWith(text);
}
export function compressionWon(
  level: CompressionLevel,
  packets: readonly PostPacket[],
): boolean {
  return (
    decodePostPackets(level, packets) === level.message &&
    postTotalCost(packets) <= level.budget
  );
}
export function postOptions(
  level: CompressionLevel,
  cursor: number,
): PostPacket[] {
  if (
    !validCompressionLevel(level) ||
    !Number.isInteger(cursor) ||
    cursor < 0 ||
    cursor >= level.message.length
  )
    return [];
  const tail = level.message.slice(cursor),
    packets: PostPacket[] = [];
  for (
    let length = 1;
    length <= Math.min(level.maxLiteral, tail.length);
    length++
  )
    packets.push({ kind: "literal", text: tail.slice(0, length) });
  if (level.runs)
    for (
      let count = 2;
      count <= Math.min(level.maxRun, tail.length) &&
      tail.slice(0, count) === tail[0].repeat(count);
      count++
    )
      packets.push({ kind: "run", symbol: tail[0], count });
  level.dictionary.forEach((text, index) => {
    if (tail.startsWith(text)) packets.push({ kind: "dict", index });
  });
  return packets;
}
export const postPacketKey = (packet: PostPacket): string =>
  packet.kind === "literal"
    ? `literal:${packet.text.length}`
    : packet.kind === "run"
      ? `run:${packet.count}`
      : `dict:${packet.index}`;
export function appendPostPacket(
  level: CompressionLevel,
  state: CompressionState,
  packet: PostPacket,
): CompressionState {
  if (
    !validCompressionState(level, state.packets) ||
    compressionWon(level, state.packets)
  )
    return state;
  const next = [...clonePackets(state.packets), { ...packet }];
  return validCompressionState(level, next)
    ? {
        packets: next,
        history: [
          ...state.history.map(clonePackets),
          clonePackets(state.packets),
        ],
      }
    : state;
}
export function undoPostPacket(state: CompressionState): CompressionState {
  const packets = state.history.at(-1);
  return packets
    ? {
        packets: clonePackets(packets),
        history: state.history.slice(0, -1).map(clonePackets),
      }
    : state;
}
/** Exact suffix DP, at most 37 suffixes, with every legal packet boundary considered. */
export function planPostSuffix(
  level: CompressionLevel,
  cursor: number,
): CompressionPlan {
  if (
    !validCompressionLevel(level) ||
    !Number.isInteger(cursor) ||
    cursor < 0 ||
    cursor > level.message.length
  )
    return { status: "invalid", cost: Infinity, packets: [] };
  const best: { cost: number; packets: PostPacket[] }[] = Array(
    level.message.length + 1,
  );
  best[level.message.length] = { cost: 0, packets: [] };
  for (let i = level.message.length - 1; i >= cursor; i--) {
    let winner = { cost: Infinity, packets: [] as PostPacket[] };
    for (const packet of postOptions(level, i)) {
      const output = decodePostPacket(level, packet)!;
      const suffix = best[i + output.length],
        cost = postPacketCost(packet) + suffix.cost;
      if (
        cost < winner.cost ||
        (cost === winner.cost &&
          suffix.packets.length + 1 < winner.packets.length)
      )
        winner = {
          cost,
          packets: [{ ...packet }, ...clonePackets(suffix.packets)],
        };
    }
    best[i] = winner;
  }
  return {
    status: "solved",
    cost: best[cursor].cost,
    packets: clonePackets(best[cursor].packets),
  };
}
export function postPacketLabel(
  level: CompressionLevel,
  packet: PostPacket,
): string {
  return packet.kind === "literal"
    ? `原文 ${packet.text}（${packet.text.length} 符号）`
    : packet.kind === "run"
      ? `连写 ${packet.symbol} × ${packet.count}`
      : `词典 ${packet.index + 1}：${level.dictionary[packet.index]}`;
}
export function compressionHint(
  level: CompressionLevel,
  packets: readonly PostPacket[],
): CompressionHint {
  if (!validCompressionState(level, packets))
    return {
      text: "包内容不能无损还原目标前缀，请撤销或重置。",
      packet: null,
      undo: true,
      minimumTotal: null,
    };
  const prefix = decodePostPackets(level, packets)!,
    suffix = planPostSuffix(level, prefix.length),
    total = postTotalCost(packets) + suffix.cost;
  if (total > level.budget)
    return {
      text: `保留当前包，即使后面最省也要 ${total} 单位，超过 ${level.budget} 的预算。请撤销最后一包，重新选择分界。`,
      packet: null,
      undo: true,
      minimumTotal: total,
    };
  const packet = suffix.packets[0] ?? null;
  return {
    text: packet
      ? `从第 ${prefix.length + 1} 个符号起，试试“${postPacketLabel(level, packet)}”。保留已选包，最低总成本为 ${total} 单位。`
      : "完整解码与公开消息相同，而且没有超预算。",
    packet,
    undo: false,
    minimumTotal: total,
  };
}
