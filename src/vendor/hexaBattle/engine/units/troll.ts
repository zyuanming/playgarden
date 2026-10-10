// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.
// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.
import { meleeAttack } from '../actions/meleeAttack'
import { IUnitType } from '../unit'

export default {
  name: 'Troll',
  description: '',

  hp: 12,
  mp: 2,
  mana: 0,
  resistance: 0,
  actions: [
    meleeAttack({ damage: 5 }),
  ],

  cost: 10,
} as IUnitType
