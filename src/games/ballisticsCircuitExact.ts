// SPDX-License-Identifier: MIT
/** Exact, normalized fractions. BigInt is used for every physical comparison. */
export type LabFraction = Readonly<{ n: bigint; d: bigint }>;
export function labQ(n: number | bigint, d: number | bigint = 1): LabFraction {
  if (
    (typeof n === "number" && !Number.isSafeInteger(n)) ||
    (typeof d === "number" && !Number.isSafeInteger(d))
  )
    throw new RangeError("Expected exact integers");
  let a = BigInt(n),
    b = BigInt(d);
  if (!b) throw new RangeError("Zero denominator");
  if (b < 0n) {
    a = -a;
    b = -b;
  }
  let x = a < 0n ? -a : a,
    y = b;
  while (y) [x, y] = [y, x % y];
  return { n: a / (x || 1n), d: b / (x || 1n) };
}
export const labAdd = (a: LabFraction, b: LabFraction) =>
  labQ(a.n * b.d + b.n * a.d, a.d * b.d);
export const labSub = (a: LabFraction, b: LabFraction) =>
  labQ(a.n * b.d - b.n * a.d, a.d * b.d);
export const labMul = (a: LabFraction, b: LabFraction) =>
  labQ(a.n * b.n, a.d * b.d);
export const labDiv = (a: LabFraction, b: LabFraction) =>
  labQ(a.n * b.d, a.d * b.n);
export function labCompare(a: LabFraction, b: LabFraction): number {
  const x = a.n * b.d - b.n * a.d;
  return x < 0n ? -1 : x > 0n ? 1 : 0;
}
export const labValue = (a: LabFraction) => Number(a.n) / Number(a.d);
export const labFormat = (a: LabFraction) => {
  const q = labQ(a.n, a.d);
  return q.d === 1n ? String(q.n) : `${q.n}/${q.d}`;
};
export function labValid(value: unknown): value is LabFraction {
  return (
    !!value &&
    typeof value === "object" &&
    "n" in value &&
    "d" in value &&
    typeof value.n === "bigint" &&
    typeof value.d === "bigint" &&
    value.d > 0n
  );
}
export const labMin = (a: LabFraction, b: LabFraction) =>
  labCompare(a, b) <= 0 ? a : b;
export const labMax = (a: LabFraction, b: LabFraction) =>
  labCompare(a, b) >= 0 ? a : b;
