// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useId, useRef, useState } from "react";
import { Flower2, Ruler, Sprout } from "lucide-react";
import type { GameProps } from "../lib/types";
import { perimeterGardenLevels, type PerimeterGardenLevel } from "./perimeterGardenLevels";
import "./perimeterGarden.css";

type Edge = { cell: number; side: string; x1: number; y1: number; x2: number; y2: number };
type GardenState = { cells: number[]; history: number[][] };

// Each selected-to-empty (or off-board) side counts, including every hole edge.
function measureGarden(config: PerimeterGardenLevel, cells: number[]) {
  const n = config.size, planted = new Set(cells), edges: Edge[] = [];
  const neighbors = (cell: number) => [
    cell >= n ? cell - n : -1,
    cell % n < n - 1 ? cell + 1 : -1,
    cell < n * (n - 1) ? cell + n : -1,
    cell % n > 0 ? cell - 1 : -1,
  ];
  let adjacencies = 0;
  for (const cell of cells) {
    const x = cell % n, y = Math.floor(cell / n);
    const around = neighbors(cell);
    if (planted.has(around[1])) adjacencies++;
    if (planted.has(around[2])) adjacencies++;
    const sides = [
      { side: "north", x1: x, y1: y, x2: x + 1, y2: y },
      { side: "east", x1: x + 1, y1: y, x2: x + 1, y2: y + 1 },
      { side: "south", x1: x + 1, y1: y + 1, x2: x, y2: y + 1 },
      { side: "west", x1: x, y1: y + 1, x2: x, y2: y },
    ];
    sides.forEach((edge, index) => { if (!planted.has(around[index])) edges.push({ cell, ...edge }); });
  }
  const visited = new Set<number>();
  let components = 0;
  for (const cell of cells) {
    if (visited.has(cell)) continue;
    components++;
    const queue = [cell]; visited.add(cell);
    for (let head = 0; head < queue.length; head++) for (const next of neighbors(queue[head])) {
      if (planted.has(next) && !visited.has(next)) { visited.add(next); queue.push(next); }
    }
  }
  const area = cells.length, perimeter = 4 * area - 2 * adjacencies;
  const legal = planted.size === area && cells.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < n * n && !config.blocked.includes(cell)) && config.required.every((cell) => planted.has(cell));
  return { area, perimeter, components, adjacencies, edges, won: legal && area === config.area && perimeter === config.perimeter && components === 1 };
}

export default function PerimeterGarden(props: GameProps) {
  return <PerimeterRound key={`${props.level}:${props.resetToken}`} {...props} />;
}

