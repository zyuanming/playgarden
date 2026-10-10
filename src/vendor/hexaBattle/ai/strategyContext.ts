// SPDX-License-Identifier: GPL-3.0-only
import type { ICell } from '../engine/map';
export interface StrategyContext { isCellNearEnemyUnit(cell: ICell): boolean }
