// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.
// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.
let GID = 0

export default function gid(): string {
  return  (++GID).toString()
}
