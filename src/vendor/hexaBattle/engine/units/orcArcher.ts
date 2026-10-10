// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.
// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.
import { rangedAttack } from '../actions/rangedAttack'
import { IUnitType } from '../unit'

export default {
  name: 'Orc Archer',
  description: '',

  hp: 4,
  mp: 2,
  mana: 0,
  resistance: 0,
  actions: [
    rangedAttack({ damage: 3, range: [5, 2] }),
  ],

  cost: 5,
} as IUnitType
