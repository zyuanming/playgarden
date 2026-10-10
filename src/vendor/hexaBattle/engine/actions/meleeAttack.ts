// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.
// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.
import Hex from '../hex'
import Unit from '../unit'
import { IActionResult, UnitAction } from './action'

interface IParams {
  damage: number
}

export default class MeleeAttack extends UnitAction {
  name = 'Melee Attack'
  description = 'deals damage to adjacent unit'

  declare params: IParams

  performAction(target: Hex) {
    const result: IActionResult = { targets: [] }

    const targetUnit = this.game.map.cellAt(target).thing
    if (targetUnit instanceof Unit) {
      result.targets!.push({
        unitId: targetUnit.id, damage: this.params.damage,
      })
    }

    return result
  }

  targets() {
    return this.unit.pos.neighbors.filter(this.game.map.isIn)
  }
}

export function meleeAttack(params: IParams) {
  return class extends MeleeAttack {
    params = params
  }
}
