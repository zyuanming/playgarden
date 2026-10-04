// SPDX-License-Identifier: MIT
/** Small exact rational values. BigInt cross-products avoid rounded comparisons. */
export type PhysicsRatio = { numerator: number; denominator: number };
export function physicsRatio(numerator: number, denominator = 1): PhysicsRatio {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    denominator === 0
  )
    throw new RangeError(
      "Expected safe integer numerator and nonzero denominator",
    );
  if (denominator < 0) {
    numerator = -numerator;
    denominator = -denominator;
  }
  let a = Math.abs(numerator),
    b = denominator;
  while (b) [a, b] = [b, a % b];
  return {
    numerator: numerator / (a || 1),
    denominator: denominator / (a || 1),
  };
}
export function validPhysicsRatio(r: PhysicsRatio): boolean {
  return (
    !!r &&
    Number.isSafeInteger(r.numerator) &&
    Number.isSafeInteger(r.denominator) &&
    r.denominator > 0
  );
}
export function comparePhysicsRatios(a: PhysicsRatio, b: PhysicsRatio): number {
  if (!validPhysicsRatio(a) || !validPhysicsRatio(b))
    throw new RangeError("Invalid ratio");
  const difference =
    BigInt(a.numerator) * BigInt(b.denominator) -
    BigInt(b.numerator) * BigInt(a.denominator);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}
export function formatPhysicsRatio(value: PhysicsRatio): string {
  const r = physicsRatio(value.numerator, value.denominator);
  return r.denominator === 1
    ? String(r.numerator)
    : `${r.numerator}/${r.denominator}`;
}
export const physicsRatioValue = (r: PhysicsRatio) =>
  r.numerator / r.denominator;
