// SPDX-License-Identifier: GPL-3.0-only
// Original short phrases and bijective substitution puzzles; not quotations.
export const cipherAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export type CipherMap = Record<string, string>;
export type CipherLesson = {
  title: string;
  phrase: string;
  clue: string;
  shift: number;
  encrypted: string;
  keys: string[];
};
function letterLesson(
  title: string,
  phrase: string,
  clue: string,
  shift: number,
): CipherLesson {
  const encrypted = phrase.replace(
    /[A-Z]/g,
    (c) => cipherAlphabet[(cipherAlphabet.indexOf(c) * 5 + shift) % 26],
  );
  return {
    title,
    phrase,
    clue,
    shift,
    encrypted,
    keys: [...new Set(encrypted.replaceAll(" ", "").split(""))].sort(),
  };
}
export const cipherLettersLevels = [
  letterLesson(
    "阳光来信",
    "WARM SUN",
    "暖暖的太阳。两个词，描述温暖和天空中的光源。",
    3,
  ),
  letterLesson(
    "开门迎客",
    "OPEN THE GATE",
    "打开花园的大门。留意三字母的冠词。",
    7,
  ),
  letterLesson(
    "雨后彩虹",
    "LOOK FOR A RAINBOW",
    "寻找一道彩虹。同一个密文字母总是代表同一个真字母。",
    11,
  ),
  letterLesson(
    "安静观察",
    "WATCH THE LITTLE BIRD",
    "观察那只小鸟。LITTLE 里有连续重复的字母。",
    17,
  ),
  letterLesson(
    "一起种植",
    "PLANT A SEED TOGETHER",
    "一起种下一颗种子。单独一个字母的单词通常是 A 或 I。",
    19,
  ),
  letterLesson(
    "循着绿意",
    "FIND THE GREEN PATH",
    "找到那条绿色小径。GREEN 里有一对相同的元音。",
    23,
  ),
  letterLesson(
    "小步前进",
    "SMALL STEPS MAKE PROGRESS",
    "小小的步子也在取得进展。把已知映射带入每一个单词。",
    5,
  ),
  letterLesson(
    "花园约定",
    "GIVE EVERY FLOWER ROOM TO GROW",
    "给每朵花留下生长的空间。重复出现的字母会同时解开。",
    13,
  ),
];
export function decodedCipher(level: CipherLesson, map: CipherMap) {
  return level.encrypted.replace(/[A-Z]/g, (c) => map[c] ?? "·");
}
export function cipherWon(level: CipherLesson, map: CipherMap) {
  return decodedCipher(level, map) === level.phrase;
}
export function assignCipher(
  level: CipherLesson,
  map: CipherMap,
  key: string,
  value: string,
): CipherMap | null {
  if (
    cipherWon(level, map) ||
    !level.keys.includes(key) ||
    !/^[A-Z]$/.test(value) ||
    Object.entries(map).some(([k, v]) => k !== key && v === value)
  )
    return null;
  if (map[key] === value) return null;
  return { ...map, [key]: value };
}
export function cipherHint(level: CipherLesson, map: CipherMap) {
  const index = [...level.phrase].findIndex(
    (c, i) => c !== " " && map[level.encrypted[i]] !== c,
  );
  if (index < 0) return null;
  const key = level.encrypted[index],
    value = level.phrase[index],
    occupied = Object.entries(map).find(
      ([k, v]) => k !== key && v === value,
    )?.[0];
  return { key, value, occupied };
}
