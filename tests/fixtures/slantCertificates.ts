import records from './slantCertificates.json';
import type { SlantLevel } from '../../src/games/slantLevels';
import type { SlantValue } from '../../src/games/slantLogic';
export const slantCertificates = records as (SlantLevel & {solution:SlantValue[]})[];
