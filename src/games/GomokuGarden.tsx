import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { GameProps } from "../lib/types";
import { gomokuChapters, gomokuLevels } from "./gomokuLevels";
import {
  emptyPosition,
  opponent,
  playMove,
  pointName,
  replayMoves,
  undoMoves,
  type Position,
  type Stone,
} from "./gomokuLogic";
import {
  practiceResult,
  validPracticeRound,
  nextPracticePosition,
  simpleMove,
} from "./gomokuPractice";
import {
  GOMOKU_KEY,
  defaultSettings,
  isMatchSettings,
  loadRound,
  saveRound,
  type MatchSettings,
} from "./gomokuStorage";
import type { GomokuReply, GomokuRequest } from "./gomoku.worker";
import "./gomokuGarden.css";

const stoneName = (stone: Stone) => (stone === 1 ? "黑棋" : "白棋");
const stars = [48, 56, 112, 168, 176];
const letters = "ABCDEFGHIJKLMNO";
function savedSettings(): MatchSettings {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(`${GOMOKU_KEY}.settings`) ?? "null",
    );
    if (isMatchSettings(parsed)) return parsed;
  } catch {
    /* Storage is optional. */
  }
  return { ...defaultSettings };
}
export default function GomokuGarden(props: GameProps) {
  const key = `${props.freePlay}:${props.level}:${props.resetToken}`;
  const previous = useRef({ key, fresh: false });
  if (key !== previous.current.key) previous.current = { key, fresh: true };
  return (
    <GomokuRound
      key={key}
      {...props}
      fresh={Boolean(props.freshStart || previous.current.fresh)}
    />
  );
}
function GomokuRound({
  level,
  freePlay = false,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
  fresh,
}: GameProps & { fresh: boolean }) {
  const puzzle = gomokuLevels[level] ?? gomokuLevels[0];
  const initial = freePlay ? [] : puzzle.moves;
  const puzzleId = freePlay ? "free" : puzzle.id;
  const [loaded] = useState(() => {
    const save = loadRound(level, freePlay, initial, puzzleId);
    const invalidPractice =
      !freePlay && !validPracticeRound(puzzle, save.position);
    return fresh || invalidPractice
      ? {
          position: replayMoves(initial) ?? emptyPosition(),
          settings: savedSettings(),
          restored: false,
          invalid: invalidPractice,
        }
      : save;
  });
  const [position, setPosition] = useState(loaded.position);
  const [settings, setSettings] = useState<MatchSettings>(loaded.settings);
  const [draft, setDraft] = useState<MatchSettings>(loaded.settings);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState(112);
  const [thinking, setThinking] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [saved, setSaved] = useState(true);
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );
  const [replacing, setReplacing] = useState(false);
  const [message, setMessage] = useState(() =>
    loaded.invalid
      ? "这份存档无法还原，已准备一盘新棋。"
      : loaded.restored
        ? `已接上这盘棋，共 ${loaded.position.moves.length} 手。`
        : freePlay
          ? "黑棋先行。先点交叉点预览，再按“确认落子”。"
          : puzzle.goal,
  );
  const current = useRef(position);
  current.current = position;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pauseRef = useRef(paused || hidden);
  pauseRef.current = paused || hidden;
  const generation = useRef(0);
  const alive = useRef(true);
  const complete = useRef(false);
  const tokens = useRef({ hintToken, undoToken });
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = freePlay ? "ready" : practiceResult(puzzle, position);
  const player: Stone = freePlay
    ? settings.human
    : initial.length % 2 === 0
      ? 1
      : 2;
  const finished = !!position.winner || position.draw;
  const locked =
    paused ||
    hidden ||
    (!freePlay &&
      (stage === "success" || stage === "retry" || stage === "responding")) ||
    finished ||
    (freePlay &&
      settings.mode === "computer" &&
      position.turn !== settings.human);
  const winPoints = new Set(position.winningLines.flat());
  const last = position.moves.at(-1);
  const turnText = finished
    ? position.winner
      ? `${stoneName(position.winner)}获胜`
      : "棋盘已满 · 和棋"
    : !freePlay && stage === "success"
      ? "练习完成"
      : !freePlay && stage === "retry"
        ? "再想一手"
        : thinking
          ? "电脑正在想一手…"
          : `轮到${stoneName(position.turn)}`;

  function report(text: string) {
    setMessage(text);
    callbacks.current.onStatus(text);
  }
  function commit(next: Position) {
    current.current = next;
    selectedRef.current = null;
    setPosition(next);
    setSelected(null);
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
          `${GOMOKU_KEY}.settings`,
          JSON.stringify(settings),
        );
    } catch {
      /* Reported by the round save. */
    }
  }, [position, settings, level, freePlay, puzzleId]);
  useEffect(() => {
    if (!freePlay && stage === "success" && !paused && !complete.current) {
      complete.current = true;
      report(
        puzzle.objective === "two"
          ? "两边都留下机会，挡住一处，另一处就能成五。练习完成！"
          : puzzle.objective === "defend"
            ? "这一手挡住了所有立即成五的点。练习完成！"
            : puzzle.objective === "fork"
              ? "同一手留下了两处成五机会。练习完成！"
              : "连成至少五子，练习完成！",
      );
      callbacks.current.onComplete();
    }
  }, [stage, paused, freePlay]);

  // Each position has its own cancellable task. Cleanup also stops CPU work,
  // rather than merely ignoring a stale reply after restart, undo or navigation.
  useEffect(() => {
    const id = ++generation.current;
    setThinking(false);
    if (
      paused ||
      hidden ||
      finished ||
      (!freePlay && stage !== "responding") ||
      (freePlay &&
        (settings.mode !== "computer" || position.turn === settings.human))
    )
      return;
    setThinking(true);
    let worker: Worker | null = null;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let handled = false;
    const signature = position.moves.join(",");
    const valid = () =>
      alive.current &&
      !pauseRef.current &&
      !handled &&
      id === generation.current &&
      current.current.moves.join(",") === signature;
    const finish = (index: number | null, compatible = false) => {
      if (!valid()) return;
      handled = true;
      worker?.terminate();
      if (watchdog) clearTimeout(watchdog);
      setThinking(false);
      if (compatible) setFallback(true);
      const next = index === null ? position : playMove(current.current, index);
      if (next === current.current) {
        report("电脑暂时没能落子。可以撤销、重来，或用本机双人继续。 ");
        return;
      }
      commit(next);
      report(
        next.winner
          ? `${stoneName(next.winner)}连成至少五子，这局结束了。可以悔棋复盘，或重来一局。`
          : next.draw
            ? "棋盘已满，双方都没有成五，这局和棋。"
            : !freePlay
              ? "电脑挡住了一处。找找另一处成五点。"
              : `电脑落在 ${pointName(index!)}。轮到${stoneName(next.turn)}。`,
      );
    };
    const timer = setTimeout(() => {
      if (!valid()) return;
      if (!freePlay) {
        const next = nextPracticePosition(puzzle, position);
        finish(next.moves.at(-1) ?? null);
        return;
      }
      try {
        worker = new Worker(new URL("./gomoku.worker.ts", import.meta.url), {
          type: "module",
        });
        worker.onmessage = (event: MessageEvent<GomokuReply>) => {
          const reply = event.data;
          if (
            !valid() ||
            !reply ||
            reply.requestId !== id ||
            !Array.isArray(reply.moves) ||
            reply.moves.join(",") !== signature
          )
            return;
          if (
            reply.error ||
            reply.move === null ||
            playMove(current.current, reply.move) === current.current
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
          moves: [...position.moves],
          difficulty: settings.difficulty,
        } satisfies GomokuRequest);
        watchdog = setTimeout(() => {
          if (valid()) finish(simpleMove(current.current), true);
        }, 1800);
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
  }, [position, settings, paused, hidden, freePlay, stage]);

  function canPlay() {
    const p = current.current;
    const result = freePlay ? "ready" : practiceResult(puzzle, p);
    return (
      !pauseRef.current &&
      !p.winner &&
      !p.draw &&
      (!freePlay
        ? result === "ready" || result === "finish"
        : settingsRef.current.mode === "local" ||
          p.turn === settingsRef.current.human)
    );
  }
  function place(index: number) {
    if (!canPlay()) return;
    const next = playMove(current.current, index);
    if (next === current.current) {
      report("这里已经有棋子了，换一个空交叉点吧。");
      return;
    }
    commit(next);
    if (!freePlay) {
      const result = practiceResult(puzzle, next);
      if (result === "retry")
        report("这手还没有达到练习目标。可以撤销再试，或查看提示。 ");
      else if (result === "responding")
        report("留下了两个成五点。看看电脑会挡住哪一处。 ");
    } else
      report(
        next.winner
          ? `${stoneName(next.winner)}连成至少五子，这局结束了。可以悔棋复盘，或重来一局。`
          : next.draw
            ? "棋盘已满，双方都没有成五，这局和棋。"
            : `${stoneName(opponent(next.turn))}落在 ${pointName(index)}。轮到${stoneName(next.turn)}。`,
      );
  }
  function preview(index: number) {
    if (!canPlay()) return;
    setCursor(index);
    if (current.current.board[index]) {
      report(
        `${pointName(index)} 已有${stoneName(current.current.board[index] as Stone)}。请选择空点。`,
      );
      return;
    }
    selectedRef.current = index;
    setSelected(index);
  }
  function undo() {
    if (
      pauseRef.current ||
      (!freePlay && practiceResult(puzzle, current.current) === "success")
    )
      return;
    const p = current.current;
    const minimum = initial.length;
    let count = 1;
    if (!freePlay) count = p.moves.length - minimum;
    else if (settingsRef.current.mode === "computer") {
      const history = p.moves;
      // Undo back to the decision before the last human stone. The computer's
      // opening as black is kept when the human chose white.
      const humanTurn = settingsRef.current.human;
      let lastHuman = history.length - 1;
      while (lastHuman >= 0 && (lastHuman % 2 === 0 ? 1 : 2) !== humanTurn)
        lastHuman--;
      count = lastHuman < 0 ? 0 : history.length - lastHuman;
    }
    if (count <= 0 || p.moves.length <= minimum) {
      report("还没有可以悔回的落子。");
      return;
    }
    generation.current++;
    commit(undoMoves(p, Math.min(count, p.moves.length - minimum)));
    report(freePlay ? "已悔回上一次决定。慢慢想，不赶时间。" : puzzle.goal);
  }
  function hint() {
    if (pauseRef.current) return;
    if (!freePlay) {
      report(
        stage === "finish"
          ? "第一条路被挡住了，再找一处能连成五子的空点。"
          : puzzle.hint,
      );
      return;
    }
    report(
      "先找自己能立刻成五的点，再检查对手是否已有四子。没有紧急威胁时，试着留下两条发展的方向。提示不会代替你落子。",
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
    complete.current = false;
    setFallback(false);
    commit(emptyPosition());
    setCursor(112);
    report(
      draft.mode === "local"
        ? "本机双人已就位。黑棋先行，轮流下就好。"
        : draft.human === 2
          ? "你执白棋。电脑先行，请稍等一手。"
          : "你执黑棋，先手由你。 ",
    );
  }
  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const r = Math.floor(index / 15),
      c = index % 15;
    let next = index;
    if (event.key === "ArrowLeft") next = r * 15 + Math.max(0, c - 1);
    else if (event.key === "ArrowRight") next = r * 15 + Math.min(14, c + 1);
    else if (event.key === "ArrowUp") next = Math.max(0, r - 1) * 15 + c;
    else if (event.key === "ArrowDown") next = Math.min(14, r + 1) * 15 + c;
    else if (event.key === "Home") next = r * 15;
    else if (event.key === "End") next = r * 15 + 14;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!event.repeat) place(index);
      return;
    } else return;
    event.preventDefault();
    setCursor(next);
    buttons.current[next]?.focus({ preventScroll: true });
  }
  return (
    <section
      className="gomoku-garden"
      data-gomoku-moves={position.moves.length}
      data-gomoku-turn={position.turn}
      data-gomoku-winner={position.winner ?? ""}
      data-gomoku-stage={stage}
      data-gomoku-won={stage === "success"}
      data-gomoku-thinking={thinking}
      aria-label="自由五子棋"
    >
      <div className="gomoku-intro">
        <span className="gomoku-kicker">FIVE IN A ROW · 自由规则</span>
        <h2>{freePlay ? "一黑一白，慢慢想。" : puzzle.title}</h2>
        <p>
          {freePlay
            ? "在交叉点落子，横、竖或斜线连续至少五子就赢。"
            : `${gomokuChapters[puzzle.chapter - 1].title} · ${puzzle.goal}`}
        </p>
      </div>
      <div className="gomoku-layout">
        <div className="gomoku-play-area">
          <div className="gomoku-turn" aria-live="polite">
            <span
              className={`gomoku-mini-stone ${(position.winner ?? position.turn) === 2 ? "white" : ""}`}
              aria-hidden="true"
            />
            <strong>{turnText}</strong>
            <span>第 {position.moves.length + (finished ? 0 : 1)} 手</span>
          </div>
          <div className="gomoku-board-frame">
            <div className="gomoku-coordinates" aria-hidden="true">
              {[...letters].map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            <div className="gomoku-board-with-rows">
              <div className="gomoku-row-numbers" aria-hidden="true">
                {Array.from({ length: 15 }, (_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
              </div>
              <div
                className="gomoku-board"
                role="grid"
                aria-label="十五路棋盘，方向键移动，Enter 或空格落子"
                aria-rowcount={15}
                aria-colcount={15}
                aria-disabled={locked}
              >
                {Array.from({ length: 15 }, (_, r) => (
                  <div className="gomoku-row" role="row" key={r}>
                    {Array.from({ length: 15 }, (_, c) => {
                      const index = r * 15 + c,
                        cell = position.board[index];
                      return (
                        <button
                          key={index}
                          ref={(el) => {
                            buttons.current[index] = el;
                          }}
                          role="gridcell"
                          aria-rowindex={r + 1}
                          aria-colindex={c + 1}
                          aria-selected={selected === index}
                          aria-disabled={locked || !!cell}
                          aria-label={`${pointName(index)}，${cell ? stoneName(cell) : "空点"}${index === last ? "，最后一手" : ""}${winPoints.has(index) ? "，成五连线" : ""}`}
                          tabIndex={cursor === index ? 0 : -1}
                          onFocus={() => setCursor(index)}
                          onKeyDown={(e) => onKey(e, index)}
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.altKey)
                              preview(index);
                          }}
                          className={`gomoku-point ${r === 0 ? "top" : r === 14 ? "bottom" : ""} ${c === 0 ? "left" : c === 14 ? "right" : ""} ${winPoints.has(index) ? "winning" : ""} ${selected === index ? "preview" : ""}`}
                          data-gomoku-point={index}
                        >
                          {stars.includes(index) && (
                            <span className="gomoku-star" aria-hidden="true" />
                          )}
                          {cell > 0 && (
                            <span
                              className={`gomoku-stone ${cell === 2 ? "white" : ""}`}
                              aria-hidden="true"
                            >
                              {last === index && <i />}
                              {winPoints.has(index) && <b>✦</b>}
                            </span>
                          )}
                          {selected === index && !cell && (
                            <span
                              className={`gomoku-stone ghost ${position.turn === 2 ? "white" : ""}`}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="gomoku-confirm">
            <p>
              {selected === null
                ? "点一下预览，确认后才落子。"
                : `准备在 ${pointName(selected)} 落${stoneName(position.turn)}`}
            </p>
            <button
              className="primary"
              disabled={locked || selected === null}
              onClick={() => {
                const index = selectedRef.current;
                if (index !== null) place(index);
              }}
            >
              确认落子{selected !== null ? ` · ${pointName(selected)}` : ""}
            </button>
          </div>
          <p className="gomoku-keyboard">
            键盘：方向键移动 · Enter / 空格落子 · Esc 暂停
          </p>
        </div>
        <aside className="gomoku-sidebar">
          {freePlay ? (
            <div className="gomoku-panel">
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
                  <>
                    <label>
                      你的棋子
                      <select
                        aria-label="你的棋子"
                        value={draft.human}
                        onChange={(e) => {
                          setDraft({
                            ...draft,
                            human: Number(e.target.value) as Stone,
                          });
                          setReplacing(false);
                        }}
                      >
                        <option value={1}>黑棋 · 先手</option>
                        <option value={2}>白棋 · 后手</option>
                      </select>
                    </label>
                    <label>
                      陪练节奏
                      <select
                        aria-label="陪练节奏"
                        value={draft.difficulty}
                        onChange={(e) => {
                          setDraft({
                            ...draft,
                            difficulty: e.target
                              .value as MatchSettings["difficulty"],
                          });
                          setReplacing(false);
                        }}
                      >
                        <option value="gentle">轻松 · 看一手</option>
                        <option value="steady">认真 · 多想几手</option>
                      </select>
                    </label>
                  </>
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
              <p className="gomoku-small">
                当前：
                {settings.mode === "local"
                  ? "两人轮流下"
                  : `你执${stoneName(settings.human)} · ${settings.difficulty === "gentle" ? "轻松陪练" : "认真陪练"}`}
                。电脑只作入门陪练，会有疏漏。
              </p>
              {fallback && (
                <p className="gomoku-notice">
                  正在使用简易兼容陪练，仍会优先成五与挡五。
                </p>
              )}
            </div>
          ) : (
            <div className="gomoku-panel">
              <span className="gomoku-chapter">
                第 {puzzle.chapter} 章 / 共 {gomokuChapters.length} 章
              </span>
              <h3>这一手，练什么？</h3>
              <p>{puzzle.goal}</p>
              <p>
                你执{stoneName(player)}。
                {puzzle.objective === "two"
                  ? "先创造两个机会，再应对电脑的一手防守。"
                  : "一手练习，可反复撤销尝试。"}
              </p>
              <button disabled={paused || stage === "success"} onClick={hint}>
                想法提示
              </button>
              {stage === "retry" && (
                <button className="primary" disabled={paused} onClick={undo}>
                  撤销，再想一手
                </button>
              )}
            </div>
          )}
          <details className="gomoku-rules">
            <summary>规则与小提醒</summary>
            <ul>
              <li>15 × 15 交叉点，黑棋先下，双方轮流落一子。</li>
              <li>横、竖或两条斜线，连续至少 5 子获胜。6 子及以上也赢。</li>
              <li>采用自由五子棋，无三三、四四等禁手；不是连珠竞赛规则。</li>
              <li>已有棋子的点不能再落。满盘无人获胜时和棋。</li>
              <li>电脑对局悔回你最近一手及电脑回应；双人对局悔一手。</li>
            </ul>
          </details>
          <div className="gomoku-legend">
            <span>
              <i className="gomoku-last-dot" /> 棋子上的小点是最后一手
            </span>
            <span>✦ 表示已连成五子或更多</span>
          </div>
          <p className="gomoku-save">
            {saved
              ? "棋谱只保存在此浏览器，离开后可以接着下。"
              : "当前浏览器无法保存棋谱，仍可继续游玩。"}
          </p>
        </aside>
      </div>
      <p className="gomoku-feedback" role="status">
        {message}
      </p>
    </section>
  );
}
