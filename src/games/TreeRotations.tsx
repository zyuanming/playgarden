// SPDX-License-Identifier: MIT
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { GameProps } from "../lib/types";
import {
  createTreeState,
  findTreeNode,
  moveTree,
  treeHint,
  treeMetrics,
  treeShape,
  treeWon,
  undoTree,
  type SearchTree,
  type TreeMove,
} from "./treeRotationsLogic";
import { treeRotationsLevels } from "./treeRotationsLevels";
import "./treeRotations.css";
export default function TreeRotations(props: GameProps) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={host}
      className="tree-rotations-host"
      data-tree-host
      tabIndex={-1}
      aria-label="树形旋转工作区"
    >
      <TreeRound
        key={`${props.level}:${props.resetToken}`}
        {...props}
        host={host}
      />
    </div>
  );
}
function TreeRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
  host,
}: GameProps & { host: RefObject<HTMLDivElement | null> }) {
  const l = treeRotationsLevels[level] ?? treeRotationsLevels[0],
    [state, setState] = useState(() => createTreeState(l)),
    [selected, setSelected] = useState(l.order[0]),
    [message, setMessage] = useState(
      "选择一个节点，再选择左旋或右旋。根的深度从 1 开始计。",
    );
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false),
    won = treeWon(l, state.tree),
    locked = paused || won,
    m = treeMetrics(state.tree, l.weights),
    node = findTreeNode(state.tree, selected)!;
  // The keyed round is about to disappear. Repair only its own internal focus;
  // the stable host survives reset/level changes and never scrolls the page.
  useLayoutEffect(
    () => () => {
      const container = host.current;
      if (
        container &&
        document.activeElement !== container &&
        container.contains(document.activeElement)
      ) {
        container.focus({ preventScroll: true });
      }
    },
    [host],
  );
  const status = (s: string) => {
    setMessage(s);
    onStatus(s);
  };
  useEffect(() => {
    onStatus("左旋让右孩子上升，右旋让左孩子上升。中序键值顺序保持不变。");
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (!locked) status(treeHint(l, state.tree));
  }, [hintToken]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (!locked) undo();
  }, [undoToken]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      status(
        `全部目标达成！${state.history.length} 次旋转，树高 ${m.height}，加权成本 ${m.cost}。`,
      );
      onComplete();
    }
  }, [won, paused, onComplete]);
  function undo() {
    if (locked) return;
    const next = undoTree(l, state);
    setState(next);
    status(
      next === state
        ? "还没有可撤销的旋转。"
        : "已恢复上一步树形。选择的键仍保持不变。",
    );
  }
  function act(direction: TreeMove["direction"]) {
    if (locked) return;
    const next = moveTree(l, state, { key: selected, direction });
    if (next === state) {
      status(
        `节点 ${selected} 没有${direction === "left" ? "右" : "左"}孩子，不能${direction === "left" ? "左" : "右"}旋。`,
      );
      return;
    }
    setState(next);
    status(
      `节点 ${selected} 已${direction === "left" ? "左" : "右"}旋。内侧子树转交给下降的旧父节点；键值顺序不变。`,
    );
  }
  const nodes: SearchTree[] = [];
  const visit = (n: SearchTree | null) => {
    if (!n) return;
    nodes.push(n);
    visit(n.left);
    visit(n.right);
  };
  visit(state.tree);
  const width = l.order.length * 74,
    height = m.height * 100 + 18,
    point = (key: number) => ({
      x: (key - 0.5) * 74,
      y: (m.depths[key] - 1) * 100 + 42,
    });
  return (
    <div
      className="puzzle-layout tree-rotations"
      data-tree-rotations-game
      data-tree-rotations-won={won}
      data-tree-shape={treeShape(state.tree)}
    >
      <section className="tr-workbench" aria-label="二叉搜索树旋转工作台">
        <div className="tr-heading">
          <span className="mini-label">树形旋转 · {l.title}</span>
          <b>{state.history.length} 次旋转</b>
        </div>
        <div className="tr-metrics">
          <span>
            树高 <b>{m.height}</b> / {l.goal.maxHeight}
          </span>
          <span>
            每枝平衡 <b>{m.balanced ? "是" : "否"}</b>
          </span>
          <span>
            成本 <b>{m.cost}</b>
            {l.goal.maxCost !== undefined ? ` / ${l.goal.maxCost}` : ""}
          </span>
        </div>
        <p className="tr-scroll-cue">
          键值从左到右递增。树形可在框内横向滚动 ↔；下方关系表保留全部父子信息。
        </p>
        <div
          className="tr-viewport"
          role="region"
          aria-label="树形图，可横向滚动"
          tabIndex={0}
        >
          <div className="tr-board" style={{ width, height }}>
            <svg
              width={width}
              height={height}
              aria-hidden="true"
              className="tr-edges"
            >
              {nodes.flatMap((n) =>
                [n.left, n.right].flatMap((child) => {
                  if (!child) return [];
                  const a = point(n.key),
                    b = point(child.key),
                    dx = b.x - a.x,
                    dy = b.y - a.y,
                    d = Math.hypot(dx, dy),
                    pad = 31;
                  return [
                    <line
                      key={`${n.key}-${child.key}`}
                      x1={a.x + (dx * pad) / d}
                      y1={a.y + (dy * pad) / d}
                      x2={b.x - (dx * pad) / d}
                      y2={b.y - (dy * pad) / d}
                    />,
                  ];
                }),
              )}
            </svg>
            {Array.from({ length: l.order.length }, (_, i) => i + 1).map(
              (key) => {
                const p = point(key);
                return (
                  <button
                    key={key}
                    data-tree-node={key}
                    aria-pressed={selected === key}
                    aria-disabled={locked}
                    className={selected === key ? "tr-selected" : ""}
                    style={{ left: p.x - 28, top: p.y - 30 }}
                    aria-label={`选择节点 ${key}，深度 ${m.depths[key]}，权重 ${l.weights[key - 1]}${key === state.tree.key ? "，树根" : ""}`}
                    onFocus={(e) => {
                      const viewport = e.currentTarget.closest(
                        ".tr-viewport",
                      ) as HTMLElement | null;
                      if (viewport) {
                        const left = e.currentTarget.offsetLeft,
                          right = left + 56;
                        if (left < viewport.scrollLeft)
                          viewport.scrollLeft = left;
                        else if (
                          right >
                          viewport.scrollLeft + viewport.clientWidth
                        )
                          viewport.scrollLeft = right - viewport.clientWidth;
                      }
                    }}
                    onClick={() => {
                      if (!locked) setSelected(key);
                    }}
                  >
                    <b>{key}</b>
                    <small>权 {l.weights[key - 1]}</small>
                    {key === state.tree.key && (
                      <span className="tr-root-label">根</span>
                    )}
                  </button>
                );
              },
            )}
          </div>
        </div>
        <div className="tr-selection">
          <strong>已选节点 {selected}</strong>
          <span>
            左孩子 {node.left?.key ?? "无"} · 右孩子 {node.right?.key ?? "无"}
          </span>
        </div>
        <div className="tr-controls">
          <button
            data-tree-rotate="left"
            aria-disabled={locked || !node.right}
            onClick={() => act("left")}
          >
            左旋{" "}
            <small>
              {node.right ? `让 ${node.right.key} 上升` : "需要右孩子"}
            </small>
          </button>
          <button
            data-tree-rotate="right"
            aria-disabled={locked || !node.left}
            onClick={() => act("right")}
          >
            右旋{" "}
            <small>
              {node.left ? `让 ${node.left.key} 上升` : "需要左孩子"}
            </small>
          </button>
          <button
            data-tree-undo
            aria-disabled={locked || !state.history.length}
            onClick={undo}
          >
            撤销一步
          </button>
        </div>
        <p role="status" className="tr-message">
          {paused
            ? "已暂停，树形与选择保持不变。"
            : won
              ? "全部公开目标已满足。本轮已锁定，重来或换关可继续。"
              : message}
        </p>
        <details className="tr-relations" open>
          <summary>当前父子关系与成本明细</summary>
          <ul>
            {[...nodes]
              .sort((a, b) => a.key - b.key)
              .map((n) => (
                <li key={n.key}>
                  <b>键 {n.key}</b>：左 {n.left?.key ?? "无"}，右{" "}
                  {n.right?.key ?? "无"}；深度 {m.depths[n.key]} × 权重{" "}
                  {l.weights[n.key - 1]} ={" "}
                  {m.depths[n.key] * l.weights[n.key - 1]}
                </li>
              ))}
          </ul>
        </details>
      </section>
      <aside className="game-notes">
        <span className="mini-label">数据结构 · 局部变化 · 全局规划</span>
        <h3>键不变，搜索路径变短。</h3>
        <p>{l.lesson}</p>
        <div className="tr-goal">
          <strong>本关公开目标</strong>
          <ul>
            <li>
              树高至多 {l.goal.maxHeight} 层{" "}
              {m.height <= l.goal.maxHeight ? "✓" : "○"}
            </li>
            {l.goal.balanced && (
              <li>每个节点的左右子树高度差 ≤ 1 {m.balanced ? "✓" : "○"}</li>
            )}
            {l.goal.root !== undefined && (
              <li>
                树根为键 {l.goal.root}{" "}
                {state.tree.key === l.goal.root ? "✓" : "○"}
              </li>
            )}
            {l.goal.maxCost !== undefined && (
              <li>
                加权搜索成本 ≤ {l.goal.maxCost}{" "}
                {m.cost <= l.goal.maxCost ? "✓" : "○"}
              </li>
            )}
          </ul>
          <p>
            公开权重：{l.weights.map((w, i) => `键 ${i + 1} = ${w}`).join("；")}
            。
          </p>
        </div>
        <div className="note">
          <strong>怎样旋转？</strong>
          <ol>
            <li>
              点击一个节点，再点“左旋”或“右旋”。Tab、Enter 和空格也可以操作。
            </li>
            <li>
              左旋：右孩子升上来，选中节点落到它的左边；上升节点原有的左子树接到旧父节点右边。右旋完全相反。
            </li>
            <li>
              始终满足“左边键小，右边键大”。旋转只换关系，不新增、删除或交换键。
            </li>
            <li>
              根深度为 1；成本 = 每个键的权重 ×
              深度，再相加。所有公开目标同时满足就完成。
            </li>
          </ol>
          {level === 0 && (
            <p>
              先选择最上面的键 1。它的右孩子是谁？左旋按钮会告诉你谁将上升。
            </p>
          )}
        </div>
        <p className="muted">
          任何达标树形都算通关。提示完整搜索当前树形的最短续解，最多 429
          种形状。上方工具栏提供暂停、提示和重来。
        </p>
      </aside>
    </div>
  );
}
