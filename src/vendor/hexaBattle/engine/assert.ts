// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.
// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.
// TODO add DEV/PROD silence
export default function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    throw new Error(`[ASSERTION ERROR], ${message}`)
  }
}
