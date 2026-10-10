// SPDX-License-Identifier: GPL-3.0-only
// Small local replacements for the original logging/timing utility.
export function debug(..._args: unknown[]) {}
export function getItemCircular<T>(array: T[], index: number): T {
  return array[((index % array.length) + array.length) % array.length];
}
