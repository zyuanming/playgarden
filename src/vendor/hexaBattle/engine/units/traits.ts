// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.
// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.
import { ICell } from '../map'
import Unit from '../unit'

export interface ITrait {
  name: string,
  description: string,

  modify(unit: Unit): void
}

export const flying: ITrait = {
  name: 'Flying',
  description: 'Allows the unit to fly over anything',

  modify(unit: Unit) {
    unit.canWalkOn = (cell: ICell) => {
      return !(cell.thing && cell.thing instanceof Unit)
    }
  },
}
