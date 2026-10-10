// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.
// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.
import { meleeAttack } from '../actions/meleeAttack'
import RollingStone from '../actions/rollingStone'
import { IUnitType } from '../unit'

export default {
  name: 'Giant',
  description: '',

  hp: 10,
  mp: 2,
  mana: 0,
  resistance: 0,
  actions: [
    meleeAttack({ damage: 3 }),
    RollingStone,
  ],

  cost: 12,
} as IUnitType
