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
  createPaperState,
  movePaper,
  paperCellLabel,
  paperCreaseLabel,
  paperHint,
  paperStep,
  paperWon,
  undoPaper,
  type PaperAction,
} from "./paperFoldLogic";
import { paperFoldLevels } from "./paperFoldLevels";
import PaperFoldScene from "./PaperFoldScene";
import "./paperFold.css";
export default function PaperFold(props: GameProps) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={host}
      className="paper-fold-host"
      data-paper-host
      tabIndex={-1}
      aria-label="折纸打孔工作区"
    >
      <PaperRound
        key={`${props.level}:${props.resetToken}`}
        {...props}
        host={host}
      />
    </div>
  );
}
function PaperRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
  host,
}: GameProps & { host: RefObject<HTMLDivElement | null> }) {
  const l = paperFoldLevels[level] ?? paperFoldLevels[0],
    [state, setState] = useState(() => createPaperState(l)),
    [preview, setPreview] = useState(false),
    [message, setMessage] = useState(
      "先读展开目标，选择公开折痕，再在叠层上打孔，最后展开检查。",
    );
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false),
    b = state.board,
    won = paperWon(l, b),
    locked = paused || won;
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
    onStatus(
      "每次打孔贯穿该处所有纸层。第一次打孔后不能继续折叠；展开才检查目标。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (!locked) status(paperHint(l, b));
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
        `展开后的 ${b.holes.length} 个孔全部吻合！用了 ${b.folds} 折、${b.punches} 次打孔。`,
      );
      onComplete();
    }
  }, [won, paused, onComplete]);
  function undo() {
    if (locked) return;
    const next = undoPaper(l, state);
    setState(next);
    status(
      next === state ? "还没有可以撤销的动作。" : "已恢复上一步纸层与孔位。",
    );
  }
  function act(a: PaperAction) {
    if (locked) return;
    const next = movePaper(l, state, a);
    if (next === state) {
      status(
        a.kind === "fold"
          ? "这道折痕当前不可用：必须两侧都有纸，折后不超出纸板，且尚未打孔。"
          : "这里暂时不能操作。打孔需要先折纸；空位、已打穿的叠层和用完的预算不能再次打孔。",
      );
      return;
    }
    setState(next);
    status(
      a.kind === "unfold"
        ? paperWon(l, next.board)
          ? "目标吻合。"
          : "展开后尚未吻合。可以撤销展开，再撤销错误的孔或折痕。"
        : a.kind === "fold"
          ? "纸层已反射。下面的原格列表按从底到顶排列。"
          : "这一叠中的全部原格已打穿。现在可以继续打孔或展开检查。",
    );
  }
  return (
    <div
      className="puzzle-layout paper-fold"
      data-paper-fold-game
      data-paper-won={won}
      data-paper-state={JSON.stringify(b)}
    >
      <section className="pf-workbench" aria-label="折纸打孔工作台">
        <div className="pf-heading">
          <span className="mini-label">折纸打孔 · {l.title}</span>
          <b>
            {b.folds}/{l.maxFolds} 折 · {b.punches}/{l.maxPunches} 孔
          </b>
        </div>
        <p className="pf-phase">
          {b.phase === "folding"
            ? b.folds >= l.maxFolds
              ? "① 折叠次数已用满，开始打孔"
              : "① 折纸：可以继续折，或开始打孔"
            : b.phase === "punching"
              ? "② 打孔：折痕已锁定，准备展开"
              : "③ 展开：逐个原格检查孔位"}
        </p>
        <div className="pf-folds" aria-label="本关公开允许的折痕">
          {l.creases.map((c) => (
            <button
              key={c.id}
              data-paper-fold={c.id}
              aria-disabled={
                locked || !paperStep(l, b, { kind: "fold", crease: c.id })
              }
              onClick={() => act({ kind: "fold", crease: c.id })}
            >
              <b>折痕 {c.id}</b>
              <span>{paperCreaseLabel(c)}</span>
            </button>
          ))}
        </div>
        <p className="pf-scroll-cue">
          纸板坐标固定，空位不会重新编号。窄屏可在纸板内左右滑动 ↔
        </p>
        <div
          className="pf-viewport"
          tabIndex={0}
          role="region"
          aria-label="当前纸板，可横向滚动"
        >
          <div
            className="pf-board"
            style={{ gridTemplateColumns: `repeat(${l.width}, 64px)` }}
            aria-label="纸板格子"
          >
            {b.stacks.map((stack, i) => {
              const unfolded = b.phase === "unfolded",
                hole = b.holes.includes(i),
                target = l.target.includes(i),
                newHoles = stack.filter((k) => !b.holes.includes(k)).length;
              return (
                <button
                  key={i}
                  data-paper-cell={i}
                  data-paper-layers={stack.join(",")}
                  aria-disabled={
                    locked || !paperStep(l, b, { kind: "punch", cell: i })
                  }
                  className={`${unfolded ? (hole ? "pf-hole " : "") + (target ? "pf-target-cell" : "") : stack.length ? "pf-stack" : "pf-empty"}`}
                  aria-label={
                    unfolded
                      ? `${paperCellLabel(l, i)}，${hole ? "有孔" : "无孔"}，目标${target ? "有孔" : "留白"}`
                      : `当前 ${paperCellLabel(l, i)}，${stack.length} 层，从底到顶原格 ${stack.map((k) => paperCellLabel(l, k)).join("、") || "无"}，可新打穿 ${newHoles} 格`
                  }
                  onClick={() => act({ kind: "punch", cell: i })}
                >
                  <small>
                    {Math.floor(i / l.width) + 1},{(i % l.width) + 1}
                  </small>
                  <b>
                    {unfolded
                      ? hole
                        ? "●"
                        : "·"
                      : stack.length
                        ? `${stack.length} 层`
                        : "空"}
                  </b>
                  <span>
                    {unfolded
                      ? target
                        ? "目标孔"
                        : "留白"
                      : stack.length
                        ? newHoles
                          ? "打孔"
                          : "已穿"
                        : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="pf-controls">
          <button
            data-paper-unfold
            aria-disabled={locked || !paperStep(l, b, { kind: "unfold" })}
            onClick={() => act({ kind: "unfold" })}
          >
            展开检查
          </button>
          <button
            data-paper-undo
            aria-disabled={locked || !state.history.length}
            onClick={undo}
          >
            撤销一步
          </button>
          <button
            data-paper-preview
            aria-pressed={preview}
            aria-disabled={paused}
            onClick={() => {
              if (!paused) setPreview(!preview);
            }}
          >
            {preview ? "关闭" : "打开"}叠层 3D 预览
          </button>
        </div>
        {preview && <PaperFoldScene level={l} board={b} paused={paused} />}
        <p role="status" className="pf-message">
          {paused
            ? "已暂停，纸层与孔位保持不变。"
            : won
              ? "完成！本轮已锁定，重来或换关可以重新折纸。"
              : message}
        </p>
        <details className="pf-layer-list" open>
          <summary>当前叠层原格清单（底 → 顶）</summary>
          <ul>
            {b.phase === "unfolded" ? (
              <li>
                纸张已展开。实际孔：
                {b.holes.map((i) => paperCellLabel(l, i)).join("、")}
              </li>
            ) : (
              b.stacks.map((stack, i) =>
                stack.length ? (
                  <li key={i}>
                    <b>当前 {paperCellLabel(l, i)}：</b>
                    {stack
                      .map(
                        (k) =>
                          `${paperCellLabel(l, k)}${b.holes.includes(k) ? "（已穿）" : ""}`,
                      )
                      .join(" → ")}
                  </li>
                ) : null,
              )
            )}
          </ul>
        </details>
      </section>
      <aside className="game-notes">
        <span className="mini-label">反射 · 层叠 · 逆向推理</span>
        <h3>一处小孔，展开后在哪里？</h3>
        <p>{l.lesson}</p>
        <div className="pf-target">
          <strong>展开目标 · {l.target.length} 个孔</strong>
          <div
            className="pf-target-grid"
            style={{ gridTemplateColumns: `repeat(${l.width}, 1fr)` }}
            aria-hidden="true"
          >
            {b.stacks.map((_, i) => (
              <span
                key={i}
                className={l.target.includes(i) ? "pf-target-mark" : ""}
              >
                {l.target.includes(i) ? "●" : "·"}
              </span>
            ))}
          </div>
          <p data-paper-target>
            目标孔：{l.target.map((i) => paperCellLabel(l, i)).join("、")}
            。其余原格全部留白。
          </p>
        </div>
        <div className="note">
          <strong>怎样玩？</strong>
          <ol>
            <li>
              只可使用列出的折痕。线号表示两列或两行之间的缝，箭头方向决定哪一侧翻过去。
            </li>
            <li>
              翻动的一叠顺序会倒过来，落在另一侧纸层上面。每格显示叠了几层，清单列出每一层来自哪里。
            </li>
            <li>
              至少折一次，再点击纸层打孔。一次贯穿所有层；打孔后不能追加折痕。
            </li>
            <li>
              按“展开检查”。必须刚好得到全部目标孔，不能多也不能少。预算是上限，不必用完。
            </li>
          </ol>
          {level === 0 && (
            <p>
              第一关小练习：两个目标原格是否关于一条公开折痕对称？打孔前查看它们是否已经叠在同一格。
            </p>
          )}
        </div>
        <p className="muted">
          Tab 选择按钮，Enter
          或空格操作。上方工具栏提供提示、暂停和重来；未完成时可以撤销，包括撤销展开。提示从当前真实纸层搜索，不会自动执行。
        </p>
      </aside>
    </div>
  );
}