function PerimeterRound({ level, paused, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const config = perimeterGardenLevels[level] ?? perimeterGardenLevels[0];
  const [state, setState] = useState<GardenState>(() => ({ cells: [...config.required], history: [] }));
  const current = useRef(state);
  const [hinted, setHinted] = useState<number | null>(null);
  const [message, setMessage] = useState("点空格种花，再点一次移除。保留星星，把花格沿上下左右连成一片，同时满足面积与周长目标。");
  const callbacks = useRef({ onComplete, onStatus }); callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken });
  const completed = useRef(false);
  const diagramId = useId();
  const metrics = measureGarden(config, state.cells);
  const { won, area, perimeter, components, edges, adjacencies } = metrics;

  useEffect(() => { if (!paused) callbacks.current.onStatus(message); }, [message, paused]);
  useEffect(() => {
    if (!won || paused || completed.current) return;
    completed.current = true;
    setHinted(null);
    setMessage(`花园完成！${area} 格花地、${perimeter} 段围栏，所有花格连成一片。你的布局满足全部规则。`);
    callbacks.current.onComplete();
  }, [won, paused, area, perimeter]);

  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || measureGarden(config, current.current.cells).won) return;
    const cells = current.current.cells;
    // A witness is only optional advice. Never mutate the board or use it to win.
    const extra = cells.find((cell) => !config.witness.includes(cell));
    const missing = config.witness.find((cell) => !cells.includes(cell));
    const cell = extra ?? missing;
    if (cell === undefined) return;
    setHinted(cell);
    setMessage(`这是一种可行布局的建议：${extra !== undefined ? "先移除" : "试着种上"}第 ${Math.floor(cell / config.size) + 1} 行第 ${cell % config.size + 1} 列。它不一定是你当前方案的最短改法；任何满足规则的布局都能完成。`);
  }, [hintToken, paused, config]);

  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || measureGarden(config, current.current.cells).won) return;
    const old = current.current, previous = old.history.at(-1);
    if (!previous) { setMessage("还没有可以撤销的编辑。星星是固定花格，会一直保留。"); return; }
    const next = { cells: previous, history: old.history.slice(0, -1) };
    current.current = next; setState(next); setHinted(null);
    setMessage("已撤回上一次编辑。面积、围栏和连通状态都恢复了。");
  }, [undoToken, paused, config]);

  function toggle(cell: number) {
    if (paused || config.required.includes(cell) || config.blocked.includes(cell) || measureGarden(config, current.current.cells).won) return;
    const old = current.current;
    const removing = old.cells.includes(cell);
    const cells = removing ? old.cells.filter((item) => item !== cell) : [...old.cells, cell].sort((a, b) => a - b);
    const next = { cells, history: [...old.history, old.cells] };
    current.current = next; setState(next); setHinted(null);
    const nextMetrics = measureGarden(config, cells);
    setMessage(nextMetrics.components > 1
      ? `现在分成 ${nextMetrics.components} 片。只碰到角不算相连；可以继续增删，让它们共享边。`
      : nextMetrics.area > config.area
        ? `现在有 ${nextMetrics.area} 格，超过面积目标。可以自由移除普通花格，再调整形状。`
        : `${removing ? "已移除一格花" : "已种下一格花"}。每两格共享一条边，就少用两段围栏；继续对照三个目标。`);
  }

  return <div className="perim-game" data-perimeter-game data-perim-won={won} data-perim-area={area} data-perim-perimeter={perimeter} data-perim-components={components}>
    <section className="perim-field" aria-label="周长花园操作区">
      <header className="perim-heading"><div><span className="perim-eyebrow">GARDEN SURVEY · {level + 1} / {perimeterGardenLevels.length}</span><h2>{config.title}</h2></div><Sprout size={34} aria-hidden="true" /></header>
      <p className="perim-brief">种出 <strong>{config.area} 格</strong>花地，围上 <strong>{config.perimeter} 段</strong>围栏。</p>
      <div className="perim-meters" aria-label="花园目标与当前状态">
        <div className={area === config.area ? "perim-met" : ""}><span><Flower2 size={16} aria-hidden="true" />面积</span><strong>{area}<small> / {config.area}</small></strong><em>{area === config.area ? "✓ 达标" : area > config.area ? "超出目标" : `还差 ${config.area - area} 格`}</em></div>
        <div className={perimeter === config.perimeter ? "perim-met" : ""}><span><Ruler size={16} aria-hidden="true" />周长</span><strong>{perimeter}<small> / {config.perimeter}</small></strong><em>{perimeter === config.perimeter ? "✓ 达标" : perimeter > config.perimeter ? `多 ${perimeter - config.perimeter} 段` : `还差 ${config.perimeter - perimeter} 段`}</em></div>
        <div className={components === 1 ? "perim-met" : ""}><span>◇ 连通</span><strong>{components}<small> / 1 片</small></strong><em>{components === 1 ? "✓ 相连" : "还需连接"}</em></div>
      </div>
      <div className="perim-board-wrap">
        <div className="perim-board" role="group" aria-label={`${config.size} 乘 ${config.size} 花园。Tab 移动焦点，Enter 或空格种花与移除。`} style={{ gridTemplateColumns: `repeat(${config.size}, minmax(44px, 1fr))` }}>
          {Array.from({ length: config.size * config.size }, (_, cell) => {
            const selected = state.cells.includes(cell), required = config.required.includes(cell), blocked = config.blocked.includes(cell);
            const row = Math.floor(cell / config.size) + 1, col = cell % config.size + 1;
            return <button key={cell} type="button" className={`perim-cell ${selected ? "perim-planted" : ""} ${required ? "perim-anchor" : ""} ${blocked ? "perim-blocked" : ""} ${hinted === cell ? "perim-hinted" : ""}`} data-perim-cell={cell} data-perim-selected={selected} data-perim-required={required} data-perim-blocked={blocked} aria-pressed={selected} aria-label={`第 ${row} 行第 ${col} 列，${blocked ? "石板，不能种花" : required ? "固定星星花格，不可移除" : selected ? "已种花，点击移除" : "空地，点击种花"}${hinted === cell ? "，提示位置" : ""}`} disabled={paused || won || required || blocked} onClick={() => toggle(cell)}><small aria-hidden="true">{row}·{col}</small><span aria-hidden="true">{blocked ? "×" : required ? "★" : selected ? "✿" : "·"}</span></button>;
          })}
          <svg className="perim-boundary" viewBox={`0 0 ${config.size} ${config.size}`} role="img" aria-labelledby={`${diagramId}-title ${diagramId}-desc`}>
            <title id={`${diagramId}-title`}>当前花圃的外露边：共 {perimeter} 段</title>
            <desc id={`${diagramId}-desc`}>金色实线逐段标出花格与空地、石板或棋盘外相接的边。空洞内圈也包括在内，相邻花格之间没有围栏。</desc>
            {edges.map(({ cell, side, ...line }) => <line key={`${cell}-${side}`} data-perim-edge={`${cell}-${side}`} {...line} />)}
          </svg>
        </div>
      </div>
      <div className="perim-legend"><span><b>★</b> 固定花格</span><span><b>×</b> 石板</span><span><i aria-hidden="true" /> 计入周长的边</span></div>
      <p className="perim-counting">围栏账本：4 × {area} 格 − 2 × {adjacencies} 条共享边 = <strong>{perimeter} 段</strong></p>
      <p className={`perim-feedback ${won ? "perim-success" : ""}`} role="status">{paused ? "花园已暂停。花格、提示与围栏都留在原处，继续后可再编辑。" : message}</p>
    </section>
    <aside className="perim-notes"><span className="perim-eyebrow">一格花地，四条边</span><h3>让面积与周长，<br />刚刚好。</h3><p className="perim-lesson">{config.lesson}</p>
      <ol><li><strong>面积数花格。</strong>星星已种好，也计入面积。石板不能种花。</li><li><strong>周长数围栏。</strong>金线就是实际计数的边。棋盘边、石板边和空洞内圈都要算。</li><li><strong>花格连成一片。</strong>上下左右共享边才相连，斜角接触不算。</li></ol>
      <div className="perim-formula"><span>共享一条边</span><b>4 + 4 − 2 = 6</b><p>两格贴在一起，只需六段围栏。</p></div>
      <p className="perim-small">可以无限增删，暂时超出目标或分成几片也没关系。任何符合全部规则的布局都算完成，不要求唯一答案。</p>
      <details><summary>操作与提示</summary><p>点击或触摸空格种花，再次点击移除。键盘用 Tab 选格，Enter 或空格确认。撤销退回一次编辑；重来仅保留星星。暂停与完成后不能改动花格。</p><p>提示只指出通往一种预设可行布局的一处改动，不会自动种花，也不保证是当前方案的最短路线。完成后提示不会改动你的答案。</p></details>
    </aside>
  </div>;
}
