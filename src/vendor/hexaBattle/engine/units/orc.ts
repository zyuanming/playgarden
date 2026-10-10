// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.
// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.
import { meleeAttack } from '../actions/meleeAttack'
import { IUnitType } from '../unit'

export default {
  name: 'Orc',
  description: '',

  hp: 5,
  mp: 3,
  mana: 0,
  resistance: 0,
  actions: [
    meleeAttack({ damage: 3 }),
  ],

  cost: 5,
} as IUnitType
