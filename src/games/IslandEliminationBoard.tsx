import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  createHitoriState,
  getHitoriHint,
  hitoriConflicts,
  hitoriLevels,
  isHitoriSolved,
} from "./hitoriLogic";
import {
  createNurikabeState,
  getNurikabeHint,
  isNurikabeSolved,
  nurikabeConflicts,
  nurikabeLevels,
} from "./nurikabeLogic";
import {
  cycleIslandCell,
  setIslandCell,
  undoIsland,
  type IslandCell,
  type IslandHint,
} from "./islandEliminationCore";
import "./islandElimination.css";
export type IslandGame = "hitori" | "nurikabe";
type PaintMode = "cycle" | IslandCell;
const rules = {
  hitori:
    "涂黑一些数字，使每行、每列留下的数字不重复。黑格不能上下左右相邻，所有白格必须上下左右连成一片。请把每格明确标为黑格或白格。",
  nurikabe:
    "每座岛恰好包含一个数字，岛屿格数等于该数字。不同岛屿不能上下左右相连。所有海水连成一片，不能出现 2 × 2 的全海水方块。请标完所有格子。",
};
export default function IslandEliminationBoard(
  props: GameProps & { game: IslandGame },
) {
  return (
    <IslandRound
      key={`${props.game}:${props.level}:${props.resetToken}`}
      {...props}
    />
  );
}
function IslandRound({
  game,
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps & { game: IslandGame }) {
  const hitori = game === "hitori",
    config = hitori
      ? (hitoriLevels[level] ?? hitoriLevels[0])
      : (nurikabeLevels[level] ?? nurikabeLevels[0]);
  const hConfig = hitoriLevels[level] ?? hitoriLevels[0],
    nConfig = nurikabeLevels[level] ?? nurikabeLevels[0],
    n = config.size;
  const fixed = hitori ? [] : nConfig.clues.map((c) => c.index);
  const [state, setState] = useState(() =>
    hitori ? createHitoriState(hConfig) : createNurikabeState(nConfig),
  );
  const [cursor, setCursor] = useState(
    () =>
      Array.from({ length: n * n }, (_, i) => i).find(
        (i) => !fixed.includes(i),
      ) ?? 0,
  );
  const [hint, setHint] = useState<IslandHint | null>(null),
    [message, setMessage] = useState(rules[game]);
  const [paintMode, setPaintMode] = useState<PaintMode>("cycle");
  const paintHelpId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]),
    current = useRef(state),
    callbacks = useRef({ onComplete, onStatus }),
    tokens = useRef({ hintToken, undoToken }),
    completed = useRef(false);
  current.current = state;
  callbacks.current = { onComplete, onStatus };
  const won = hitori
    ? isHitoriSolved(hConfig, state.board)
    : isNurikabeSolved(nConfig, state.board);
  const conflicts = hitori
    ? hitoriConflicts(hConfig, state.board)
    : nurikabeConflicts(nConfig, state.board);
  const label = (v: IslandCell) =>
    v === -1
      ? "未标记"
      : v === 1
        ? hitori
          ? "涂黑"
          : "海水"
        : hitori
          ? "保留白格"
          : "岛屿";
  const report = (text: string) => {
    setMessage(text);
    callbacks.current.onStatus(text);
  };
  useEffect(() => {
    callbacks.current.onStatus(rules[game]);
  }, [game]);
  useEffect(() => {
    if (!won || paused || completed.current) return;
    completed.current = true;
    report(
      hitori
        ? "重复的数字已消去，白格连成一片。留白完成！"
        : "群岛面积与海水连通全部正确。海图完成！",
    );
    callbacks.current.onComplete();
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const next = hitori
      ? getHitoriHint(hConfig, current.current.board)
      : getNurikabeHint(nConfig, current.current.board);
    setHint(next);
    if (next && next.kind !== "unavailable") {
      setCursor(next.index);
      buttons.current[next.index]?.focus();
      report(
        `第 ${Math.floor(next.index / n) + 1} 行第 ${(next.index % n) + 1} 列：${next.reason}`,
      );
    } else report(next?.reason ?? "已经完成。");
  }, [hintToken, paused, won, hitori, hConfig, nConfig, n]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    const next = undoIsland(current.current);
    current.current = next;
    setState(next);
    setHint(null);
    report(next === state ? "还没有可以撤销的标记。" : "已撤销上一笔标记。");
  }, [undoToken, paused]);
  function edit(index: number, value?: IslandCell) {
    if (paused || won) return;
    if (fixed.includes(index)) {
      setCursor(index);
      report("数字是固定的岛屿起点，不能修改。观察它周围的格子。");
      return;
    }
    const before = current.current,
      next =
        value === undefined
          ? cycleIslandCell(before, index, fixed)
          : setIslandCell(before, index, value, fixed);
    setCursor(index);
    if (next === before) return;
    current.current = next;
    setState(next);
    setHint(null);
    const bad = hitori
      ? hitoriConflicts(hConfig, next.board)
      : nurikabeConflicts(nConfig, next.board);
    report(
      bad.length
        ? "带 ! 的格子已违反规则，可以修改或撤销。"
        : `这一格已${label(next.board[index])}。还剩 ${next.board.filter((v) => v === -1).length} 格待判断。`,
    );
  }
  return (
    <div
      className={`ie-layout ie-${game}`}
      data-island-game={game}
      data-complete={won}
    >
      <section
        className="ie-play"
        aria-label={hitori ? "数字留白游戏" : "群岛海图游戏"}
      >
        <header className="ie-heading">
          <div>
            <span className="ie-eyebrow">
              {hitori ? "HITORI · QUIET NUMBERS" : "NURIKABE · ISLAND ATLAS"}
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="ie-level">
            {String(
              (hitori
                ? hitoriLevels.indexOf(hConfig)
                : nurikabeLevels.indexOf(nConfig)) + 1,
            ).padStart(2, "0")}{" "}
            / 12
          </span>
        </header>
        <div className="ie-stats">
          <span>
            <strong>
              {n} × {n}
            </strong>{" "}
            方格
          </span>
          <span>
            <strong>{state.board.filter((v) => v === -1).length}</strong> 格待定
          </span>
          <span>
            {paused
              ? "已暂停"
              : won
                ? "完成 ✓"
                : `${state.history.length} 笔标记`}
          </span>
        </div>
        <fieldset className="ie-paint" disabled={paused || won}>
          <legend>点格方式</legend>
          <div className="ie-paint-options">
            {(
              [
                ["cycle", "循环标记"],
                [1, hitori ? "黑格画笔" : "海水画笔"],
                [0, hitori ? "白格画笔" : "岛屿画笔"],
                [-1, "清空画笔"],
              ] as const
            ).map(([mode, name]) => (
              <button
                key={mode}
                type="button"
                disabled={paused || won}
                aria-pressed={paintMode === mode}
                aria-describedby={paintHelpId}
                onClick={() => setPaintMode(mode)}
              >
                <span aria-hidden="true">{paintMode === mode ? "✓ " : ""}</span>
                {name}
              </button>
            ))}
          </div>
          <p id={paintHelpId}>
            {paintMode === "cycle"
              ? `点格依次切换：${hitori ? "黑格 → 白格" : "海水 → 岛屿"} → 未定。选画笔后，每格只需点一次。`
              : `当前画笔：${label(paintMode)}。点格直接${paintMode === -1 ? "清空" : "标记"}，连点同一格不会切换。`}
          </p>
        </fieldset>
        {level === 0 && (
          <p className="ie-first-rule">
            <strong>先试一条规则：</strong>
            {hitori
              ? "第一行是 3 · 2 · 3。如果中间涂黑，两边就都要留白，两个 3 会重复。所以中间的 2 必须留白。"
              : "数字 1 自己就是一整座岛，它上下左右的格子必须是海水。先找到它，再用海水画笔标出边界。"}
          </p>
        )}
        <div className="ie-board-wrap">
          <div
            className="ie-board"
            role="group"
            aria-label={`${hitori ? "数字留白" : "群岛海图"}棋盘，方向键移动，Enter 或空格按当前点格方式标记`}
            aria-describedby={paintHelpId}
            style={{ "--ie-size": n } as CSSProperties}
            onKeyDown={(e) => {
              if (paused || won || e.altKey || e.ctrlKey || e.metaKey) return;
              const directions: Record<string, [number, number]> = {
                ArrowUp: [-1, 0],
                ArrowDown: [1, 0],
                ArrowLeft: [0, -1],
                ArrowRight: [0, 1],
              };
              if (directions[e.key]) {
                e.preventDefault();
                const [dy, dx] = directions[e.key],
                  i =
                    Math.max(0, Math.min(n - 1, Math.floor(cursor / n) + dy)) *
                      n +
                    Math.max(0, Math.min(n - 1, (cursor % n) + dx));
                setCursor(i);
                buttons.current[i]?.focus();
              } else {
                const key = e.key.toLowerCase(),
                  value: IslandCell | null = ["b", "s", "1"].includes(key)
                    ? 1
                    : ["w", "i", "0"].includes(key)
                      ? 0
                      : ["delete", "backspace"].includes(key)
                        ? -1
                        : null;
                if (value !== null) {
                  e.preventDefault();
                  edit(cursor, value);
                }
              }
            }}
          >
            {state.board.map((value, index) => {
              const clue = hitori
                  ? hConfig.numbers[index]
                  : nConfig.clues.find((c) => c.index === index)?.area,
                isFixed = fixed.includes(index),
                bad = conflicts.includes(index);
              return (
                <button
                  key={index}
                  type="button"
                  ref={(el) => {
                    buttons.current[index] = el;
                  }}
                  data-island-cell={index}
                  data-hitori-cell={hitori ? index : undefined}
                  data-nurikabe-cell={!hitori ? index : undefined}
                  data-value={value}
                  data-fixed={isFixed}
                  data-selected={cursor === index}
                  className={`ie-cell ${value === 1 ? "is-dark" : value === 0 ? "is-light" : "is-unknown"} ${isFixed ? "is-fixed" : ""} ${bad ? "is-conflict" : ""} ${hint && hint.kind !== "unavailable" && hint.index === index ? "is-hinted" : ""}`}
                  tabIndex={cursor === index ? 0 : -1}
                  disabled={paused || won}
                  aria-disabled={paused || won || isFixed}
                  aria-label={`第 ${Math.floor(index / n) + 1} 行第 ${(index % n) + 1} 列，${clue !== undefined ? `数字 ${clue}，` : ""}${isFixed ? "固定岛屿" : label(value)}${bad ? "，规则冲突" : ""}`}
                  onFocus={() => setCursor(index)}
                  onClick={() =>
                    edit(index, paintMode === "cycle" ? undefined : paintMode)
                  }
                >
                  {clue !== undefined ? (
                    <span className="ie-number">{clue}</span>
                  ) : (
                    <span aria-hidden="true" className="ie-cell-symbol">
                      {value === 1 ? "≈" : value === 0 ? "·" : ""}
                    </span>
                  )}
                  {hitori && value === 0 && (
                    <span aria-hidden="true" className="ie-confirmed">
                      ✓
                    </span>
                  )}
                  {bad && (
                    <b className="ie-conflict" aria-hidden="true">
                      !
                    </b>
                  )}
                </button>
              );
            })}
          </div>
          {paused && (
            <div className="ie-pause">
              <strong>{hitori ? "让数字歇一歇" : "海风休息中"}</strong>
              <span>继续后再来推理</span>
            </div>
          )}
        </div>
        <p className="ie-selection">
          已选：第 {Math.floor(cursor / n) + 1} 行第 {(cursor % n) + 1} 列 ·{" "}
          {fixed.includes(cursor) ? "固定岛屿" : label(state.board[cursor])}
        </p>
        <div className="ie-tools" aria-label="给所选格子标记">
          <button
            disabled={paused || won || fixed.includes(cursor)}
            onClick={() => edit(cursor, 1)}
          >
            {hitori ? "涂黑 B" : "海水 S"}
          </button>
          <button
            disabled={paused || won || fixed.includes(cursor)}
            onClick={() => edit(cursor, 0)}
          >
            {hitori ? "保留 W" : "岛屿 I"}
          </button>
          <button
            disabled={paused || won || fixed.includes(cursor)}
            onClick={() => edit(cursor, -1)}
          >
            清空
          </button>
        </div>
        <p className="ie-status" role="status">
          {message}
        </p>
        {hint && (
          <div className="ie-hint" data-island-hint={hint.kind}>
            <strong>
              {hint.kind === "deduction"
                ? "一个可以确定的位置"
                : hint.kind === "repair"
                  ? "先检查已有标记"
                  : "继续观察"}
            </strong>
            <p>{hint.reason}</p>
            {hint.kind !== "unavailable" && (
              <button
                type="button"
                disabled={paused || won}
                onClick={() => edit(hint.index, hint.value)}
              >
                {hint.kind === "repair" ? "清除这个标记" : "采用这一步"}
              </button>
            )}
          </div>
        )}
      </section>
      <aside className="ie-notes">
        <span className="ie-eyebrow">
          {hitori ? "排除 · 留白 · 连通" : "面积 · 边界 · 连通"}
        </span>
        <h3>
          {hitori ? (
            <>
              在数字之间，
              <br />
              留出一条路。
            </>
          ) : (
            <>
              一片海，
              <br />
              十二张群岛图。
            </>
          )}
        </h3>
        <p>
          {hitori
            ? "看起来相同的数字，未必有相同的去留。保留一条贯穿整个庭院的白色小径。"
            : "从数字出发，让小岛慢慢长成正确的形状，再把海水连起来。"}
        </p>
        <div className="ie-rule-card">
          <strong>
            {hitori ? "黑格分开，白格相连。" : "岛有大小，海有通路。"}
          </strong>
          <p>{rules[game]}</p>
        </div>
        <ol>
          {hitori ? (
            <>
              <li>同一行或同一列的白格，不能保留相同数字。</li>
              <li>黑格不可上下左右相邻，对角相邻可以。</li>
              <li>白格必须上下左右连成一片。白格上的 ✓ 表示已确认。</li>
            </>
          ) : (
            <>
              <li>数字算在岛屿面积内，每座岛只能有一个数字。</li>
              <li>不同岛之间至少隔一格海水；对角接触可以。</li>
              <li>海水必须上下左右相连，且不能形成 2 × 2 的水池。</li>
            </>
          )}
        </ol>
        <p className="ie-keyboard">
          点击 / Enter / 空格使用当前点格方式。方向键只移动，不改格子；
          {hitori ? "B / 1 涂黑，W / 0 保留" : "S / 1 海水，I / 0 岛屿"}；Delete
          清空，不受画笔影响。下方按钮只修改所选格子。支持最近 300 步撤销。
          提示优先解释局部规则；需要搜索时会如实说明。
        </p>
      </aside>
    </div>
  );
}
