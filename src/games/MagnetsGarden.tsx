import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import { magnetsLevels } from "./magnetsLevels";
import {
  MAGNETS_SAVE,
  changeMagnets,
  initialMagnets,
  inspectMagnets,
  oppositePole,
  parseMagnetsSave,
  solveMagnets,
} from "./magnetsLogic";
import "./magnetsGarden.css";
const chapters = ["磁极初识", "交错磁场", "隐去线索", "磁场大师"];
const intro =
  "先选 ＋、− 或 ○，再点格子。相连的两格一起改变；空白待定，○ 表示整块不放磁铁。";
export default function MagnetsGarden(props: GameProps) {
  const key = `${props.level}:${props.resetToken}`,
    round = useRef({ key, level: props.level, fresh: false });
  if (round.current.key !== key)
    round.current = {
      key,
      level: props.level,
      fresh: round.current.level === props.level,
    };
  return (
    <MagnetsRound
      key={key}
      {...props}
      freshStart={props.freshStart || round.current.fresh}
    />
  );
}
function MagnetsRound({
  level,
  paused,
  freshStart,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const p = magnetsLevels[level] ?? magnetsLevels[0];
  const [history, setHistory] = useState(() => {
    try {
      return parseMagnetsSave(
        freshStart
          ? null
          : localStorage.getItem(`${MAGNETS_SAVE}.round.${level}`),
        p,
      );
    } catch {
      return [initialMagnets(p)];
    }
  });
  const state = history[history.length - 1],
    check = inspectMagnets(p, state),
    blocked = paused || check.won;
  const [selected, setSelected] = useState(1),
    [message, setMessage] = useState(intro),
    [hint, setHint] = useState<number | null>(null),
    [saved, setSaved] = useState(true);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken }),
    completed = useRef(false),
    cells = useRef<(HTMLButtonElement | null)[]>([]);
  const coord = (i: number) =>
    `${Math.floor(i / p.width) + 1}行${(i % p.width) + 1}列`;
  const label = (v: number) =>
    v === 1 ? "正极 ＋" : v === 2 ? "负极 −" : v === 0 ? "空置 ○" : "待定";
  function report(s: string) {
    setMessage(s);
    callbacks.current.onStatus(s);
  }
  useEffect(() => {
    callbacks.current.onStatus(intro);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        `${MAGNETS_SAVE}.round.${level}`,
        JSON.stringify({ id: p.id, history }),
      );
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [p, history, level]);
  useEffect(() => {
    if (check.won && !paused && !completed.current) {
      completed.current = true;
      report("磁场平衡！每块两极相反、同极不相邻，所有数字恰好满足。");
      callbacks.current.onComplete();
    }
  }, [check.won, paused]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (blocked) return;
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
    setHint(null);
    report("已撤销整块磁铁的上一步。");
  }, [undoToken, blocked]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (blocked) return;
    setHint(null);
    const r = solveMagnets(p, state);
    if (r.kind === "budget")
      report("搜索达到预算，暂时没有可靠建议；这不代表无解。");
    else if (r.kind === "none")
      report("当前磁极安排与完整解不相容。撤销最近一步，或清除一块再试。");
    else if (r.kind === "solution") {
      const d = state.findIndex((v, i) => v !== r.state[i]);
      if (d >= 0) {
        const i = p.dominoes[d][0];
        setSelected(r.state[d]);
        setHint(d);
        report(
          `搜索当前局面找到兼容完整解：把${coord(i)}设为${label(r.state[d])}。已选好符号，由你点击确认。`,
        );
        cells.current[i]?.focus({ preventScroll: true });
      }
    }
  }, [hintToken, blocked, p, state]);
  function edit(i: number) {
    if (blocked) return;
    const d = p.dominoes.findIndex((pair) => pair.includes(i));
    const first = p.dominoes[d][0] === i;
    const v = selected < 0 ? -1 : first ? selected : oppositePole(selected),
      next = changeMagnets(p, state, d, v);
    if (next === state) return;
    setHistory((h) => [...h.slice(-1999), next]);
    setHint(null);
    const c = inspectMagnets(p, next);
    report(
      `${coord(i)}已设为${label(selected)}。${c.conflicts.size ? "红框表示同极相邻或已不可能满足的数字，请调整。" : `还有 ${c.missing} 块待定。`}`,
    );
  }
  const clue = (
    c: { count: number; target: number; impossible: boolean },
    pole: string,
    axis: string,
    n: number,
  ) => (
    <span
      className={`magnets-clue ${c.impossible ? "bad" : ""}`}
      aria-label={`${axis}${n + 1} ${pole} 当前${c.count}，目标${c.target < 0 ? "不限" : c.target}`}
      title={`当前 ${c.count} / 目标 ${c.target < 0 ? "不限" : c.target}`}
    >
      <small>{pole}</small>
      {c.target < 0 ? "·" : c.target}
    </span>
  );
  return (
    <div
      className="magnets-layout"
      data-magnets-id={p.id}
      data-magnets-state={state.join(",")}
      data-magnets-won={check.won}
      onKeyDown={(e) => {
        if (
          (e.ctrlKey || e.metaKey || e.altKey) &&
          ["Enter", " "].includes(e.key)
        )
          e.preventDefault();
      }}
    >
      <section className="magnets-play" aria-label="磁极拼图棋局">
        <header className="magnets-heading">
          <div>
            <span className="magnets-eyebrow">
              第 {p.chapter + 1} 章 · {chapters[p.chapter]}
            </span>
            <h3>{p.title}</h3>
          </div>
          <span>{String(level + 1).padStart(2, "0")} / 36</span>
        </header>
        <p className="magnets-intro">
          每个长框是一块：放入 ＋／−，或让两格都空置 ○。
        </p>
        <div className="magnets-stats">
          <span>
            待定 <strong>{check.missing}</strong> 块
          </span>
          <span>
            {p.width} × {p.height} 磁场
          </span>
        </div>
        <div className="magnets-palette" role="group" aria-label="选择磁极工具">
          {[1, 2, 0, -1].map((v) => (
            <button
              type="button"
              key={v}
              data-pole={v}
              aria-pressed={selected === v}
              disabled={blocked}
              onClick={() => {
                setSelected(v);
                setHint(null);
                report(`已选${label(v)}。点任一格，整块一起改变。`);
              }}
            >
              <b>{v === 1 ? "＋" : v === 2 ? "−" : v === 0 ? "○" : "⌫"}</b>
              <span>
                {v === 1
                  ? "正极"
                  : v === 2
                    ? "负极"
                    : v === 0
                      ? "空置"
                      : "清除"}
              </span>
            </button>
          ))}
        </div>
        <div
          className="magnets-frame"
          style={{ "--magnets-width": p.width } as CSSProperties}
          role="group"
          aria-label={`${p.width}乘${p.height}磁极棋盘`}
        >
          <span className="magnets-corner">列 ＋</span>
          {check.cols.map((c, x) => (
            <div key={`cp${x}`}>{clue(c[0], "＋", "列", x)}</div>
          ))}
          <span className="magnets-corner">行 −</span>
          {check.rows.map((r, y) => (
            <div className="magnets-row" key={y}>
              {clue(r[0], "＋", "行", y)}
              {Array.from({ length: p.width }, (_, x) => {
                const i = y * p.width + x,
                  d = p.dominoes.findIndex((pair) => pair.includes(i)),
                  pair = p.dominoes[d],
                  other = pair[0] === i ? pair[1] : pair[0],
                  v = check.cells[i];
                const join =
                  other === i + 1
                    ? "right"
                    : other === i - 1
                      ? "left"
                      : other > i
                        ? "bottom"
                        : "top";
                return (
                  <button
                    type="button"
                    key={i}
                    ref={(el) => {
                      cells.current[i] = el;
                    }}
                    data-cell={i}
                    data-domino={d}
                    data-value={v}
                    className={`magnets-cell join-${join} pole-${v} ${check.conflicts.has(i) ? "conflict" : ""} ${hint === d ? "hint" : ""}`}
                    disabled={blocked}
                    aria-label={`${coord(i)}，${label(v)}，与${coord(other)}成对${check.conflicts.has(i) ? "，冲突" : ""}`}
                    onClick={() => edit(i)}
                    onKeyDown={(e) => {
                      if (e.ctrlKey || e.metaKey || e.altKey) return;
                      const delta = (
                        {
                          ArrowLeft: -1,
                          ArrowRight: 1,
                          ArrowUp: -p.width,
                          ArrowDown: p.width,
                        } as Record<string, number>
                      )[e.key];
                      if (!delta) return;
                      e.preventDefault();
                      const j = i + delta;
                      if (
                        j >= 0 &&
                        j < check.cells.length &&
                        (Math.abs(delta) !== 1 || Math.floor(j / p.width) === y)
                      )
                        cells.current[j]?.focus();
                    }}
                  >
                    <span aria-hidden="true">
                      {v === 1 ? "＋" : v === 2 ? "−" : v === 0 ? "○" : "·"}
                    </span>
                    {check.conflicts.has(i) && (
                      <small aria-hidden="true">!</small>
                    )}
                  </button>
                );
              })}
              {clue(r[1], "−", "行", y)}
            </div>
          ))}
          <span className="magnets-corner">行 ＋</span>
          {check.cols.map((c, x) => (
            <div key={`cm${x}`}>{clue(c[1], "−", "列", x)}</div>
          ))}
          <span className="magnets-corner">列 −</span>
        </div>
        <div className="magnets-legend">
          <span>粗框内两格成对</span>
          <span>· 待定 / 无数字限制</span>
          <span>○ 明确空置</span>
        </div>
        <p className="magnets-message" role="status">
          {message}
        </p>
      </section>
      <aside className="magnets-notes">
        <span className="magnets-eyebrow">MAGNETS · 磁场手记</span>
        <h3>两极之间，留一点空白</h3>
        <ol>
          <li>每个长框放一块磁铁：两格必须一正一负；也可两格都空置 ○。</li>
          <li>不同磁铁的同极不能上下左右相邻，斜角接触可以。</li>
          <li>上方、左侧数 ＋；下方、右侧数 −。数字表示整列或整行的总数。</li>
          <li>
            边缘 · 表示没有数量限制。所有长框必须明确决定，待定不等于空置。
          </li>
        </ol>
        <p>先选工具再点格子，另一端自动相反。空置、清除都作用于整块。</p>
        <p>
          Enter /
          空格操作，方向键移动焦点。提示建议下一块但不会代填；暂停、撤销、重来在上方。
        </p>
        <p>
          红框仅指出现在已冲突的相邻磁极，或当前无法达到的数量。没有红框不保证最终有解。
        </p>
        <p className="magnets-save">
          {saved
            ? "当前局面已保存在本机，保留最近 2000 步。"
            : "当前无法保存，离开后可能丢失这局。"}
        </p>
      </aside>
    </div>
  );
}
