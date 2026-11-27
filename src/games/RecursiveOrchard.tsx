// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  apply,
  hint,
  leaves,
  notation,
  predict,
  treeLevels,
  won,
  type Tree,
} from "./recursiveOrchardLogic";
import "./recursiveOrchard.css";

type Point = { x: number; y: number; mark: string; path: string };
function diagram(tree: Tree) {
  const nodes: Point[] = [],
    links: [Point, Point][] = [];
  let nextLeaf = 0,
    depth = 0;
  const width = Math.max(132, leaves(tree) * 28 + 10);
  function walk(branch: Tree, path: string): Point {
    depth = Math.max(depth, path.length);
    if (typeof branch === "string") {
      const node = {
        x: ((nextLeaf++ + 0.5) * width) / leaves(tree),
        y: 15 + path.length * 27,
        mark: branch,
        path,
      };
      nodes.push(node);
      return node;
    }
    const left = walk(branch[0], path + "0"),
      right = walk(branch[1], path + "1");
    const node = {
      x: (left.x + right.x) / 2,
      y: 15 + path.length * 27,
      mark: "",
      path,
    };
    nodes.push(node);
    links.push([node, left], [node, right]);
    return node;
  }
  walk(tree, "");
  return { nodes, links, width, height: 33 + depth * 27 };
}
function TreeView({ tree, target }: { tree: Tree; target: boolean }) {
  const { nodes, links, width, height } = diagram(tree);
  const name = target ? "目标树" : "当前树";
  return (
    <figure className="orchard-diagram">
      <figcaption>
        {name} <small>{leaves(tree)} 个末端</small>
      </figcaption>
      <div className="orchard-drawing">
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
        >
          {links.map(([a, b]) => (
            <path
              key={b.path}
              d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
              stroke="#75938c"
              strokeWidth="1.7"
              fill="none"
            />
          ))}
          {nodes.map(({ x, y, mark, path }) => (
            <g
              key={path}
              transform={`translate(${x},${y})`}
              className={`orchard-node orchard-${mark || "junction"}`}
            >
              {mark === "A" || mark === "B" ? (
                <circle r="10" />
              ) : mark ? (
                <rect x="-10" y="-9" width="20" height="18" rx="4" />
              ) : (
                <circle r="3.3" />
              )}
              {mark && (
                <text x="0" y="4" textAnchor="middle">
                  {mark}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <code
        aria-label={`${name}的结构`}
        data-orchard-tree={target ? "target" : "current"}
      >
        {notation(tree)}
      </code>
    </figure>
  );
}

export default function RecursiveOrchard(props: GameProps) {
  return <Round key={`${props.level}:${props.resetToken}`} {...props} />;
}
function Round({ level, paused, hintToken, undoToken, onComplete }: GameProps) {
  const puzzle = treeLevels[level] ?? treeLevels[0];
  const [history, setHistory] = useState<Tree[]>([puzzle.start]);
  const state = history[history.length - 1],
    used = history.length - 1;
  const finished = won(puzzle, state),
    locked = finished || paused,
    outOfTurns = used >= puzzle.turns;
  const [message, say] = useState("先看目标的左右顺序，再选让芽生长的规则。");
  const [suggested, setSuggested] = useState<number | null>(null);
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    reported = useRef(false);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (locked) return;
    const result = hint(puzzle, state, used);
    setSuggested(result.kind === "move" ? result.index : null);
    say(
      result.kind === "move"
        ? `建议先用规则 ${result.index + 1}，树不会自动改变。`
        : result.kind === "dead"
          ? "剩余步数里无法长成目标树。撤销一步再试。"
          : "暂时找不到可靠的建议，可以撤销或换一种生长顺序。",
    );
  }, [hintToken, locked, puzzle, state, used]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (locked) return;
    setSuggested(null);
    if (history.length === 1) {
      say("还没有可以撤销的生长。");
      return;
    }
    setHistory(history.slice(0, -1));
    say("已撤销整步，所有受影响的芽同时恢复。");
  }, [undoToken, locked, history]);
  useEffect(() => {
    if (finished && !paused && !reported.current) {
      reported.current = true;
      onComplete();
    }
  }, [finished, paused, onComplete]);
  function play(index: number) {
    if (locked || outOfTurns) return;
    const result = apply(puzzle, state, used, index);
    setSuggested(null);
    if ("reason" in result) {
      say(result.reason);
      return;
    }
    setHistory([...history, result.tree]);
    say(
      used + 1 === puzzle.turns && !won(puzzle, result.tree)
        ? "步数已用完，树还不一样。撤销或重来都可以。"
        : `规则 ${index + 1} 同时改变了 ${result.count} 个芽。`,
    );
  }
  return (
    <div
      className="puzzle-layout orchard-game"
      data-orchard-id={puzzle.id}
      data-orchard-won={finished}
      data-orchard-used={used}
      onKeyDown={(e) => {
        if (
          locked ||
          outOfTurns ||
          e.repeat ||
          e.ctrlKey ||
          e.altKey ||
          e.metaKey ||
          !/^[1-9]$/.test(e.key)
        )
          return;
        const index = Number(e.key) - 1;
        if (index >= puzzle.cards.length) return;
        e.preventDefault();
        play(index);
      }}
    >
      <section
        className="orchard-panel"
        tabIndex={0}
        aria-label="树园棋盘，按数字键使用对应规则"
      >
        <header>
          <span>递归树园 · 第 {level + 1} 关</span>
          <strong>剩余 {puzzle.turns - used} 步</strong>
        </header>
        <div
          className="orchard-comparison"
          data-compact={Math.max(leaves(state), leaves(puzzle.target)) <= 4}
        >
          <TreeView tree={state} target={false} />
          <TreeView tree={puzzle.target} target={true} />
        </div>
        <p className="orchard-limits">
          圆形 A/B 是芽 · 方形 X/Y 是叶 · 末端上限 {puzzle.leafLimit}
        </p>
        <div className="orchard-cards" role="group" aria-label="生长规则">
          {puzzle.cards.map((card, index) => {
            const { count, fits } = predict(puzzle, state, index);
            return (
              <button
                key={index}
                type="button"
                disabled={locked || outOfTurns}
                data-orchard-card={index + 1}
                data-orchard-count={count}
                data-hinted={suggested === index}
                aria-label={`规则 ${index + 1}：${card.bud} 变成 ${notation(card.grows)}，${count} 个芽`}
                onClick={() => play(index)}
              >
                <small>{index + 1} · 规则</small>
                <b>
                  {card.bud} → {notation(card.grows)}
                </b>
                <span>
                  {!count
                    ? "无匹配芽"
                    : fits
                      ? `${count} 个芽`
                      : "超过末端上限"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="orchard-status" role="status">
          {paused
            ? "已暂停。"
            : finished
              ? "枝形、方向和叶子都对上了！"
              : message}
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">生长 · 顺序 · 分枝</span>
        <h3>一张规则，整棵树一起变。</h3>
        <ol>
          <li>选一张规则，所有匹配的旧芽同时生长；新芽等到下一步才能长。</li>
          <li>例如 A → (AB) 会让 A 长成左边 A、右边 B。左右不能交换。</li>
          <li>
            已形成的分枝和 X/Y 叶会保留。用完步数前，让当前树完全等于目标树。
          </li>
          <li>没有匹配的芽，或会超出末端上限，都不扣步数。走错可撤销。</li>
        </ol>
        <p>触屏点规则；键盘聚焦棋盘后按相应数字键。</p>
      </aside>
    </div>
  );
}
