// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  inspect,
  nextJoint,
  materialKeys,
  materialNames,
  toolNames,
  type JointState,
  type Node,
} from "./recyclingWorkshopLogic";
import { recyclingWorkshopLevels } from "./recyclingWorkshopLevels";
import "./recyclingWorkshop.css";

const intro = "选择一个能拆的接头，先看会用掉什么工具、收回哪些材料。";
const success = "三种材料都达到目标！";
const states: Record<JointState, string> = {
  sealed: "外层未拆",
  available: "可拆",
  empty: "工具用完",
  opened: "已拆开",
  sorted: "自动分拣",
};

export default function RecyclingWorkshop(props: GameProps) {
  return <Round key={props.level + ":" + props.resetToken} {...props} />;
}

function Round({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const board = recyclingWorkshopLevels[level] ?? recyclingWorkshopLevels[0];
  const [order, setOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState(intro);
  const state = inspect(board, order);
  const locked = paused || state.won;
  const preview =
    selected && state.joints[selected] === "available"
      ? inspect(board, [...order, selected])
      : null;
  const spent = preview
    ? state.tools[0] > preview.tools[0]
      ? "C"
      : "S"
    : null;
  const gain = preview ? preview.bins.map((n, i) => n - state.bins[i]) : [];
  const live = useRef({ onStatus, onComplete });
  live.current = { onStatus, onComplete };
  const tokens = useRef({ hintToken, undoToken });

  function report(s: string) {
    setMessage(s);
    live.current.onStatus(s);
  }
  useEffect(() => {
    live.current.onStatus(intro);
  }, []);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const next = nextJoint(board, order);
    report(
      next
        ? "可以先拆接头 " + next + "，这里还有可行路线。"
        : "剩余工具已无法达成配额。先撤销一个接头，再换顺序。",
    );
  }, [hintToken, locked, board, order]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    setSelected(null);
    if (!order.length) {
      report("还没有拆开的接头，已清空预览。");
      return;
    }
    setOrder(order.slice(0, -1));
    report("已撤销上一次拆解，工具和材料计数已恢复。");
  }, [undoToken, locked, order]);

  function select(id: string) {
    if (locked || state.joints[id] !== "available") return;
    setSelected(id);
    setMessage("已选接头 " + id + "，尚未消耗工具。");
  }
  function apply() {
    if (locked || !selected || !preview) return;
    setOrder([...order, selected]);
    setSelected(null);
    if (preview.won) {
      report(success);
      live.current.onComplete();
    } else report("已拆开 " + selected + "。露出的单一材料已自动入箱。");
  }

  return (
    <div
      className="puzzle-layout rw-game"
      data-level-id={board.id}
      data-order={order.join("")}
      data-bins={state.bins.join(",")}
      data-tools={state.tools.join(",")}
      data-selected={selected ?? ""}
      data-gain={gain.join(",")}
      data-won={state.won}
    >
      <section className="rw-studio" aria-label="回收操作台">
        <header className="rw-heading">
          <div>
            <small>拆解工坊 · 第 {level + 1} 关</small>
            <h3>拆对了，再回收</h3>
          </div>
          <strong>{state.won ? "已达标" : "回收配额"}</strong>
        </header>
        <div className="rw-bins" role="group" aria-label="各材料回收量与目标">
          {materialKeys.map((key, i) => (
            <div key={key} data-ready={state.bins[i] >= board.goal[i]}>
              <span>
                <MaterialIcon type={key} />
                {materialNames[key]}
              </span>
              <strong>
                {state.bins[i]}
                <small> / {board.goal[i]}</small>
              </strong>
              <span className="rw-bin-foot">
                {state.bins[i] >= board.goal[i]
                  ? "✓ 达标"
                  : "还缺 " + (board.goal[i] - state.bins[i])}
              </span>
            </div>
          ))}
        </div>
        <div className="rw-tools" role="group" aria-label="剩余工具">
          <b>工具次数</b>
          <span>
            <ToolIcon type="C" />
            卡扣 {state.tools[0]}
          </span>
          <span>
            <ToolIcon type="S" />
            螺丝 {state.tools[1]}
          </span>
        </div>
        <div className="rw-bench">
          <div className="rw-bench-title">
            <h4>拆解台</h4>
            <small>从上往下 · 实线接头可选</small>
          </div>
          <div className="rw-workpieces">
            {board.objects.map((node, i) => (
              <div
                className="rw-item"
                key={i}
                role="group"
                aria-label={"物件 " + (i + 1)}
              >
                <small>物件 {i + 1}</small>
                <Branch
                  node={node}
                  statesById={state.joints}
                  chosen={selected}
                  select={select}
                  locked={locked}
                />
              </div>
            ))}
          </div>
          <div className="rw-key">
            <span>
              <MaterialIcon type="P" />纸
            </span>
            <span>
              <MaterialIcon type="M" />
              金属
            </span>
            <span>
              <MaterialIcon type="G" />
              玻璃
            </span>
            <span>
              <MaterialIcon type="X" />
              残余
            </span>
          </div>
        </div>
        <div className="rw-draft">
          <div className="rw-preview" aria-label="拆解预览">
            <strong>{preview ? "拆开接头 " + selected : "拆解预览"}</strong>
            {spent ? (
              <span>
                <ToolIcon type={spent} />
                {toolNames[spent]} −1 ·{" "}
                {gain.some(Boolean)
                  ? gain
                      .map((n, i) =>
                        n ? materialNames[materialKeys[i]] + " +" + n : "",
                      )
                      .filter(Boolean)
                      .join("、")
                  : "只露出内层，无材料入箱"}
              </span>
            ) : (
              <span>
                {state.won
                  ? "配额达成，剩下的物件不必再拆。"
                  : "选实线接头，查看费用和可回收材料。"}
              </span>
            )}
          </div>
          <button
            type="button"
            className="rw-apply"
            disabled={locked || !preview}
            onClick={apply}
          >
            确认拆开
          </button>
        </div>
        <p className="rw-message" role="status">
          {paused ? "已暂停。" : state.won ? success : message}
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">材料 · 资源 · 拆解顺序</span>
        <h3>不是每个物件都值得拆。</h3>
        <ol>
          <li>物件从最上方往下拆。外层未开时，里面的接头不能动。</li>
          <li>
            每拆一个混合材料接头，消耗一次对应工具。露出的单一材料直接进箱，不再花工具。残余不计。
          </li>
          <li>
            用有限的两种工具达到所有配额。多回收也算达标，不必拆完。Tab
            选择、空格或回车操作。
          </li>
        </ol>
        <p>这是游戏规则。实际物品是否可回收，要看当地设施和规定。</p>
      </aside>
    </div>
  );
}

