import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import { galaxiesLevels } from "./galaxiesLevels";
import {
  GALAXIES_SAVE,
  changeGalaxies,
  initialGalaxies,
  inspectGalaxies,
  opposite,
  parseGalaxiesSave,
  solveGalaxies,
} from "./galaxiesLogic";
import "./galaxiesGarden.css";
const chapters = ["初识星心", "双星之间", "旋臂生长", "群星成图"];
const lessons = [
  "星心可以在格内，也可以落在格线或交点上。它周围的格子已经为你归好队。",
  "绕同一颗星转半圈，每个格子都要找到自己的搭档。",
  "旋臂可以拐弯，但同一星系的格子必须上下左右连在一起。",
  "让所有星系各自对称、彼此相邻，最终铺满整片星图。",
];
const intro =
  "先选编号星心，再点空格归队；再点同编号格子可清除。每个星系连通且绕自己的星心旋转180°重合。";
export default function GalaxiesGarden(props: GameProps) {
  const key = `${props.level}:${props.resetToken}`,
    round = useRef({ key, level: props.level, fresh: false });
  if (round.current.key !== key)
    round.current = {
      key,
      level: props.level,
      fresh: round.current.level === props.level,
    };
  return (
    <GalaxiesRound
      key={key}
      {...props}
      freshStart={props.freshStart || round.current.fresh}
    />
  );
}
function GalaxiesRound({
  level,
  paused,
  freshStart,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const p = galaxiesLevels[level] ?? galaxiesLevels[0],
    fixed = initialGalaxies(p);
  const [history, setHistory] = useState(() => {
    try {
      return parseGalaxiesSave(
        freshStart
          ? null
          : localStorage.getItem(`${GALAXIES_SAVE}.round.${level}`),
        p,
      );
    } catch {
      return [fixed];
    }
  });
  const state = history[history.length - 1],
    check = inspectGalaxies(p, state),
    blocked = paused || check.won;
  const [selected, setSelected] = useState(0),
    [message, setMessage] = useState(intro),
    [hint, setHint] = useState<number | null>(null),
    [saved, setSaved] = useState(true);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken }),
    completed = useRef(false),
    cells = useRef<(HTMLButtonElement | null)[]>([]);
  const coord = (i: number) =>
    `${Math.floor(i / p.size) + 1}行${(i % p.size) + 1}列`;
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
        `${GALAXIES_SAVE}.round.${level}`,
        JSON.stringify({ id: p.id, history }),
      );
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [history, level, p]);
  useEffect(() => {
    if (check.won && !paused && !completed.current) {
      completed.current = true;
      report("群星归位！每片星系都连通、对称，整张星图完整了。");
      callbacks.current.onComplete();
    }
  }, [check.won, paused]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (blocked) return;
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
    setHint(null);
    report("已撤销一步。继续寻找旋转半圈的搭档。");
  }, [undoToken, blocked]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (blocked) return;
    const answer = solveGalaxies(p, state);
    setHint(null);
    if (answer.kind === "budget")
      report("搜索达到预算，暂时没有可靠建议；这不代表无解。");
    else if (answer.kind === "none")
      report(
        "当前归队与完整星图不相容。试着撤销最近一步，或清除选错编号的格子。",
      );
    else if (answer.kind === "solution") {
      const i = state.findIndex((g, j) => g !== answer.cells[j]);
      if (i >= 0) {
        setSelected(answer.cells[i]);
        setHint(i);
        report(
          `搜索当前局面找到完整兼容解：试着把${coord(i)}归给 ${answer.cells[i] + 1} 号星心。已选好编号，仍由你点击确认。`,
        );
        cells.current[i]?.focus({ preventScroll: true });
      }
    }
  }, [hintToken, blocked, p, state]);
  function edit(i: number) {
    if (blocked) return;
    if (fixed[i] >= 0) {
      setSelected(fixed[i]);
      setHint(null);
      report(
        `已选 ${fixed[i] + 1} 号星心。星心周围的固定格不能改，其他格子由你分配。`,
      );
      return;
    }
    const value = selected === -1 || state[i] === selected ? -1 : selected,
      next = changeGalaxies(p, state, i, value);
    if (next === state) return;
    setHistory((h) => [...h.slice(-1999), next]);
    setHint(null);
    const j = value >= 0 ? opposite(p, value, i) : -1,
      c = inspectGalaxies(p, next);
    report(
      value < 0
        ? `${coord(i)}已清空。`
        : j < 0
          ? `${coord(i)}绕 ${value + 1} 号星心转半圈会落到棋盘外，需要调整。`
          : `${coord(i)}归给 ${value + 1} 号。${c.missing === 0 && !c.won ? "已经填满，但还有星系未连通或未对称。" : `还有 ${c.missing} 格等待归队。`}`,
    );
  }
  return (
    <div
      className="galaxies-layout"
      data-galaxies-id={p.id}
      data-galaxies-state={state.join(",")}
      data-galaxies-won={check.won}
      onKeyDown={(e) => {
        if (
          (e.ctrlKey || e.metaKey || e.altKey) &&
          ["Enter", " "].includes(e.key)
        )
          e.preventDefault();
      }}
    >
      <section className="galaxies-play" aria-label="星系分区棋局">
        <header className="galaxies-heading">
          <div>
            <span className="galaxies-eyebrow">
              第 {p.chapter + 1} 章 · {chapters[p.chapter]}
            </span>
            <h3>{p.title}</h3>
          </div>
          <span>{String(level + 1).padStart(2, "0")} / 36</span>
        </header>
        <p>{lessons[p.chapter]}</p>
        <div className="galaxies-stats">
          <span>
            待归队 <strong>{check.missing}</strong> 格
          </span>
          <span>
            当前对称{" "}
            <strong>{check.completeRegions.filter(Boolean).length}</strong> /{" "}
            {p.centers.length} 区
          </span>
        </div>
        <div
          className="galaxies-palette"
          role="group"
          aria-label="选择星心编号"
        >
          {p.centers.map((_, g) => (
            <button
              key={g}
              type="button"
              data-star={g}
              className={`galaxies-color color-${g % 8}`}
              aria-label={`选择 ${g + 1} 号星心`}
              aria-pressed={selected === g}
              disabled={blocked}
              onClick={() => {
                setSelected(g);
                setHint(null);
                report(`已选 ${g + 1} 号星心。点格子归队，同编号再点可清除。`);
              }}
            >
              <span>✦ {g + 1}</span>
              {check.won && check.completeRegions[g] && (
                <small aria-label="规则满足">✓</small>
              )}
            </button>
          ))}
          <button
            type="button"
            data-star="-1"
            aria-pressed={selected === -1}
            disabled={blocked}
            onClick={() => {
              setSelected(-1);
              setHint(null);
              report("已选清除。点可编辑的格子，移除它的归队编号。");
            }}
          >
            清除
          </button>
        </div>
        <div
          className="galaxies-board"
          style={{ "--galaxies-size": p.size } as CSSProperties}
          role="group"
          aria-label={`${p.size}乘${p.size}星系棋盘`}
        >
          {state.map((g, i) => (
            <button
              key={i}
              ref={(el) => {
                cells.current[i] = el;
              }}
              type="button"
              data-cell={i}
              data-owner={g}
              data-fixed={fixed[i] >= 0}
              className={`galaxies-cell ${g >= 0 ? `galaxies-color color-${g % 8}` : "unassigned"} ${fixed[i] >= 0 ? "fixed" : ""} ${g >= 0 && g === selected ? "selected-region" : ""} ${hint === i ? "hint" : ""} ${g >= 0 && opposite(p, g, i) < 0 ? "conflict" : ""}`}
              style={{
                borderRightWidth:
                  i % p.size === p.size - 1 || state[i] !== state[i + 1]
                    ? 3
                    : 1,
                borderBottomWidth:
                  i >= state.length - p.size || state[i] !== state[i + p.size]
                    ? 3
                    : 1,
              }}
              aria-label={`${coord(i)}，${g < 0 ? "未归队" : `${g + 1}号星系`}${fixed[i] >= 0 ? "，星心固定格，点击选中星系" : ""}${g >= 0 && opposite(p, g, i) < 0 ? "，旋转越界冲突" : ""}`}
              disabled={blocked}
              onClick={() => edit(i)}
              onKeyDown={(e) => {
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                const d = (
                  {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -p.size,
                    ArrowDown: p.size,
                  } as Record<string, number>
                )[e.key];
                if (!d) return;
                e.preventDefault();
                const j = i + d;
                if (
                  j >= 0 &&
                  j < state.length &&
                  (Math.abs(d) !== 1 ||
                    Math.floor(i / p.size) === Math.floor(j / p.size))
                )
                  cells.current[j]?.focus();
              }}
            >
              <span aria-hidden="true">{g >= 0 ? g + 1 : "·"}</span>
              {hint === i && <small>提示</small>}
              {g >= 0 && opposite(p, g, i) < 0 && <b aria-hidden="true">!</b>}
            </button>
          ))}
          {p.centers.map(([x, y], g) => (
            <span
              key={g}
              className={`galaxies-dot ${selected === g ? "active" : ""}`}
              style={{
                left: `${(x / (p.size * 2)) * 100}%`,
                top: `${(y / (p.size * 2)) * 100}%`,
              }}
              aria-hidden="true"
            >
              ✦<b>{g + 1}</b>
            </span>
          ))}
        </div>
        <div className="galaxies-legend">
          <span>✦ 编号星心</span>
          <span>· 待归队</span>
          <span>粗线：星系边界</span>
        </div>
        <p className="galaxies-message" role="status">
          {message}
        </p>
      </section>
      <aside className="galaxies-notes">
        <span className="galaxies-eyebrow">SPIRAL GALAXIES · 星图手记</span>
        <h3>绕一颗星，转半圈</h3>
        <ol>
          <li>每格属于一个星系；每个星系只围绕自己的编号星心。</li>
          <li>同一星系必须上下左右连通，斜角接触不算。</li>
          <li>绕星心旋转 180° 后形状完全重合，不能越出棋盘。</li>
          <li>星心可在格中、边中或交点。紧贴它的固定格都属于它。</li>
        </ol>
        <p>
          同编号使用同色，编号始终可见。星心上点击可快速选色；其他格再点同编号可清除。
        </p>
        <p>
          点击或 Enter /
          空格操作，方向键移动焦点。提示仅建议下一格；暂停、撤销与重来在上方。
        </p>
        <p>
          「当前对称」也检查连通，只计算已归队的格子。暂未对称或连通很正常；填满后全部符合规则才过关。
        </p>
        <p className="galaxies-save">
          {saved
            ? "当前星图已保存在本机。保留最近 2000 个局面。"
            : "当前无法保存，离开后可能丢失这局。"}
        </p>
      </aside>
    </div>
  );
}
