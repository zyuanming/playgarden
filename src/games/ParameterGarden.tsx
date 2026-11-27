// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { initialRecipe, printPlate, recipeId, type Direction, type Plate, type Recipe } from "./parameterGardenLogic";
import { parameterLevels } from "./parameterGardenLevels";
import "./parameterGarden.css";

const intro = "先调参数预览，再应用整套配方。";
const success = "同一套配方匹配了全部印盘！";
const steps: Record<Direction, string> = { E:"→ 1",W:"← 1",S:"↓ 1",N:"↑ 1",SE:"↘ 1",NE:"↗ 1",SW:"↙ 1",NW:"↖ 1",E2:"→ 2",W2:"← 2",S2:"↓ 2",N2:"↑ 2" };
const coordinates = (n: number) => "第 " + (Math.floor(n / 5) + 1) + " 行第 " + (n % 5 + 1) + " 列";
const seedAxis = [0, 1, 2, 3, 4];
const symbols = { match: "✓", missing: "○", extra: "×", blank: "" };
const cells = { match: "吻合", missing: "缺印", extra: "多印", blank: "空白" };

export default function ParameterGarden(props: GameProps) {
  return <Round key={props.level + ":" + props.resetToken} {...props} />;
}

function Round({ level, paused, hintToken, undoToken, onStatus, onComplete }: GameProps) {
  const l = parameterLevels[level] ?? parameterLevels[0];
  const [draft, setDraft] = useState(() => initialRecipe(l));
  const [history, setHistory] = useState<Recipe[]>(() => [initialRecipe(l)]);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState(intro);
  const [won, setWon] = useState(false);
  const committed = history[history.length - 1];
  const dirty = recipeId(draft) !== recipeId(committed);
  const previews = l.panels.map(plate => printPlate(plate, draft));
  const preview = previews[active], count = previews.filter(p => p.matches).length;
  const locked = paused || won;
  const live = useRef({ onStatus, onComplete });
  live.current = { onStatus, onComplete };
  const tokens = useRef({ hintToken, undoToken });

  function report(text: string) { setMessage(text); live.current.onStatus(text); }
  useEffect(() => { live.current.onStatus(intro); }, []);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const mismatch = previews.findIndex(p => !p.matches);
    if (mismatch < 0) { report("预览已全部吻合。按「应用配方」提交。"); return; }
    setActive(mismatch);
    const missing = previews[mismatch].cells.indexOf("missing");
    const index = missing >= 0 ? missing : previews[mismatch].cells.indexOf("extra");
    report("印盘 " + (mismatch + 1) + "：" + coordinates(index) + (missing >= 0 ? "缺一格印迹。" : "多一格印迹。"));
  }, [hintToken, draft, locked]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    if (history.length > 1) {
      setDraft(history[history.length - 2]);
      setHistory(history.slice(0, -1));
      report("已撤销上次应用，所有印盘恢复为上一套配方。");
    } else if (dirty) {
      setDraft(committed);
      report("已丢弃未应用的预览。");
    } else report("还没有可以撤销的配方。");
  }, [undoToken, history, dirty, locked]);

  function apply() {
    if (locked || !dirty) return;
    setHistory([...history, draft]);
    if (count === l.panels.length) {
      setWon(true);
      live.current.onStatus(success);
      live.current.onComplete();
    } else report("已应用：" + count + "/" + l.panels.length + " 个印盘吻合。");
  }
  function change<K extends keyof Recipe>(field: K, options: readonly Recipe[K][], delta: number) {
    if (locked || options.length < 2) return;
    setDraft(old => ({ ...old, [field]: options[(options.indexOf(old[field]) + delta + options.length) % options.length] }));
    setMessage("正在预览同一套配方，尚未应用。");
  }
  const plate = l.panels[active];
  return <div className="puzzle-layout parameter-garden" data-level-id={l.id} data-draft={recipeId(draft)}
    data-committed={recipeId(committed)} data-matched={count} data-plate-active={active + 1}
    data-applied={history.length - 1} data-won={won}>
    <section className="pg-studio" tabIndex={0} aria-label="参数花园操作区" onKeyDown={e => {
      if (paused || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
      const key = e.key.toLowerCase();
      if ((key === "[" || key === "]") && l.panels.length > 1) setActive(i => (i + (key === "]" ? 1 : -1) + l.panels.length) % l.panels.length);
      else if (locked) return;
      else if (key === "r") change("turn", l.turns, 1);
      else if (key === "d") change("step", l.steps, 1);
      else if (key === "c") change("copies", l.copies, 1);
      else if (key === "a") apply();
      else return;
      e.preventDefault();
    }}>
      <header className="pg-title"><div><span>印章工坊 · 第 {level + 1} 关</span><h3>一套参数，多张印盘</h3></div>
        <strong>{count}/{l.panels.length} 吻合</strong></header>
      <div className="pg-settings">
        <Control name="顺时针旋转" field="turn" value={draft.turn + "°"} fixed={l.turns.length === 1} locked={locked} onChange={delta => change("turn", l.turns, delta)} />
        <Control name="每次位移" field="step" value={steps[draft.step]} fixed={l.steps.length === 1} locked={locked} onChange={delta => change("step", l.steps, delta)} />
        <Control name="印章次数" field="copies" value={draft.copies + " 次"} fixed={l.copies.length === 1} locked={locked} onChange={delta => change("copies", l.copies, delta)} />
      </div>
      <div className="pg-tabs" role="group" aria-label="选择印盘">
        {previews.map((p, i) => <button key={i} type="button" aria-pressed={i === active}
          data-plate={i + 1} data-match={p.matches} disabled={paused} onClick={() => setActive(i)}>
          印盘 {i + 1}<small>{p.matches ? "✓ 吻合" : "· 待对齐"}</small>
        </button>)}
      </div>
      <Seed plate={plate} />
      <div className="pg-grids">
        <Grid title="目标印盘" plate={plate} />
        <Grid title={dirty ? "草稿预览" : "已应用结果"} plate={plate} preview={preview} />
      </div>
      <div className="pg-stats"><span data-clipped={preview.clipped}>越界剪去 {preview.clipped}</span><span data-overlap={preview.overlap}>重叠合并 {preview.overlap}</span></div>
      <div className="pg-legend"><span>✓ 吻合</span><span>○ 缺印</span><span>× 多印</span><span>蓝框 = 锚点</span></div>
      <button className="pg-apply" type="button" disabled={locked || !dirty} onClick={apply}>应用配方</button>
      <p className="pg-message" role="status">{paused ? "已暂停。" : won ? success : message}</p>
    </section>
    <aside className="game-notes">
      <span className="mini-label">旋转 · 位移 · 反推</span>
      <h3>别只对上一张。</h3>
      <ol>
        <li>印章绕原点顺时针旋转。第一印盖在各盘的锚点，后面的每印都在上一印的基础上再移一步。</li>
        <li>越界的点不计；重叠的印迹只占一格。只有所有印盘同时吻合，应用配方才能过关。</li>
        <li>切换印盘和提示都不改参数。撤销会恢复上一次应用前的配方。</li>
      </ol>
      <p>键盘聚焦操作区：R 旋转、D 位移、C 次数、[ ] 切盘、A 应用。也可用 Tab 操作各按钮。</p>
    </aside>
  </div>;
}

