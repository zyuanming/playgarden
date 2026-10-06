// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 YuanMing; Playgarden original contributions.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { GameProps } from "../lib/types";
import { xiangqiChapters, xiangqiLevels } from "./xiangqiLevels";
import {
  START_FEN,
  initialPosition,
  playMove,
  undoMoves,
  squareName,
  squareIndex,
  pieceName,
  colorName,
  resultText,
  type Position,
} from "./xiangqiLogic";
import { practiceResult } from "./xiangqiPractice";
import { simpleMove } from "./xiangqiAi";
import {
  XIANGQI_KEY,
  defaultSettings,
  isMatchSettings,
  loadRound,
  saveRound,
  type MatchSettings,
} from "./xiangqiStorage";
import type { XiangqiRequest, XiangqiReply } from "./xiangqi.worker";
import "./xiangqiGarden.css";
function savedSettings(): MatchSettings {
  try {
    const data = JSON.parse(
      localStorage.getItem(`${XIANGQI_KEY}.settings`) ?? "null",
    );
    if (isMatchSettings(data)) return data;
  } catch {
    /* Optional storage. */
  }
  return { ...defaultSettings };
}
export default function XiangqiGarden(props: GameProps) {
  const key = `${props.freePlay}:${props.level}:${props.resetToken}`;
  const previous = useRef({ key, fresh: false });
  if (previous.current.key !== key) previous.current = { key, fresh: true };
  return (
    <XiangqiRound
      key={key}
      {...props}
      fresh={Boolean(props.freshStart || previous.current.fresh)}
    />
  );
}
function XiangqiRound({
  level,
  freePlay = false,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
  fresh,
}: GameProps & { fresh: boolean }) {
  const puzzle = xiangqiLevels[level] ?? xiangqiLevels[0];
  const initial = freePlay ? START_FEN : puzzle.fen,
    puzzleId = freePlay ? "free" : puzzle.id;
  const [loaded] = useState(() => {
    const save = loadRound(level, freePlay, initial, puzzleId);
    const invalidPractice = !freePlay && save.position.moves.length > 1;
    return fresh || invalidPractice
      ? {
          position: initialPosition(initial)!,
          settings: savedSettings(),
          restored: false,
          invalid: invalidPractice,
        }
      : save;
  });
  const [position, setPosition] = useState(loaded.position);
  const [settings, setSettings] = useState(loaded.settings);
  const [draft, setDraft] = useState(loaded.settings);
  const [selected, setSelected] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [cursor, setCursor] = useState(85);
  const [flipped, setFlipped] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [saved, setSaved] = useState(true);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [replacing, setReplacing] = useState(false);
  const [message, setMessage] = useState(
    loaded.invalid
      ? "这份棋谱无法还原，已准备一盘新棋。"
      : loaded.restored
        ? `已接上这盘棋，共 ${loaded.position.moves.length} 手。`
        : freePlay
          ? "红方先行。先选棋子，再选落点，确认后才走棋。"
          : puzzle.goal,
  );
  const current = useRef(position);
  current.current = position;
  const selection = useRef({ selected, target });
  selection.current = { selected, target };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pauseRef = useRef(paused || hidden);
  pauseRef.current = paused || hidden;
  const generation = useRef(0),
    alive = useRef(true),
    completed = useRef(false);
  const tokens = useRef({ hintToken, undoToken });
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = freePlay ? "ready" : practiceResult(puzzle, position);
  const locked =
    paused ||
    hidden ||
    !!position.result ||
    (!freePlay && stage !== "ready") ||
    (freePlay &&
      settings.mode === "computer" &&
      position.turn !== settings.human);
  const possible = new Set(
    selected === null
      ? []
      : position.legal
          .filter((m) => m.startsWith(squareName(selected)))
          .map((m) => squareIndex(m.slice(2))),
  );
  const last = position.moves.at(-1);
  const lastFrom = last ? squareIndex(last.slice(0, 2)) : -1,
    lastTo = last ? squareIndex(last.slice(2)) : -1;
  function report(text: string) {
    setMessage(text);
    callbacks.current.onStatus(text);
  }
  function clearSelection() {
    selection.current = { selected: null, target: null };
    setSelected(null);
    setTarget(null);
  }
  function commit(next: Position) {
    current.current = next;
    setPosition(next);
    clearSelection();
    setReplacing(false);
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    callbacks.current.onStatus(message);
  }, []);
  useEffect(() => {
    setSaved(saveRound(level, freePlay, puzzleId, position, settings));
    try {
      if (freePlay)
        localStorage.setItem(
          `${XIANGQI_KEY}.settings`,
          JSON.stringify(settings),
        );
    } catch {
      /* Save status reports failure. */
    }
  }, [position, settings, level, freePlay, puzzleId]);
  useEffect(() => {
    if (!freePlay && stage === "success" && !paused && !completed.current) {
      completed.current = true;
      report(
        puzzle.objective === "stalemate"
          ? "困毙也判负。这一手，练习完成！"
          : "这一手达到了目标，练习完成！",
      );
      callbacks.current.onComplete();
    }
  }, [stage, paused, freePlay]);
  useEffect(() => {
    const id = ++generation.current;
    setThinking(false);
    if (
      paused ||
      hidden ||
      !freePlay ||
      position.result ||
      settings.mode !== "computer" ||
      position.turn === settings.human
    )
      return;
    setThinking(true);
    let worker: Worker | null = null,
      watchdog: ReturnType<typeof setTimeout> | undefined,
      handled = false;
    const signature = JSON.stringify([position.initial, position.moves]);
    const valid = () =>
      alive.current &&
      !pauseRef.current &&
      !document.hidden &&
      !handled &&
      id === generation.current &&
      JSON.stringify([current.current.initial, current.current.moves]) ===
        signature;
    const finish = (move: string | null, compatible = false) => {
      if (!valid()) return;
      handled = true;
      worker?.terminate();
      if (watchdog) clearTimeout(watchdog);
      setThinking(false);
      if (compatible) setFallback(true);
      const next =
        move === null ? current.current : playMove(current.current, move);
      if (next === current.current) {
        report("电脑暂时没能走棋，可以悔棋或重新开局。");
        return;
      }
      commit(next);
      report(
        next.result
          ? resultText(next)
          : `电脑走了 ${move!.slice(0, 2)} → ${move!.slice(2)}。${resultText(next)}。`,
      );
    };
    const timer = setTimeout(() => {
      if (!valid()) return;
      try {
        worker = new Worker(new URL("./xiangqi.worker.ts", import.meta.url), {
          type: "module",
        });
        worker.onmessage = (event: MessageEvent<XiangqiReply>) => {
          const reply = event.data;
          if (
            !valid() ||
            !reply ||
            reply.requestId !== id ||
            !Array.isArray(reply.moves) ||
            JSON.stringify([reply.initial, reply.moves]) !== signature
          )
            return;
          if (
            reply.error ||
            !reply.move ||
            !current.current.legal.includes(reply.move)
          )
            finish(simpleMove(current.current), true);
          else finish(reply.move);
        };
        worker.onerror = (event) => {
          event.preventDefault();
          if (valid()) finish(simpleMove(current.current), true);
        };
        worker.postMessage({
          requestId: id,
          initial: position.initial,
          moves: [...position.moves],
        } satisfies XiangqiRequest);
        watchdog = setTimeout(() => {
          if (valid()) finish(simpleMove(current.current), true);
        }, 1600);
      } catch {
        if (valid()) finish(simpleMove(current.current), true);
      }
    }, 260);
    return () => {
      handled = true;
      clearTimeout(timer);
      if (watchdog) clearTimeout(watchdog);
      worker?.terminate();
    };
  }, [position, settings, paused, hidden, freePlay]);
  function canPlay() {
    const p = current.current;
    return (
      !pauseRef.current &&
      !document.hidden &&
      !p.result &&
      (freePlay
        ? settingsRef.current.mode === "local" ||
          p.turn === settingsRef.current.human
        : practiceResult(puzzle, p) === "ready")
    );
  }
  function choose(index: number) {
    if (!canPlay()) return;
    setCursor(index);
    const p = current.current,
      piece = p.board[index],
      from = selection.current.selected;
    if (piece?.color === p.turn) {
      selection.current = { selected: index, target: null };
      setSelected(index);
      setTarget(null);
      report(
        `已选${colorName(piece.color)}${pieceName(piece)} · ${squareName(index)}。请选择标记出的合法落点。`,
      );
      return;
    }
    if (
      from !== null &&
      p.legal.includes(squareName(from) + squareName(index))
    ) {
      selection.current = { selected: from, target: index };
      setTarget(index);
      report(`准备 ${squareName(from)} → ${squareName(index)}。确认后才走棋。`);
      return;
    }
    report(
      from === null
        ? "先选一枚轮到的一方的棋子。"
        : "这里不是合法落点。请看棋盘上的小点或可吃棋子的外圈。",
    );
  }
  function confirm() {
    if (!canPlay()) return;
    const { selected: from, target: to } = selection.current;
    if (from === null || to === null) return;
    const move = squareName(from) + squareName(to),
      next = playMove(current.current, move);
    if (next === current.current) return;
    commit(next);
    if (!freePlay && practiceResult(puzzle, next) === "retry")
      report("这是合法走法，但还没有达到这一题的目标。撤销后再想一手吧。");
    else if (freePlay)
      report(
        next.result
          ? resultText(next)
          : `${move.slice(0, 2)} → ${move.slice(2)}。${resultText(next)}。`,
      );
  }
  function undo() {
    if (
      pauseRef.current ||
      (!freePlay && practiceResult(puzzle, current.current) === "success")
    )
      return;
    const p = current.current;
    let count = 1;
    if (freePlay && settingsRef.current.mode === "computer") {
      let i = p.moves.length - 1;
      const initialTurn = p.initial.split(" ")[1];
      while (
        i >= 0 &&
        (i % 2 === 0 ? initialTurn : initialTurn === "r" ? "b" : "r") !==
          settingsRef.current.human
      )
        i--;
      count = i < 0 ? 0 : p.moves.length - i;
    }
    if (!count || !p.moves.length) {
      report("还没有可以悔回的一手。");
      return;
    }
    generation.current++;
    commit(undoMoves(p, count));
    report(freePlay ? "已悔回上一次决定。慢慢想，不赶时间。" : puzzle.goal);
  }
  function hint() {
    if (pauseRef.current) return;
    report(
      freePlay
        ? "先确认将帅是否安全，再看有没有能吃掉而不吃亏的棋子。选中棋子后，圆点与外圈会标出所有合法落点。"
        : puzzle.hint,
    );
  }
  useEffect(() => {
    if (tokens.current.undoToken !== undoToken) {
      tokens.current.undoToken = undoToken;
      undo();
    }
    if (tokens.current.hintToken !== hintToken) {
      tokens.current.hintToken = hintToken;
      hint();
    }
  }, [undoToken, hintToken]);
  function startMatch() {
    if (pauseRef.current) return;
    generation.current++;
    settingsRef.current = draft;
    setSettings({ ...draft });
    completed.current = false;
    setFallback(false);
    commit(initialPosition()!);
    setCursor(85);
    report(
      draft.mode === "local"
        ? "本机双人已就位，红方先行。"
        : draft.human === "b"
          ? "你执黑棋，电脑先行。"
          : "你执红棋，先手由你。",
    );
  }
  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape" && selection.current.selected !== null) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        clearSelection();
        report("已取消选子。");
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!event.repeat) choose(index);
      return;
    }
    const visual = flipped ? 89 - index : index,
      r = Math.floor(visual / 9),
      c = visual % 9;
    let next = visual;
    if (event.key === "ArrowLeft") next = r * 9 + Math.max(0, c - 1);
    else if (event.key === "ArrowRight") next = r * 9 + Math.min(8, c + 1);
    else if (event.key === "ArrowUp") next = Math.max(0, r - 1) * 9 + c;
    else if (event.key === "ArrowDown") next = Math.min(9, r + 1) * 9 + c;
    else if (event.key === "Home") next = r * 9;
    else if (event.key === "End") next = r * 9 + 8;
    else return;
    event.preventDefault();
    const canonical = flipped ? 89 - next : next;
    setCursor(canonical);
    const button = buttons.current[canonical];
    button?.focus({ preventScroll: true });
    button?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
  const turnText =
    !freePlay && stage === "success"
      ? "练习完成"
      : !freePlay && stage === "retry"
        ? "再想一手"
        : thinking
          ? "电脑正在想一手…"
          : resultText(position);
  return (
    <section
      className="xiangqi-garden"
      aria-label="中国象棋"
      data-xiangqi-moves={position.moves.length}
      data-xiangqi-turn={position.turn}
      data-xiangqi-result={position.result ?? ""}
      data-xiangqi-stage={stage}
      data-xiangqi-thinking={thinking}
      data-xiangqi-won={stage === "success"}
    >
      <div className="xiangqi-intro">
        <span className="xiangqi-kicker">XIANGQI · 河畔棋局</span>
        <h2>{freePlay ? "隔一条河，走一步好棋。" : puzzle.title}</h2>
        <p>
          {freePlay
            ? "红方先行，选一枚棋子，看看它能走向哪里。"
            : `${xiangqiChapters[puzzle.chapter - 1].title} · ${puzzle.goal}`}
        </p>
      </div>
      <div className="xiangqi-layout">
        <div className="xiangqi-play-area">
          <div className="xiangqi-turn" aria-live="polite">
            <span
              className={`xiangqi-side ${position.turn}`}
              aria-hidden="true"
            >
              {position.turn === "r" ? "帥" : "將"}
            </span>
            <strong>{turnText}</strong>
            <span>已走 {position.moves.length} 手</span>
          </div>
          <div className="xiangqi-board-tools">
            <button
              onClick={() => {
                clearSelection();
                setFlipped(!flipped);
              }}
              aria-pressed={flipped}
            >
              翻转棋盘
            </button>
            <button onClick={() => setZoomed(!zoomed)} aria-pressed={zoomed}>
              {zoomed ? "适合屏幕" : "放大棋盘"}
            </button>
          </div>
          <div
            className="xiangqi-board-scroll"
            tabIndex={zoomed ? 0 : -1}
            aria-label={zoomed ? "放大的棋盘，可左右滚动" : "棋盘区域"}
          >
            <div className={`xiangqi-board-frame ${zoomed ? "zoomed" : ""}`}>
              <div className="xiangqi-coordinate-top" aria-hidden="true">
                {[...(flipped ? "ihgfedcba" : "abcdefghi")].map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <div
                className="xiangqi-board"
                role="grid"
                aria-label="九路十行象棋盘，方向键移动，Enter 或空格选子与选落点"
                aria-rowcount={10}
                aria-colcount={9}
                aria-disabled={locked}
              >
                <svg
                  className="xiangqi-lines"
                  viewBox="0 0 900 1000"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <path key={`h${i}`} d={`M50 ${50 + i * 100} H850`} />
                  ))}
                  {Array.from({ length: 9 }, (_, i) => (
                    <path
                      key={`v${i}`}
                      d={
                        i === 0 || i === 8
                          ? `M${50 + i * 100} 50 V950`
                          : `M${50 + i * 100} 50 V450 M${50 + i * 100} 550 V950`
                      }
                    />
                  ))}
                  <path d="M350 50 L550 250 M550 50 L350 250 M350 750 L550 950 M550 750 L350 950" />
                  <text x="260" y="510">
                    楚 河
                  </text>
                  <text x="640" y="510">
                    漢 界
                  </text>
                </svg>
                {Array.from({ length: 10 }, (_, r) => (
                  <div className="xiangqi-row" role="row" key={r}>
                    <span className="xiangqi-rank" aria-hidden="true">
                      {flipped ? r : 9 - r}
                    </span>
                    {Array.from({ length: 9 }, (_, c) => {
                      const index = flipped ? 89 - (r * 9 + c) : r * 9 + c,
                        piece = position.board[index];
                      const legal = possible.has(index),
                        selectedHere = selected === index,
                        targetHere = target === index;
                      return (
                        <button
                          key={index}
                          ref={(el) => {
                            buttons.current[index] = el;
                          }}
                          role="gridcell"
                          aria-rowindex={r + 1}
                          aria-colindex={c + 1}
                          aria-selected={selectedHere || targetHere}
                          aria-disabled={locked}
                          aria-label={`${squareName(index)}，${piece ? colorName(piece.color) + pieceName(piece) : "空位"}${selectedHere ? "，已选棋子" : ""}${legal ? "，合法落点" : ""}${index === lastTo ? "，最后一手落点" : ""}${piece?.type === "k" && piece.color === position.turn && position.check ? "，被将军" : ""}`}
                          tabIndex={cursor === index ? 0 : -1}
                          onFocus={() => setCursor(index)}
                          onKeyDown={(e) => onKey(e, index)}
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.altKey)
                              choose(index);
                          }}
                          className={`xiangqi-point ${selectedHere ? "selected" : ""} ${targetHere ? "target" : ""} ${legal ? "legal" : ""} ${index === lastFrom || index === lastTo ? "last" : ""}`}
                          data-xiangqi-square={squareName(index)}
                        >
                          {piece ? (
                            <span
                              className={`xiangqi-piece ${piece.color} ${piece.type === "k" && piece.color === position.turn && position.check ? "checked" : ""}`}
                              aria-hidden="true"
                            >
                              {pieceName(piece)}
                              {index === lastTo && <i />}
                            </span>
                          ) : legal ? (
                            <span
                              className="xiangqi-legal-dot"
                              aria-hidden="true"
                            />
                          ) : null}
                          {targetHere && (
                            <span
                              className="xiangqi-target-label"
                              aria-hidden="true"
                            >
                              落
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="xiangqi-coordinate-bottom" aria-hidden="true">
                {flipped
                  ? "黑方在下 · 坐标保持不变"
                  : "红方在下 · a 至 i 为列，0 至 9 为行"}
              </div>
            </div>
          </div>
          <div className="xiangqi-confirm">
            <p>
              {selected === null
                ? "先选棋子，再选落点。"
                : target === null
                  ? `已选 ${squareName(selected)} · 看看合法落点`
                  : `准备 ${squareName(selected)} → ${squareName(target)}`}
            </p>
            <button
              className="xiangqi-primary"
              disabled={locked || target === null}
              onClick={confirm}
            >
              确认走棋
            </button>
          </div>
          <p className="xiangqi-keyboard">
            方向键移动 · Enter / 空格选择 · Esc 取消选子 / 暂停
          </p>
        </div>
        <aside className="xiangqi-sidebar">
          {freePlay ? (
            <div className="xiangqi-panel">
              <h3>一起下盘棋</h3>
              <fieldset disabled={paused || hidden}>
                <label>
                  对手
                  <select
                    aria-label="对手"
                    value={draft.mode}
                    onChange={(e) => {
                      setDraft({
                        ...draft,
                        mode: e.target.value as MatchSettings["mode"],
                      });
                      setReplacing(false);
                    }}
                  >
                    <option value="computer">电脑陪练</option>
                    <option value="local">本机双人</option>
                  </select>
                </label>
                {draft.mode === "computer" && (
                  <label>
                    你的棋子
                    <select
                      aria-label="你的棋子"
                      value={draft.human}
                      onChange={(e) => {
                        setDraft({
                          ...draft,
                          human: e.target.value as MatchSettings["human"],
                        });
                        setReplacing(false);
                      }}
                    >
                      <option value="r">红方 · 先手</option>
                      <option value="b">黑方 · 后手</option>
                    </select>
                  </label>
                )}
                <button
                  onClick={() =>
                    position.moves.length && !replacing
                      ? setReplacing(true)
                      : startMatch()
                  }
                >
                  {replacing ? "确认结束这局并开新局" : "按设置开新局"}
                </button>
                {replacing && (
                  <button onClick={() => setReplacing(false)}>保留这局</button>
                )}
              </fieldset>
              <p className="xiangqi-small">
                当前：
                {settings.mode === "local"
                  ? "本机双人"
                  : `你执${colorName(settings.human)}`}
                。离线电脑只作入门陪练，会有疏漏。
              </p>
              {fallback && (
                <p className="xiangqi-notice">
                  正在使用简易兼容陪练，只选择合法走法，不作深入搜索。
                </p>
              )}
            </div>
          ) : (
            <div className="xiangqi-panel">
              <span className="xiangqi-chapter">
                第 {puzzle.chapter} 章 / 共 {xiangqiChapters.length} 章
              </span>
              <h3>这一手，练什么？</h3>
              <p>{puzzle.goal}</p>
              <p>
                你执红方。一手练习，可反复撤销尝试；所有满足目标的走法都接受。
              </p>
              <button disabled={paused || stage === "success"} onClick={hint}>
                想法提示
              </button>
              {stage === "retry" && (
                <button
                  className="xiangqi-primary"
                  disabled={paused}
                  onClick={undo}
                >
                  撤销，再想一手
                </button>
              )}
            </div>
          )}
          <div className="xiangqi-rule-note">
            <strong>休闲对弈规则</strong>
            <p>
              同一局面连同行棋方第三次出现即和棋；连续 120
              手无吃子也和棋。不含比赛中的长将、长捉责任裁决。
            </p>
          </div>
          <details className="xiangqi-rules">
            <summary>棋子怎么走？</summary>
            <ul>
              <li>车走直线，不能越子；炮走直线，吃子要隔恰好一个炮架。</li>
              <li>马走日，先检查马腿；相象走田，不能塞象眼、不能过河。</li>
              <li>仕士走斜一格，帅将走直一格，都不能离开九宫。</li>
              <li>兵卒向前一格；过河后可横走，不能后退。</li>
              <li>将帅不能照面，不能让自己被将军。被将军时必须先化解。</li>
              <li>
                将死或无棋可走（困毙）均判负；终局先判胜负，再判断休闲和棋。
              </li>
              <li>电脑对局悔回你最近一手及电脑回应；双人对局悔一手。</li>
            </ul>
          </details>
          {position.moves.length > 0 && (
            <div className="xiangqi-history">
              <h3>最近的棋谱</h3>
              <ol start={Math.max(1, position.moves.length - 5)}>
                {position.moves.slice(-6).map((m, i) => (
                  <li key={`${position.moves.length}-${i}`}>
                    {m.slice(0, 2)} <span>→</span> {m.slice(2)}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <p className="xiangqi-save">
            {saved
              ? "完整棋谱仅保存在此浏览器，离开后可以接着下。"
              : "当前浏览器无法保存棋谱，仍可继续游玩。"}
          </p>
        </aside>
      </div>
      <p className="xiangqi-feedback" role="status">
        {message}
      </p>
    </section>
  );
}
