// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.
// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.
import gid from './gid'
import Hex from './hex'

/**
 * Represents anything that can be placed on the map
 */

export interface IThing {
  /**
   * Describe the class of thing at runtime
   */
  kind: string
  /**
   * A global ID for the thing
   */
  id: string

  pos: Hex
}

export default class Thing implements IThing {
  kind = 'THING'
  id = gid()

  pos!: Hex
}
