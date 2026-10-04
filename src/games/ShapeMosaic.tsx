// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createMosaicState,
  placeMosaic,
  removeMosaic,
  undoMosaic,
  mosaicWon,
  mosaicHint,
  mosaicChangeOrientation,
  mosaicOrientations,
  mosaicPlacementCells,
  validMosaicBoard,
  type MosaicCell,
  type MosaicPlacement,
} from "./shapeMosaicLogic";
import { shapeMosaicLevels } from "./shapeMosaicLevels";
import "./shapeMosaic.css";
const palette = [
  "#db967a",
  "#77aaa0",
  "#c3aa60",
  "#9b8cb9",
  "#8fa972",
  "#7f9fbd",
  "#c48c9f",
  "#ad9a79",
  "#8fb7bf",
];
function describeShape(cells: readonly MosaicCell[]) {
  const [ax, ay] = cells[0];
  return cells
    .map(([x, y], i) =>
      i === 0
        ? "星标原点"
        : `${x - ax === 0 ? "同列" : x - ax > 0 ? `右${x - ax}格` : `左${ax - x}格`}、${y - ay === 0 ? "同行" : `下${y - ay}格`}`,
    )
    .join("；");
}
function PieceDiagram({
  cells,
  label,
  index,
  large = false,
}: {
  cells: readonly MosaicCell[];
  label: string;
  index: number;
  large?: boolean;
}) {
  const w = Math.max(...cells.map((c) => c[0])) + 1,
    h = Math.max(...cells.map((c) => c[1])) + 1;
  return (
    <svg
      className={large ? "sm-piece-preview" : "sm-piece-mini"}
      viewBox={`-2 -2 ${w * 24 + 4} ${h * 24 + 4}`}
      aria-hidden="true"
    >
      {cells.map(([x, y], i) => (
        <g key={`${x},${y}`}>
          <rect
            x={x * 24 + 1}
            y={y * 24 + 1}
            width={22}
            height={22}
            rx={3}
            fill={palette[index % palette.length]}
            stroke="#365146"
            strokeWidth={1}
          />
          <text
            x={x * 24 + 12}
            y={y * 24 + 16}
            textAnchor="middle"
            fontSize={i === 0 ? 16 : 12}
            fill="#183b31"
            fontWeight="bold"
          >
            {i === 0 ? "★" : label}
          </text>
        </g>
      ))}
    </svg>
  );
}
export default function ShapeMosaic(props: GameProps) {
  return <MosaicRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function MosaicRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = shapeMosaicLevels[level] ?? shapeMosaicLevels[0],
    [state, setState] = useState(() => createMosaicState(config));
  const [selected, setSelected] = useState(0),
    [orientation, setOrientation] = useState(0),
    [anchor, setAnchor] = useState<MosaicCell | null>(null),
    [message, setMessage] = useState(
      "选一片，调整朝向，再在棋盘上点选星标锚点。",
    );
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    notified = useRef(false),
    cellRefs = useRef(new Map<string, HTMLButtonElement>()),
    pieceRefs = useRef(new Map<number, HTMLButtonElement>()),
    removeRef = useRef<HTMLButtonElement>(null);
  const won = mosaicWon(config, state.board),
    locked = paused || won,
    piece = config.pieces[selected],
    shape = mosaicOrientations(piece)[orientation];
  const used = state.board.filter(Boolean).length,
    filled = state.board.reduce(
      (n, p, i) => n + (p ? config.pieces[i].cells.length : 0),
      0,
    );
  const placement: MosaicPlacement | null = anchor
    ? { piece: selected, orientation, x: anchor[0], y: anchor[1] }
    : null;
  const preview =
    placement && !locked ? mosaicPlacementCells(config, placement) : [];
  const previewValid =
    !!placement &&
    validMosaicBoard(
      config,
      state.board.map((p, i) => (i === selected ? placement : p)),
    );
  const occupied = new Map<string, number>();
  state.board.forEach((p, i) => {
    if (p)
      mosaicPlacementCells(config, p).forEach((c) =>
        occupied.set(c.join(","), i),
      );
  });
  function status(text: string) {
    setMessage(text);
    onStatus(text);
  }
  useEffect(() => {
    onStatus(
      "每片恰好用一次，铺满所有浅色格；不能重叠，也不能覆盖缺口。星标是点击落位的锚点。",
    );
  }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (locked) return;
    const hint = mosaicHint(config, state.board);
    status(hint.text);
    if (hint.placement) {
      setSelected(hint.placement.piece);
      setOrientation(hint.placement.orientation);
      setAnchor([hint.placement.x, hint.placement.y]);
    }
  }, [hintToken]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (locked) return;
    const next = undoMosaic(config, state);
    setState(next);
    setAnchor(null);
    status(
      next === state
        ? "没有可以撤销的落位。"
        : "已撤销一次摆放或取回，之前的拼片全部恢复。",
    );
  }, [undoToken]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      status("严丝合缝！每片恰好使用一次，整个区域没有重叠或空缺。");
      onComplete();
    }
  }, [won, paused, onComplete]);
  function choose(index: number) {
    if (paused || !config.pieces[index]) return;
    setSelected(index);
    setOrientation(state.board[index]?.orientation ?? 0);
    setAnchor(null);
    status(
      `已选 ${config.pieces[index].label}。${won ? "已完成，当前仅查看，不改变拼图。" : state.board[index] ? "可以重新放置；非法尝试会保留旧位置。" : "先调整朝向，再点星标锚点。"}`,
    );
  }
  function turn(flip: boolean) {
    if (locked) return;
    if (flip && !piece.reflect) {
      status(`${piece.label} 禁止翻面，可以旋转。`);
      return;
    }
    setOrientation(mosaicChangeOrientation(piece, orientation, flip));
    status(
      `${piece.label} 已${flip ? "翻面" : "顺时针旋转"}，棋盘上的旧位置暂时保留。`,
    );
  }
  function place(x: number, y: number) {
    if (locked) return;
    const next = placeMosaic(config, state, {
      piece: selected,
      orientation,
      x,
      y,
    });
    if (next === state) {
      status(
        "不能放在这里：可能越界、覆盖缺口或与别片重叠，也可能与原位置相同。原来有效的位置没有被删除。",
      );
      return;
    }
    setState(next);
    setAnchor(null);
    status(`${piece.label} 已放在 ${y + 1} 行 ${x + 1} 列的星标锚点。`);
  }
  function takeBack() {
    if (locked) return;
    const restoreFocus = document.activeElement === removeRef.current;
    const next = removeMosaic(config, state, selected);
    if (next !== state && restoreFocus)
      pieceRefs.current.get(selected)?.focus();
    setState(next);
    setAnchor(null);
    status(
      next === state
        ? "这片尚未放到棋盘。"
        : `${piece.label} 已取回，可以换个位置再试。`,
    );
  }
  return (
    <div
      className="puzzle-layout shape-mosaic"
      data-shape-mosaic-game
      data-mosaic-won={won}
      data-mosaic-selected={selected}
      data-mosaic-orientation={orientation}
      data-mosaic-placed={used}
      onKeyDown={(event) => {
        if (
          locked ||
          event.repeat ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        if (/^[1-9]$/.test(event.key)) {
          event.preventDefault();
          choose(Number(event.key) - 1);
        } else if (event.key.toLowerCase() === "r") {
          event.preventDefault();
          turn(false);
        } else if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          turn(true);
        }
      }}
    >
      <section className="sm-workbench" aria-label="拼片工作台">
        <div className="sm-heading">
          <span className="mini-label">拼片镶嵌 · {config.title}</span>
          <strong>
            {used}/{config.pieces.length} 片 · {filled} 格
          </strong>
        </div>
        <div className="sm-inventory" role="group" aria-label="选择拼片">
          {config.pieces.map((p, i) => (
            <button
              key={p.label}
              ref={(node) => {
                if (node) pieceRefs.current.set(i, node);
                else pieceRefs.current.delete(i);
              }}
              data-mosaic-piece={i}
              aria-label={`选择拼片 ${p.label}，${p.cells.length} 格，${p.reflect ? "允许翻面" : "禁止翻面"}${state.board[i] ? "，已放置" : "，待放置"}`}
              aria-pressed={i === selected}
              disabled={paused}
              onClick={() => choose(i)}
            >
              <PieceDiagram
                cells={mosaicOrientations(p)[state.board[i]?.orientation ?? 0]}
                label={p.label}
                index={i}
              />
              <b>
                {p.label} <small>{state.board[i] ? "✓ 已放" : "待放"}</small>
              </b>
              <span>
                {p.reflect ? "可翻面" : "不翻面"} · 键 {i + 1}
              </span>
            </button>
          ))}
        </div>
        <div className="sm-tools">
          <div
            className="sm-selected"
            aria-label={`当前拼片 ${piece.label}，朝向 ${orientation + 1}，星标为锚点`}
          >
            <PieceDiagram
              cells={shape}
              label={piece.label}
              index={selected}
              large
            />
            <div>
              <strong>
                {piece.label} · {piece.cells.length} 格
              </strong>
              <span>★ = 点击的格子</span>
              <small>
                {piece.reflect ? "允许镜像翻面" : "本片禁止镜像翻面"}
              </small>
            </div>
          </div>
          <p
            className="sm-shape-description"
            aria-live="polite"
            data-mosaic-shape-description
          >
            {piece.label} 当前占格（相对 ★）：{describeShape(shape)}。
          </p>
          <div className="sm-actions">
            <button
              data-mosaic-rotate
              disabled={locked}
              onClick={() => turn(false)}
            >
              ↻ 旋转 · R
            </button>
            <button
              data-mosaic-flip
              disabled={locked || !piece.reflect}
              onClick={() => turn(true)}
            >
              ⇋ 翻面 · F
            </button>
            <button
              ref={removeRef}
              data-mosaic-remove
              disabled={locked || !state.board[selected]}
              onClick={takeBack}
            >
              取回 {piece.label}
            </button>
          </div>
        </div>
        <p className="sm-board-help">
          {locked
            ? won
              ? "全部拼片已就位，可继续查看。"
              : "已暂停，棋盘保持不变。"
            : state.board[selected]
              ? `正在移动 ${piece.label}；旧位置会保留到新位置合法。`
              : `点击浅色格放下 ${piece.label} 的 ★ 锚点。`}
        </p>
        <div
          className="sm-board"
          role="group"
          aria-label="镶嵌棋盘，方向键移动焦点，回车放下当前拼片"
          style={{
            gridTemplateColumns: `repeat(${config.rows[0].length},minmax(44px,1fr))`,
          }}
        >
          {config.rows.flatMap((row, y) =>
            [...row].map((cell, x) => {
              const key = `${x},${y}`,
                owner = occupied.get(key),
                ghost = preview.some((c) => c[0] === x && c[1] === y),
                isAnchor = anchor?.[0] === x && anchor?.[1] === y;
              if (cell === "#")
                return (
                  <div
                    key={key}
                    className={`sm-hole${ghost ? " sm-ghost-invalid" : ""}`}
                    aria-label={`${y + 1} 行 ${x + 1} 列缺口，不能覆盖`}
                  >
                    ×
                  </div>
                );
              return (
                <button
                  key={key}
                  ref={(element) => {
                    if (element) cellRefs.current.set(key, element);
                    else cellRefs.current.delete(key);
                  }}
                  data-mosaic-cell={key}
                  data-mosaic-owner={
                    owner === undefined ? "" : config.pieces[owner].label
                  }
                  className={`${owner !== undefined ? "sm-filled " : ""}${ghost ? (previewValid ? "sm-ghost-valid " : "sm-ghost-invalid ") : ""}${isAnchor ? "sm-anchor" : ""}`}
                  style={
                    owner === undefined
                      ? undefined
                      : { backgroundColor: palette[owner] }
                  }
                  disabled={locked}
                  aria-label={`${y + 1} 行 ${x + 1} 列，${owner === undefined ? "空格" : `拼片 ${config.pieces[owner].label}`}，放置 ${piece.label} 星标锚点`}
                  onMouseEnter={() => {
                    if (!locked) setAnchor([x, y]);
                  }}
                  onFocus={() => {
                    if (!locked) setAnchor([x, y]);
                  }}
                  onClick={() => place(x, y)}
                  onKeyDown={(event) => {
                    const delta = (
                      {
                        ArrowUp: [0, -1],
                        ArrowDown: [0, 1],
                        ArrowLeft: [-1, 0],
                        ArrowRight: [1, 0],
                      } as Record<string, number[]>
                    )[event.key];
                    if (!delta) return;
                    event.preventDefault();
                    let nx = x + delta[0],
                      ny = y + delta[1];
                    while (
                      nx >= 0 &&
                      ny >= 0 &&
                      ny < config.rows.length &&
                      nx < row.length
                    ) {
                      const next = cellRefs.current.get(`${nx},${ny}`);
                      if (next) {
                        next.focus();
                        break;
                      }
                      nx += delta[0];
                      ny += delta[1];
                    }
                  }}
                >
                  <small>
                    {y + 1},{x + 1}
                  </small>
                  <b>
                    {owner === undefined ? "·" : config.pieces[owner].label}
                  </b>
                  {isAnchor && !locked && (
                    <span className="sm-anchor-star">★</span>
                  )}
                </button>
              );
            }),
          )}
        </div>
        <div className="sm-legend">
          <span>□ 待铺区域</span>
          <span>× 固定缺口</span>
          <span>★ 当前锚点</span>
          <span>虚线：{previewValid ? "可落位预览" : "落位预览"}</span>
        </div>
        <p className="sm-message" role="status">
          {paused
            ? "已暂停。恢复后继续选择、旋转和摆放。"
            : won
              ? "镶嵌完成！所有合法铺法都被接受。重来可尝试另一种。"
              : message}
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">精确覆盖 · 空腔规划</span>
        <h3>每一片，都有它的位置。</h3>
        <p>{config.lesson}</p>
        <div className="note">
          <strong>三步完成一次落位</strong>
          <ol>
            <li>选带字母的拼片。</li>
            <li>旋转；标明“可翻面”的片也能镜像。</li>
            <li>点击目标格，让预览中的 ★ 落在那里。</li>
          </ol>
          <p>
            每片只能用一次，不得重叠或伸进 ×
            缺口。已放好的片仍可选中再移动，或先取回；失败的尝试保留旧位置。
          </p>
        </div>
        {level === 0 && (
          <div className="note">
            <strong>动手示范</strong>
            <p>
              先选 A，旋转到上排两格、下一排左侧一格。点击 1 行 1
              列放下星标。剩余的三格横臂加一格下凸，留给 B；旋转 B，让星标落在 2
              行 2 列。
            </p>
          </div>
        )}
        <p>
          提示保留所有已摆拼片，再搜索真实剩余空间。找到一种铺法不等于唯一；只有排除其他落位时才标注“必然”。达到搜索预算会明确说明，绝不把它当成死局。
        </p>
        <p className="muted">
          键盘：1–9 选片，R 旋转，F 翻面；Tab 进入棋盘，方向键选格，Enter
          或空格放下。上方工具栏提供暂停、撤销、提示与重来。
        </p>
      </aside>
    </div>
  );
}
