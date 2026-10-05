// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState, type RefObject } from "react";
import type { GameProps } from "../lib/types";
import {
  createSymmetryState,
  editSymmetry,
  symmetryCost,
  symmetryConflicts,
  symmetryHintSteps,
  symmetryOrbits,
  symmetryTransformNames,
  symmetryWon,
  undoSymmetry,
  type SymmetryCell,
  type SymmetryHint,
} from "./symmetryRepairLogic";
import { symmetryRepairLevels } from "./symmetryRepairLevels";
import { runLabSearch, useLabFocus } from "./symmetryProbabilityRound";
import "./symmetryProbability.css";
export default function SymmetryRepair(props: GameProps) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <div
      className="sp-lab sr-host"
      data-symmetry-host
      ref={host}
      tabIndex={-1}
      aria-label="对称修补工作区"
    >
      <SymmetryRound
        key={`${props.level}:${props.resetToken}`}
        {...props}
        host={host}
      />
    </div>
  );
}
function SymmetryRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
  host,
}: GameProps & { host: RefObject<HTMLDivElement | null> }) {
  const l = symmetryRepairLevels[level] ?? symmetryRepairLevels[0];
  const [state, setState] = useState(() => createSymmetryState(l)),
    [paint, setPaint] = useState<SymmetryCell>(1),
    [selected, setSelected] = useState(0),
    [hint, setHint] = useState<Extract<
      SymmetryHint,
      { status: "found" }
    > | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      "先选择填充或留空，再点格子。锁定格提供固定线索。",
    );
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    notified = useRef(false),
    task = useRef<AbortController | null>(null),
    buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const won = symmetryWon(l, state.board),
    locked = paused || won,
    cost = symmetryCost(l, state.board),
    conflicts = symmetryConflicts(l, state.board),
    orbits = symmetryOrbits(l),
    selectedOrbit = orbits.find((o) => o.includes(selected)) ?? [];
  useLabFocus(host);
  const say = (s: string) => {
    setMessage(s);
    onStatus(s);
  };
  const cancel = () => {
    task.current?.abort();
    task.current = null;
    setBusy(false);
    setHint(null);
  };
  useEffect(() => {
    onStatus(l.lesson);
    return () => task.current?.abort();
  }, []);
  useEffect(() => {
    if (locked) cancel();
  }, [locked]);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (locked) return;
    cancel();
    const controller = new AbortController();
    task.current = controller;
    setBusy(true);
    say("正在比较公开条件下的可行图案；只搜索有限的对称轨道。");
    void runLabSearch(
      symmetryHintSteps(l, state.board),
      controller.signal,
    ).then((result) => {
      if (!result || controller.signal.aborted) return;
      setBusy(false);
      if (result.status === "found") {
        setHint(result);
        say(
          `提示：第 ${Math.floor(result.index / l.size) + 1} 行、第 ${(result.index % l.size) + 1} 列设为${result.value === 1 ? "填充" : result.value === 0 ? "留空" : "未定"}。已完整搜索公开条件，最近可行图案还需修改 ${result.changes} 格；可能需改回已有选择。提示不会自动操作。`,
        );
      } else
        say(
          result.status === "budget"
            ? "已达到搜索上限，无法给出可靠的最少改动建议；这不表示无解。"
            : result.status === "solved"
              ? "当前图案已符合全部条件。"
              : "完整检查公开条件后没有可行图案。",
        );
    });
    return () => controller.abort();
  }, [hintToken, locked, state.board]);
  function undo() {
    if (locked) return;
    cancel();
    const next = undoSymmetry(l, state);
    setState(next);
    say(
      next === state
        ? "还没有可撤销的编辑。"
        : "已撤销上一次编辑，预算一同恢复。",
    );
  }
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (!locked) undo();
  }, [undoToken, locked]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      cancel();
      say("全部对称、填充总数和修补预算均已满足！");
      onComplete();
    }
  }, [won, paused]);
  function edit(index: number, value = paint) {
    if (locked) return;
    cancel();
    setSelected(index);
    if (l.locked.includes(index)) {
      say("这是锁定线索，可以查看它的对称轨道，但不能编辑。");
      return;
    }
    if (value === null && l.initial[index] !== null) {
      say("只有最初标为 ? 的格子可以恢复为未定。");
      return;
    }
    const next = editSymmetry(l, state, index, value);
    setState(next);
    say(
      next === state
        ? state.board[index] === value
          ? "此格已经是所选状态。"
          : "修补预算已满。先把某个格子恢复到起始状态，再继续。"
        : "图案已更新。轨道内所有格子最终必须相同；所有 ? 必须确定。",
    );
  }
  return (
    <div
      className="puzzle-layout sp-layout"
      data-symmetry-game
      data-symmetry-board={state.board
        .map((v) => (v === null ? "?" : v))
        .join("")}
      data-symmetry-won={won}
    >
      <section className="sp-workbench">
        <div className="sp-heading">
          <span className="mini-label">对称修补 · {l.title}</span>
          <strong>{paused ? "已暂停" : won ? "已完成" : "修补实验"}</strong>
        </div>
        <p>{l.lesson}</p>
        <div className="sp-metrics">
          <span>
            填充{" "}
            <b>
              {state.board.filter((v) => v === 1).length} / {l.filled}
            </b>
          </span>
          <span>
            净改动{" "}
            <b>
              {cost} / {l.budget}
            </b>
          </span>
          <span>
            未定 <b>{state.board.filter((v) => v === null).length}</b>
          </span>
        </div>
        <div className="sp-rules" aria-label="全部公开目标">
          <b>每条规则都须满足</b>
          <ul>
            {l.transforms.map((t) => (
              <li key={t}>{symmetryTransformNames[t]}：变换前后图案相同</li>
            ))}
            <li>恰好 {l.filled} 个填充格；没有未定格</li>
            <li>锁定格保持原样；与起始图案不同的格子不超过 {l.budget} 个</li>
          </ul>
        </div>
        <p className="sp-help">
          预算按净改动格数计算，不按点击次数。把 ? 确定为填充或留空也占 1
          格；恢复起始值会退回预算。任何满足条件的图案都可以。
        </p>
        <div className="sp-tools" role="group" aria-label="选择画笔">
          {(
            [
              [1, "■ 填充"],
              [0, "□ 留空"],
              [null, "? 恢复未定"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={label}
              disabled={locked}
              aria-pressed={paint === value}
              onClick={() => setPaint(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="sr-grid"
          role="group"
          aria-label={`${l.size} 行 ${l.size} 列修补格，方向键移动，F 填充，E 留空，问号恢复未定`}
          style={{
            gridTemplateColumns: `repeat(${l.size}, minmax(44px, 1fr))`,
          }}
        >
          {state.board.map((v, i) => (
            <button
              key={i}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              disabled={locked}
              data-symmetry-cell={i}
              data-value={v === null ? "?" : v}
              data-locked={l.locked.includes(i)}
              data-orbit={selectedOrbit.includes(i)}
              data-conflict={conflicts.has(i)}
              data-hint={hint?.index === i}
              aria-label={`第 ${Math.floor(i / l.size) + 1} 行第 ${(i % l.size) + 1} 列，${v === 1 ? "填充" : v === 0 ? "留空" : "未定"}${l.locked.includes(i) ? "，锁定" : ""}${conflicts.has(i) ? "，轨道冲突" : ""}`}
              onFocus={() => setSelected(i)}
              onClick={() => edit(i)}
              onKeyDown={(e) => {
                if (e.ctrlKey || e.metaKey || e.altKey || locked) return;
                const d =
                  e.key === "ArrowLeft"
                    ? -1
                    : e.key === "ArrowRight"
                      ? 1
                      : e.key === "ArrowUp"
                        ? -l.size
                        : e.key === "ArrowDown"
                          ? l.size
                          : 0;
                if (d) {
                  e.preventDefault();
                  const r = Math.floor(i / l.size),
                    c = i % l.size;
                  const next =
                    e.key === "ArrowLeft"
                      ? r * l.size + ((c + l.size - 1) % l.size)
                      : e.key === "ArrowRight"
                        ? r * l.size + ((c + 1) % l.size)
                        : (i + d + state.board.length) % state.board.length;
                  buttons.current[next]?.focus({ preventScroll: true });
                } else if (
                  e.key.toLowerCase() === "f" ||
                  e.key.toLowerCase() === "e" ||
                  e.key === "?"
                ) {
                  e.preventDefault();
                  edit(
                    i,
                    e.key === "?" ? null : e.key.toLowerCase() === "f" ? 1 : 0,
                  );
                }
              }}
            >
              <span className="sr-value">
                {v === 1 ? "■" : v === 0 ? "□" : "?"}
              </span>
              <span className="sr-badges">
                {l.locked.includes(i)
                  ? "锁"
                  : conflicts.has(i)
                    ? "!"
                    : hint?.index === i
                      ? "提示"
                      : " "}
              </span>
            </button>
          ))}
        </div>
        <p className="sp-orbit" data-symmetry-orbit>
          当前轨道（同值组）：
          {selectedOrbit
            .map((i) => `${Math.floor(i / l.size) + 1}行${(i % l.size) + 1}列`)
            .join("、")}
          。共 {selectedOrbit.length} 格。
        </p>
        <details>
          <summary>查看起始图案与标记</summary>
          <p>
            ■ 填充，□ 留空，? 未定，锁 = 固定线索，! =
            同组出现不同已知状态；边框勾勒当前轨道。冲突不靠颜色表达。
          </p>
          <ol className="sr-original">
            {Array.from({ length: l.size }, (_, r) => (
              <li key={r}>
                第 {r + 1} 行：
                {l.initial
                  .slice(r * l.size, (r + 1) * l.size)
                  .map((v) => (v === 1 ? "■" : v === 0 ? "□" : "?"))
                  .join(" ")}
              </li>
            ))}
          </ol>
        </details>
      </section>
      <aside className="sp-panel">
        <h3>修补记录</h3>
        <p role="status" aria-live="polite" data-symmetry-status>
          {message}
        </p>
        <button
          type="button"
          disabled={locked || !state.history.length}
          onClick={undo}
        >
          撤销一次编辑
        </button>
        <button
          type="button"
          disabled={!busy || locked}
          onClick={() => {
            cancel();
            say("已取消提示搜索。当前图案保持原样。");
          }}
        >
          取消提示搜索
        </button>
        <p>
          提示从当前图案重新搜索，最多检查 32,768
          种轨道分配。若找到最近解，会明确建议需要改回的格子。
        </p>
        <p>
          方向键移动焦点；F 填充、E 留空、? 恢复未定；也可用画笔后点击或 Enter /
          空格。
        </p>
        {won && <strong className="sp-success">✓ 对称修补完成</strong>}
      </aside>
    </div>
  );
}
