// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.
// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.
import gid from './gid'

export default class Faction {
  id = gid()

  constructor(public name: string, public color: string) {}
}