function Control({ name, field, value, fixed, locked, onChange }: {
  name: string; field: string; value: string; fixed: boolean; locked: boolean; onChange: (delta: number) => void;
}) {
  return <div className="pg-control" data-control={field} data-fixed={fixed}>
    <small>{name}</small>
    <div>
      {!fixed && <button type="button" aria-label={name + "：上一项"} disabled={locked} onClick={() => onChange(-1)}>‹</button>}
      <strong>{value}</strong>
      {!fixed && <button type="button" aria-label={name + "：下一项"} data-next={field} disabled={locked} onClick={() => onChange(1)}>›</button>}
    </div>
    {fixed && <small className="pg-fixed">固定</small>}
  </div>;
}

function Seed({ plate }: { plate: Plate }) {
  return <div className="pg-seed">
    <svg viewBox="0 0 50 50" role="img" aria-label={"原始印章，坐标 " + plate.seed.map(p => p.join(",")).join("；")}>
      {seedAxis.flatMap(y => seedAxis.map(x => {
        const on = plate.seed.some(([xx, yy]) => xx === x - 2 && yy === y - 2);
        const origin = x === 2 && y === 2;
        return <rect key={x + ":" + y} x={x * 10 + 1} y={y * 10 + 1} width="8" height="8" rx="1"
          fill={origin ? "#294d86" : on ? "#286a53" : "#e1e8e1"} />;
      }))}
    </svg>
    <div><b>原始印章</b><small>蓝格为旋转原点<br/>锚点：{coordinates(plate.anchor[1] * 5 + plate.anchor[0])}</small></div>
  </div>;
}

function Grid({ title, plate, preview }: { title: string; plate: Plate; preview?: ReturnType<typeof printPlate> }) {
  const goal = [...plate.target.join("")];
  return <div className="pg-grid-card">
    <strong>{title}</strong>
    <div className="pg-grid" role="group" aria-label={title}>
      <span aria-hidden="true" />{seedAxis.map(x => <small aria-hidden="true" key={x}>{x + 1}</small>)}
      {seedAxis.flatMap(y => [<small aria-hidden="true" key={"r" + y}>{y + 1}</small>, ...seedAxis.map(x => {
        const index = y * 5 + x;
        const state = preview?.cells[index] ?? (goal[index] === "#" ? "target" : "blank");
        const anchor = x === plate.anchor[0] && y === plate.anchor[1];
        return <span key={y + ":" + x} className="pg-cell" role="img" data-state={state} data-anchor={anchor}
          aria-label={coordinates(index) + "，" + (state === "target" ? "目标印迹" : cells[state]) + (anchor ? "，锚点" : "")}>
          {state === "target" ? "●" : symbols[state]}
        </span>;
      })])}
    </div>
  </div>;
}
