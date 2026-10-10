# SPDX-License-Identifier: GPL-3.0-only
# Static adaptation only; never executes the original game or build.
from pathlib import Path
import shutil,re,json
repo=Path(__file__).resolve().parents[2]
source=repo/'vendor/hexa-battle-original/upstream'
dest=repo/'src/vendor/hexaBattle'
paths=[*source.glob('src/engine/**/*.ts'),*source.glob('src/content/*.ts')]
for path in paths:
 rel=path.relative_to(source/'src');text=path.read_text()
 text=text.replace('function assert(cond, message)', 'function assert(cond: unknown, message: string): asserts cond')
 text=text.replace('  kind: string\n  id = gid()', "  kind = 'THING'\n  id = gid()")
 if rel.as_posix()=='engine/thing.ts':text=text[:text.index('export default class')]+text[text.index('export default class'):].replace('  pos: Hex','  pos!: Hex')
 text=text.replace('  name: string\n  description: string\n\n  params:', "  name = ''\n  description = ''\n\n  params:")
 text=re.sub(r'  params: (IParams|\{\})\n',r'  declare params: \1\n',text)
 text=text.replace('performAction(target) {','performAction(target: Hex) {')
 text=text.replace('modify(unit: Unit)\n','modify(unit: Unit): void\n')
 text=text.replace('generateLevel(number)', 'generateLevel(number: number)')
 text=text.replace('function cellsInMap(size: number) {', 'function cellsInMap(size: number): number {')
 text=text.replace('(payload) => Promise<void>', '(payload: any) => Promise<void>')
 text=text.replace('emit(eventName: string, payload)', 'emit(eventName: string, payload: any)')
 text=text.replace('damage -= this.resistance','damage = Math.max(0, damage - this.resistance)')
 header='// Original Hexa Battle, Copyright (c) 2017 Giacomo Tagliabue, MIT.\n// Playgarden: strict types and resistance underflow correction; see vendor/hexa-battle-original.\n'
 p=dest/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(header+text)
ai=(source/'src/ai/unitAi.ts').read_text().replace("import OpponentAi from './opponentAi'", "import type { StrategyContext } from './strategyContext'").replace('protected ai: OpponentAi','protected ai: StrategyContext')
p=dest/'ai/unitAi.ts';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('// Original Hexa Battle AI, Copyright (c) 2017 Giacomo Tagliabue, MIT.\n// Playgarden: structural controller type only. Original ranking/path strategy retained.\n'+ai)
print('Prepared',len(paths)+1,'complete engine/content/AI modules; no original UI or external assets')
