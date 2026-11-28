// SPDX-License-Identifier: GPL-3.0-only
export type WordBoard = {
  id: string;
  title: string;
  start: string;
  end: string;
  words: readonly string[];
  stamps: readonly string[];
};

export const wordChainSave = "playgarden.word-chain.v1";
export const tailOf = (board: WordBoard, trail: readonly string[]) =>
  trail.at(-1)?.[1] ?? board.start;
export const nextStamp = (board: WordBoard, trail: readonly string[]) =>
  board.stamps.find(word => !trail.includes(word));
export const solved = (board: WordBoard, trail: readonly string[]) =>
  trail.length === board.words.length && tailOf(board, trail) === board.end;

export function placement(board: WordBoard, trail: readonly string[], word: string) {
  if (!board.words.includes(word)) return "unknown";
  if (trail.includes(word)) return "used";
  if (word[0] !== tailOf(board, trail)) return "head";
  if (board.stamps.includes(word) && word !== nextStamp(board, trail)) return "stamp";
  return "ok";
}

export function restoreWords(board: WordBoard, raw: string | null) {
  const trail: string[] = [];
  if (!raw) return trail;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || !("id" in data) || data.id !== board.id ||
        !("words" in data) || !Array.isArray(data.words) || data.words.length > board.words.length) return [];
    for (const word of data.words) {
      if (typeof word !== "string" || placement(board, trail, word) !== "ok") return [];
      trail.push(word);
    }
    return trail;
  } catch { return []; }
}

export function wordHint(board: WordBoard, trail: readonly string[]): string | null {
  // At most 16 cards. The bitmask records used cards and thus the next stamp;
  // the last character is the only other part of the route that affects its future.
  const full = (1 << board.words.length) - 1;
  const ids = new Map(board.words.map((word, i) => [word, i]));
  const stampBits = board.stamps.map(word => 1 << ids.get(word)!);
  const stampMask = stampBits.reduce((a, b) => a | b, 0);
  const mask = trail.reduce((bits, word) => bits | (1 << ids.get(word)!), 0);
  const exhausted = new Set<string>();
  function route(used: number, tail: string): boolean {
    if (used === full) return tail === board.end;
    const key = used + ":" + tail;
    if (exhausted.has(key)) return false;
    const required = stampBits.find(bit => (used & bit) === 0);
    if (board.words.some((word, i) => {
      const bit = 1 << i;
      return !(used & bit) && word[0] === tail &&
        (!(stampMask & bit) || bit === required) && route(used | bit, word[1]);
    })) return true;
    exhausted.add(key);
    return false;
  }
  return board.words.find((word, i) =>
    placement(board, trail, word) === "ok" && route(mask | (1 << i), word[1])) ?? null;
}