function ToolIcon({ type }: { type: "C" | "S" }) {
  return <i className="rw-tool-icon" data-tool={type} aria-hidden="true" />;
}

function MaterialIcon({ type }: { type: keyof typeof materialNames }) {
  return <i className="rw-material" data-mat={type} aria-hidden="true" />;
}

function Branch({
  node,
  statesById,
  chosen,
  select,
  locked,
}: {
  node: Node;
  statesById: Record<string, JointState>;
  chosen: string | null;
  select: (id: string) => void;
  locked: boolean;
}) {
  if ("material" in node)
    return (
      <span
        className="rw-leaf"
        title={materialNames[node.material]}
        role="img"
        aria-label={materialNames[node.material]}
      >
        <MaterialIcon type={node.material} />
      </span>
    );
  const state = statesById[node.id];
  return (
    <div className="rw-branch" data-branch={state}>
      <button
        type="button"
        data-joint={node.id}
        data-state={state}
        disabled={locked || state !== "available"}
        aria-pressed={chosen === node.id}
        aria-label={
          node.id + " · " + toolNames[node.tool] + " · " + states[state]
        }
        title={states[state]}
        onClick={() => select(node.id)}
      >
        <ToolIcon type={node.tool} />
        {node.id}
        {(state === "opened" || state === "sorted") && (
          <small aria-hidden="true">✓</small>
        )}
        {state === "empty" && <small aria-hidden="true">0</small>}
      </button>
      <div className="rw-children">
        {node.parts.map((part, i) => (
          <Branch
            key={i}
            node={part}
            statesById={statesById}
            chosen={chosen}
            select={select}
            locked={locked}
          />
        ))}
      </div>
    </div>
  );
}
