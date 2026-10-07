import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import { floodLevels } from "./floodLevels";
import {
  createFloodState,
  fillFlood,
  floodRegion,
  FLOOD_NAMES,
  FLOOD_SYMBOLS,
  FLOOD_RESUME_KEY,
  isFloodComplete,
  parseFloodSave,
  playFlood,
  replayFlood,
  solveFlood,
} from "./floodLogic";
import "./floodGarden.css";
const chapters = [
  [
    "从一角出发",
    "只给左上角连成一片的区域换色。上下左右同色会接入，斜角碰到不算。",
  ],
  ["跨过色带", "比较相邻的颜色：换色不仅改变这一片，也会把新邻居接进来。"],
  ["连接远方", "大块未必先选。想一想，哪种颜色能让下一步够到更远的区域？"],
  ["绕路汇合", "有时先接入小片，才能让隔开的同色块在下一步一起相遇。"],
  [
    "全园同色",
    "用有限次换色连起整个花园。先预览，必要时撤销，再尝试另一条路线。",
  ],
];
const intro =
  "从左上角的起点出发，在步数内把整个花园染成同一种颜色。先选色预览，再确认换色。";
export default function FloodGarden(props: GameProps) {
  const key = `${props.level}:${props.resetToken}`,
    round = useRef({ key, level: props.level, fresh: false });
  if (round.current.key !== key)
    round.current = {
      key,
      level: props.level,
      fresh: round.current.level === props.level,
    };
  return (
    <FloodRound
      key={key}
      {...props}
      freshStart={props.freshStart || round.current.fresh}
    />
  );
}
function FloodRound({
  level,
  paused,
  freshStart,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const puzzle = floodLevels[level] ?? floodLevels[0],
    chapter = chapters[puzzle.chapter];
  const [state, setState] = useState(() => {
    if (freshStart) return createFloodState(puzzle);
    try {
      return parseFloodSave(
        localStorage.getItem(`${FLOOD_RESUME_KEY}.round.${level}`),
        puzzle,
      );
    } catch {
      return createFloodState(puzzle);
    }
  });
  const [selected, setSelected] = useState<number | null>(null),
    [message, setMessage] = useState(intro),
    [saved, setSaved] = useState(true);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken }),
    completeSent = useRef(false),
    palette = useRef<(HTMLButtonElement | null)[]>([]);
  const won = isFloodComplete(state.board),
    exhausted = state.moves.length >= puzzle.limit && !won,
    blocked = paused || won || exhausted;
  const region = new Set(floodRegion(state.board, puzzle.size));
  const preview =
    selected === null ? null : fillFlood(state.board, puzzle.size, selected);
  const previewRegion = new Set(
    preview ? floodRegion(preview, puzzle.size) : [],
  );
  function report(text: string) {
    setMessage(text);
    callbacks.current.onStatus(text);
  }
  useEffect(() => {
    callbacks.current.onStatus(intro);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        `${FLOOD_RESUME_KEY}.round.${level}`,
        JSON.stringify({ version: 1, id: puzzle.id, moves: state.moves }),
      );
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [state, level, puzzle]);
  useEffect(() => {
    if (won && !paused && !completeSent.current) {
      completeSent.current = true;
      report(`花园连成一片！用了 ${state.moves.length} 次换色。`);
      callbacks.current.onComplete();
    }
  }, [won, paused, state.moves.length]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || won) return;
    setState(
      (current) =>
        replayFlood(puzzle, current.moves.slice(0, -1)) ??
        createFloodState(puzzle),
    );
    setSelected(null);
    report("回到上一步。可以比较另一种颜色。");
  }, [undoToken, paused, won, puzzle]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const answer = solveFlood(state.board, puzzle.size, puzzle.colors);
    setSelected(null);
    if (answer.kind === "budget")
      report(
        "这次搜索达到预算，暂时没有可靠建议；不代表无解。可以先撤销或比较边界颜色。",
      );
    else if (answer.path.length > puzzle.limit - state.moves.length)
      report(
        `从当前局面至少还需 ${answer.path.length} 步，剩余 ${puzzle.limit - state.moves.length} 步。撤销一步再试试。`,
      );
    else if (answer.path.length) {
      const color = answer.path[0];
      setSelected(color);
      report(
        `试试${FLOOD_NAMES[color]}：这条路线还需 ${answer.path.length} 步。这里只展示下一步预览，由你确认。`,
      );
      palette.current[color]?.focus({ preventScroll: true });
    }
  }, [hintToken, paused, won, state, puzzle]);
  function choose(color: number) {
    if (blocked || color === state.board[0]) return;
    setSelected(color);
    const count =
      floodRegion(fillFlood(state.board, puzzle.size, color), puzzle.size)
        .length - region.size;
    report(
      `预览${FLOOD_NAMES[color]}：会接入 ${count} 格。${count ? "看看新的边界，再确认。" : "这次不会扩大区域，仍会消耗一步。"}`,
    );
  }
  function commit() {
    if (blocked || selected === null) return;
    const next = playFlood(state, puzzle, selected);
    if (next === state) return;
    setState(next);
    setSelected(null);
    report(
      isFloodComplete(next.board)
        ? "整个花园已经同色！"
        : next.moves.length >= puzzle.limit
          ? "步数用完了。可以撤销或重来，试试另一种顺序。"
          : `已换色 ${next.moves.length} 次，还剩 ${puzzle.limit - next.moves.length} 步。`,
    );
  }
  return (
    <div
      className="flood-layout"
      data-flood-won={won}
      data-flood-board={state.board.join("")}
      data-flood-moves={state.moves.length}
      data-flood-id={puzzle.id}
      onKeyDown={(e) => {
        if (
          (e.ctrlKey || e.metaKey || e.altKey) &&
          ["Enter", " "].includes(e.key)
        )
          e.preventDefault();
      }}
    >
      <section className="flood-play" aria-label="染色花园棋局">
        <header className="flood-heading">
          <div>
            <span className="flood-eyebrow">
              第 {puzzle.chapter + 1} 章 · {chapter[0]}
            </span>
            <h3>{puzzle.title}</h3>
          </div>
          <span>
            {String(level + 1).padStart(3, "0")} / {floodLevels.length}
          </span>
        </header>
        <p className="flood-lesson">{chapter[1]}</p>
        <div className="flood-stats">
          <span>
            已连接{" "}
            <strong>
              {region.size} / {state.board.length}
            </strong>
          </span>
          <span>
            剩余 <strong>{puzzle.limit - state.moves.length}</strong> 步
          </span>
          <span>
            {paused
              ? "已暂停"
              : won
                ? "全园同色 ✓"
                : exhausted
                  ? "试试撤销"
                  : "不计时，慢慢想"}
          </span>
        </div>
        <div
          className="flood-board"
          role="img"
          aria-label={`花园棋盘，左上角为起点。${state.board.map((c, i) => `${Math.floor(i / puzzle.size) + 1}行${(i % puzzle.size) + 1}列${FLOOD_NAMES[c]}${region.has(i) ? "已连接" : ""}`).join("；")}`}
          style={{ "--flood-size": puzzle.size } as CSSProperties}
        >
          {state.board.map((color, index) => (
            <span
              key={index}
              data-flood-cell={index}
              data-color={color}
              className={`flood-cell flood-color-${previewRegion.has(index) ? selected : color} ${region.has(index) ? "connected" : ""} ${previewRegion.has(index) && !region.has(index) ? "joining" : ""}`}
            >
              <b aria-hidden="true">
                {FLOOD_SYMBOLS[previewRegion.has(index) ? selected! : color]}
              </b>
              {index === 0 ? (
                <small>起</small>
              ) : region.has(index) ? (
                <small>·</small>
              ) : previewRegion.has(index) ? (
                <small>+</small>
              ) : null}
            </span>
          ))}
        </div>
        <p className="flood-preview-label">
          {preview
            ? `预览：${FLOOD_NAMES[selected!]}，虚线 + 是将接入的格子；棋盘尚未改变。`
            : "实线框内是已连接区域；从左上角“起”向外生长。"}
        </p>
        <div className="flood-palette" role="group" aria-label="选择换色">
          {FLOOD_NAMES.slice(0, puzzle.colors).map((name, color) => (
            <button
              key={name}
              type="button"
              ref={(el) => {
                palette.current[color] = el;
              }}
              className={`flood-color-${color}`}
              aria-label={`选择${name}`}
              aria-pressed={selected === color}
              disabled={blocked || color === state.board[0]}
              onClick={(e) => {
                if (!e.ctrlKey && !e.metaKey && !e.altKey) choose(color);
              }}
            >
              <b aria-hidden="true">{FLOOD_SYMBOLS[color]}</b>
              <span>{name}</span>
              {color === state.board[0] && <small>当前</small>}
            </button>
          ))}
        </div>
        <div className="flood-confirm">
          <button
            type="button"
            className="primary"
            disabled={blocked || selected === null}
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && !e.altKey) commit();
            }}
          >
            确认换色{selected !== null ? ` · ${FLOOD_NAMES[selected]}` : ""}
          </button>
          <button
            type="button"
            disabled={paused || won || selected === null}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.altKey) return;
              setSelected(null);
              report("已取消预览，没有消耗步数。");
            }}
          >
            取消预览
          </button>
        </div>
        <p className="flood-message" role="note">
          {message}
        </p>
        <p className="flood-save">
          {saved
            ? "当前局面自动保存在此浏览器，可离开后继续。"
            : "浏览器暂时无法保存，请保持页面打开。"}
        </p>
      </section>
      <aside className="flood-notes">
        <span className="flood-eyebrow">连接 · 换色 · 规划</span>
        <h3>
          让一小片颜色，
          <br />
          长成整个花园。
        </h3>
        <p>每次换色会改变左上角的整个连通区域，并接入上下左右相邻的同色格。</p>
        <ol>
          <li>选一种颜色，先看预览。</li>
          <li>确认后消耗一步。</li>
          <li>在步数内连起所有格子。</li>
        </ol>
        <p>
          对角不相连，格子不会移动或消失。选到不接壤的颜色也会耗一步；撤销随时可用，通关后只可重来或换关。
        </p>
        <div className="flood-target">
          <span>本关参考最短</span>
          <strong>{puzzle.optimum} 步</strong>
          <span>允许 {puzzle.limit} 步 · 没有时间限制</span>
        </div>
        <details>
          <summary>键盘与提示</summary>
          <p>
            Tab 选择颜色，Enter 或空格预览；再 Tab 到“确认换色”执行。Escape
            暂停或继续。每种颜色也有独立符号与名称。
          </p>
          <p>
            提示从当前局面搜索最短路线，只预览下一色。如果剩余步数不足，会明确建议撤销；搜索达到预算时不会宣称无解。
          </p>
        </details>
      </aside>
    </div>
  );
}
