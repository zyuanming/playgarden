import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import { akariLevels } from "./akariLevels";
import {
  AKARI_SAVE,
  changeAkari,
  inspectAkari,
  neighbors,
  parseAkariSave,
  solveAkari,
} from "./akariLogic";
import "./akariGarden.css";
const chapters = ["初见灯光", "隔墙相望", "交错光径", "夜园全亮"];
const lessons = [
  "灯照亮自己与上下左右，遇墙停下。先看看数字墙旁边。",
  "两盏灯不能隔空相望。墙能挡光，空格不能。",
  "数字只数上下左右的邻灯。斜角的灯不计入。",
  "把光线覆盖、邻灯数与互不相照放在一起考虑。",
];
const intro =
  "点白格放灯，再点取下；切到标记模式可画 ×。照亮全部白格，灯不互照，数字墙旁灯数恰好相等。";
export default function AkariGarden(props: GameProps) {
  const key = `${props.level}:${props.resetToken}`,
    round = useRef({ key, level: props.level, fresh: false });
  if (round.current.key !== key)
    round.current = {
      key,
      level: props.level,
      fresh: round.current.level === props.level,
    };
  return (
    <AkariRound
      key={key}
      {...props}
      freshStart={props.freshStart || round.current.fresh}
    />
  );
}
function AkariRound({
  level,
  paused,
  freshStart,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const p = akariLevels[level] ?? akariLevels[0];
  const [history, setHistory] = useState(() => {
    try {
      return parseAkariSave(
        freshStart
          ? null
          : localStorage.getItem(`${AKARI_SAVE}.round.${level}`),
        p,
      );
    } catch {
      return parseAkariSave(null, p);
    }
  });
  const state = history[history.length - 1],
    check = inspectAkari(p, state),
    blocked = paused || check.won;
  const [mode, setMode] = useState<"lamp" | "mark">("lamp"),
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
        `${AKARI_SAVE}.round.${level}`,
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
      report("夜园全亮！每一盏灯都找到了自己的位置。");
      callbacks.current.onComplete();
    }
  }, [check.won, paused]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (blocked) return;
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
    setHint(null);
    report("已撤销一步。可以换个位置试试。");
  }, [undoToken, blocked]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (blocked) return;
    const answer = solveAkari(p, state);
    setHint(null);
    if (answer.kind === "budget")
      report("搜索达到预算，暂时没有可靠建议；这不代表无解。");
    else if (answer.kind === "none")
      report(
        "当前灯或 × 标记与所有规则不相容。试着撤销最近一步，或取下互相照到的灯。",
      );
    else {
      const next = answer.cells.find((i) => state[i] !== 1);
      if (next !== undefined) {
        setHint(next);
        report(
          `试着在${coord(next)}放灯：它与当前所有标记兼容，并能通向完整解。只标出下一步，由你决定。`,
        );
        cells.current[next]?.focus({ preventScroll: true });
      }
    }
  }, [hintToken, blocked, p, state]);
  function edit(i: number) {
    if (blocked) return;
    const value =
        mode === "lamp" ? (state[i] === 1 ? 0 : 1) : state[i] === 2 ? 0 : 2,
      next = changeAkari(p, state, i, value);
    if (next === state) return;
    setHistory((h) => [...h, next]);
    setHint(null);
    const c = inspectAkari(p, next);
    report(
      c.clashes.length
        ? `有 ${c.clashes.length} 盏灯互相照到。带 ! 的灯需要调整。`
        : `${coord(i)}${value === 1 ? "放了灯" : value === 2 ? "标记为不放灯" : "已清空"}。还有 ${c.dark.length} 格未照亮。`,
    );
  }
  function navigate(i: number, key: string) {
    let next = i;
    const delta =
      key === "ArrowLeft"
        ? -1
        : key === "ArrowRight"
          ? 1
          : key === "ArrowUp"
            ? -p.size
            : key === "ArrowDown"
              ? p.size
              : 0;
    if (!delta) return false;
    do {
      const prev = next;
      next += delta;
      if (
        next < 0 ||
        next >= p.board.length ||
        (Math.abs(delta) === 1 &&
          Math.floor(prev / p.size) !== Math.floor(next / p.size))
      )
        return true;
    } while (p.board[next] !== ".");
    cells.current[next]?.focus();
    return true;
  }
  return (
    <div
      className="akari-layout"
      data-akari-id={p.id}
      data-akari-state={state.join("")}
      data-akari-won={check.won}
      onKeyDown={(e) => {
        if (
          (e.ctrlKey || e.metaKey || e.altKey) &&
          ["Enter", " "].includes(e.key)
        )
          e.preventDefault();
      }}
    >
      <section className="akari-play" aria-label="灯照花园棋局">
        <header className="akari-heading">
          <div>
            <span className="akari-eyebrow">
              第 {p.chapter + 1} 章 · {chapters[p.chapter]}
            </span>
            <h3>{p.title}</h3>
          </div>
          <span>
            {String(level + 1).padStart(2, "0")} / {akariLevels.length}
          </span>
        </header>
        <p>{lessons[p.chapter]}</p>
        <div className="akari-stats">
          <span>
            未亮 <strong>{check.dark.length}</strong> 格
          </span>
          <span>
            互照 <strong>{check.clashes.length}</strong> 盏
          </span>
          <span>
            数字待满足 <strong>{check.wrong.length}</strong>
          </span>
        </div>
        <div className="akari-tools" role="group" aria-label="编辑模式">
          <button
            type="button"
            aria-pressed={mode === "lamp"}
            disabled={blocked}
            onClick={() => setMode("lamp")}
          >
            ☀ 放灯 / 取下
          </button>
          <button
            type="button"
            aria-pressed={mode === "mark"}
            disabled={blocked}
            onClick={() => setMode("mark")}
          >
            × 标记 / 清除
          </button>
        </div>
        <div
          className="akari-board"
          style={{ "--akari-size": p.size } as CSSProperties}
          role="group"
          aria-label={`${p.size}乘${p.size}灯照棋盘`}
        >
          {p.board.split("").map((c, i) =>
            c !== "." ? (
              <div
                key={i}
                className={`akari-wall ${c !== "#" ? (check.wrong.includes(i) ? "pending" : "satisfied") : ""}`}
                aria-label={`${coord(i)}${c === "#" ? "墙" : `数字墙${c}，已有${neighbors(p, i).filter((j) => state[j] === 1).length}盏邻灯`}`}
              >
                <span>{c === "#" ? "" : c}</span>
                {c !== "#" && (
                  <small>
                    {neighbors(p, i).filter((j) => state[j] === 1).length}/{c}
                  </small>
                )}
              </div>
            ) : (
              <button
                key={i}
                ref={(el) => {
                  cells.current[i] = el;
                }}
                type="button"
                className={`akari-cell ${check.light[i] ? "lit" : "dark"} ${state[i] === 1 ? "bulb" : ""} ${check.clashes.includes(i) ? "clash" : ""} ${hint === i ? "hint" : ""}`}
                aria-label={`${coord(i)}，${state[i] === 1 ? "灯" : state[i] === 2 ? "叉标记" : "空格"}，${check.light[i] ? "已照亮" : "未照亮"}${check.clashes.includes(i) ? "，互照冲突" : ""}`}
                data-cell={i}
                disabled={blocked}
                onClick={() => edit(i)}
                onKeyDown={(e) => {
                  if (e.ctrlKey || e.metaKey || e.altKey) return;
                  if (navigate(i, e.key)) e.preventDefault();
                }}
              >
                <span aria-hidden="true">
                  {state[i] === 1
                    ? "☀"
                    : state[i] === 2
                      ? "×"
                      : check.light[i]
                        ? "·"
                        : ""}
                </span>
                {check.clashes.includes(i) && <b aria-hidden="true">!</b>}
                {hint === i && <small aria-hidden="true">提示</small>}
              </button>
            ),
          )}
        </div>
        <div className="akari-legend">
          <span>☀ 灯</span>
          <span>· 已亮</span>
          <span>× 自己的笔记</span>
          <span>! 互照冲突</span>
        </div>
        <p className="akari-message" role="status">
          {message}
        </p>
      </section>
      <aside className="akari-notes">
        <span className="akari-eyebrow">LIGHT UP · 夜园手记</span>
        <h3>一盏灯，一条光径</h3>
        <ol>
          <li>灯照亮自己和上下左右，遇到墙才停。</li>
          <li>任何两盏灯都不能在无遮挡的同一行或列相望。</li>
          <li>数字墙上下左右的灯数，必须恰好等于数字；斜角不算。</li>
          <li>照亮所有白格就能过关。× 只是笔记，不必填满。</li>
        </ol>
        <p>点击或 Enter / 空格操作。方向键移动焦点。可随时暂停、撤销、重来。</p>
        <p>提示只给下一步。数字下方的「已有 / 需要」帮你核对线索。</p>
        <p className="akari-save">
          {saved
            ? "当前棋局已保存在本机。"
            : "当前无法保存，离开后可能丢失这局。"}
        </p>
      </aside>
    </div>
  );
}
