import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import type { GameProps } from "../lib/types";
import {
  constraintInput,
  createConstraintState,
  futoshikiConflicts,
  futoshikiLevels,
  getFutoshikiHint,
  isFutoshikiSolved,
  undoConstraint,
  type ConstraintHint,
} from "./futoshikiLogic";
import "./numberConstraints.css";

type RoundRules = {
  size: number;
  givens: number[];
  introduction: string;
  celebration: string;
  solved: (values: readonly number[]) => boolean;
  conflicts: (values: readonly number[]) => number[];
  hint: (values: readonly number[]) => ConstraintHint | null;
};
/** Shared lifecycle/input only. Each game renders its own rule-specific board. */
export function useConstraintRound(props: GameProps, rules: RoundRules) {
  const { paused, hintToken, undoToken, onComplete, onStatus } = props;
  const [state, setState] = useState(() => createConstraintState(rules.givens));
  const [selected, setSelected] = useState(
    Math.max(0, rules.givens.indexOf(0)),
  );
  const [noteMode, setNoteMode] = useState(false);
  const [hint, setHint] = useState<ConstraintHint | null>(null);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const won = rules.solved(state.values),
    conflicts = rules.conflicts(state.values);
  useEffect(() => {
    callbacks.current.onStatus(rules.introduction);
  }, []);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    callbacks.current.onStatus(rules.celebration);
    callbacks.current.onComplete();
  }, [won, paused, rules.celebration]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const next = rules.hint(state.values);
    setHint(next);
    if (next) {
      setSelected(next.index);
      cells.current[next.index]?.focus();
      callbacks.current.onStatus(
        `第 ${Math.floor(next.index / rules.size) + 1} 行第 ${(next.index % rules.size) + 1} 列：${next.reason}${next.kind === "deduction" ? ` ${next.value}。` : ""}`,
      );
    } else
      callbacks.current.onStatus(
        "暂时没有可确认的提示。先检查已填数字与全部线索。",
      );
  }, [hintToken, paused, won, rules, state.values]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setState((current) => undoConstraint(current));
    setHint(null);
    callbacks.current.onStatus(
      state.history.length
        ? "已撤销上一次填写，数字和候选笔记都恢复了。"
        : "还没有可以撤销的填写。",
    );
  }, [undoToken, paused, state.history.length]);
  function input(value: number) {
    if (paused || won) return;
    const next = constraintInput(
      state,
      rules.givens,
      rules.size,
      selected,
      value,
      noteMode,
    );
    if (next === state) return;
    setState(next);
    setHint(null);
    callbacks.current.onStatus(
      rules.conflicts(next.values).length
        ? "带 ! 的位置与线索冲突。可以修改、清空或撤销。"
        : noteMode && value
          ? "已更新候选笔记；笔记不算正式填写。"
          : "已记录数字。继续结合行、列与边上的线索。",
    );
  }
  function toggleNotes() {
    if (!paused && !won) setNoteMode((current) => !current);
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey || paused || won) return;
    if (/^[1-5]$/.test(event.key) && Number(event.key) <= rules.size) {
      event.preventDefault();
      input(Number(event.key));
    } else if (["0", "Delete", "Backspace"].includes(event.key)) {
      event.preventDefault();
      input(0);
    } else if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      toggleNotes();
    }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta: Record<string, number> = {
      ArrowUp: -rules.size,
      ArrowDown: rules.size,
      ArrowLeft: -1,
      ArrowRight: 1,
    };
    if (!(event.key in delta) || paused || won) return;
    event.preventDefault();
    event.stopPropagation();
    let next = index;
    while (true) {
      const previous = next;
      next += delta[event.key];
      if (
        next < 0 ||
        next >= rules.size * rules.size ||
        ((event.key === "ArrowLeft" || event.key === "ArrowRight") &&
          Math.floor(previous / rules.size) !== Math.floor(next / rules.size))
      )
        return;
      if (!rules.givens[next]) {
        setSelected(next);
        cells.current[next]?.focus();
        return;
      }
    }
  }
  return {
    state,
    selected,
    setSelected,
    noteMode,
    hint,
    cells,
    won,
    conflicts,
    input,
    toggleNotes,
    keyboard,
    navigate,
    paused,
  };
}
export type ConstraintRound = ReturnType<typeof useConstraintRound>;
export function ConstraintNumberPad({
  round,
  size,
}: {
  round: ConstraintRound;
  size: number;
}) {
  return (
    <>
      <div
        className="nc-input-pad"
        style={{ "--nc-size": size } as CSSProperties}
        role="group"
        aria-label="填入数字"
      >
        {Array.from({ length: size }, (_, i) => i + 1).map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${round.noteMode ? "笔记" : "填入"} ${value}`}
            disabled={round.paused || round.won}
            onClick={() => round.input(value)}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          className="nc-erase"
          aria-label="清空所选格"
          disabled={round.paused || round.won}
          onClick={() => round.input(0)}
        >
          清空
        </button>
      </div>
      <button
        type="button"
        className="nc-notes-toggle"
        aria-pressed={round.noteMode}
        disabled={round.paused || round.won}
        onClick={round.toggleNotes}
      >
        ✎ 候选笔记 {round.noteMode ? "已开启" : "已关闭"}
      </button>
    </>
  );
}
export function ConstraintCell({
  round,
  size,
  index,
  given,
  game,
  style,
}: {
  round: ConstraintRound;
  size: number;
  index: number;
  given: boolean;
  game: "futoshiki" | "skyline";
  style?: CSSProperties;
}) {
  const value = round.state.values[index],
    conflict = round.conflicts.includes(index),
    notes = round.state.notes[index];
  return (
    <button
      type="button"
      ref={(element) => {
        round.cells.current[index] = element;
      }}
      className={`nc-cell ${given ? "nc-given" : ""} ${round.selected === index ? "nc-selected" : ""} ${conflict ? "nc-conflict" : ""} ${round.hint?.index === index ? "nc-hinted" : ""}`}
      style={style}
      data-constraint-cell={index}
      data-constraint-game={game}
      data-value={value}
      data-given={given}
      aria-label={`第 ${Math.floor(index / size) + 1} 行第 ${(index % size) + 1} 列，${value || "空白"}${given ? "，固定线索" : "，可填写"}${conflict ? "，线索冲突" : ""}${notes.length ? `，笔记 ${notes.join("、")}` : ""}`}
      aria-pressed={round.selected === index}
      aria-invalid={conflict || undefined}
      disabled={round.paused || round.won || given}
      onFocus={() => round.setSelected(index)}
      onClick={() => round.setSelected(index)}
      onKeyDown={(event) => round.navigate(event, index)}
    >
      {value || (
        <span className="nc-notes" aria-hidden="true">
          {Array.from({ length: size }, (_, i) => i + 1).map((v) => (
            <span key={v}>{notes.includes(v) ? v : ""}</span>
          ))}
        </span>
      )}
      {conflict && (
        <span className="nc-error" aria-hidden="true">
          !
        </span>
      )}
      {given && (
        <span className="nc-lock" aria-hidden="true">
          •
        </span>
      )}
    </button>
  );
}

export default function FutoshikiGarden(props: GameProps) {
  return (
    <FutoshikiRound key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function FutoshikiRound(props: GameProps) {
  const config = futoshikiLevels[props.level] ?? futoshikiLevels[0];
  const size = config.size;
  const round = useConstraintRound(props, {
    size,
    givens: config.givens,
    introduction: `每行、每列各填入 1–${size}，不重复。大小符号的尖端朝向较小的数字。没有小方块规则。`,
    celebration: "每行每列都完整，所有大小关系也正确。不等式花园长好了！",
    solved: (values) => isFutoshikiSolved(config, values),
    conflicts: (values) => futoshikiConflicts(config, values),
    hint: (values) => getFutoshikiHint(config, values),
  });
  return (
    <div
      className="puzzle-layout nc-game"
      data-number-constraint="futoshiki"
      onKeyDown={round.keyboard}
    >
      <section className="nc-play-area" aria-label="不等式花园游戏">
        <div className="nc-heading">
          <div>
            <span className="mini-label">
              ORDER & GROW · {size} × {size}
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="nc-level">
            {String(props.level + 1).padStart(2, "0")} / 12
          </span>
        </div>
        <div className="nc-toolbar">
          <span>数字各一次</span>
          <span>
            {round.state.values.filter(Boolean).length} / {size * size} 格
          </span>
        </div>
        <div
          className={`nc-futoshiki-board ${round.won ? "nc-won" : ""}`}
          style={{
            gridTemplateColumns: Array.from({ length: 2 * size - 1 }, (_, i) =>
              i % 2 ? "20px" : "minmax(0, 1fr)",
            ).join(" "),
            gridTemplateRows: Array.from({ length: 2 * size - 1 }, (_, i) =>
              i % 2 ? "20px" : "auto",
            ).join(" "),
          }}
          role="group"
          aria-label="不等式棋盘"
        >
          {round.state.values.map((_, index) => (
            <ConstraintCell
              key={index}
              round={round}
              size={size}
              index={index}
              given={!!config.givens[index]}
              game="futoshiki"
              style={{
                gridRow: Math.floor(index / size) * 2 + 1,
                gridColumn: (index % size) * 2 + 1,
              }}
            />
          ))}
          {config.inequalities.map(({ less, greater }) => {
            const a = Math.min(less, greater),
              b = Math.max(less, greater),
              vertical = b - a === size;
            const conflict =
              !!round.state.values[less] &&
              !!round.state.values[greater] &&
              round.state.values[less] >= round.state.values[greater];
            return (
              <span
                key={`${less}:${greater}`}
                className={`nc-sign ${vertical ? "nc-sign-vertical" : ""} ${conflict ? "nc-sign-conflict" : ""}`}
                data-inequality={`${less}<${greater}`}
                data-conflict={conflict}
                style={{
                  gridRow: Math.floor(a / size) * 2 + (vertical ? 2 : 1),
                  gridColumn: (a % size) * 2 + (vertical ? 1 : 2),
                }}
                aria-label={`第 ${Math.floor(less / size) + 1} 行第 ${(less % size) + 1} 列小于第 ${Math.floor(greater / size) + 1} 行第 ${(greater % size) + 1} 列${conflict ? "，不满足" : ""}`}
              >
                <span aria-hidden="true">{less === a ? "<" : ">"}</span>
              </span>
            );
          })}
        </div>
        <div className="nc-board-footer">
          <span>
            {round.won
              ? "大小关系全部正确 ✓"
              : round.conflicts.length
                ? `${round.conflicts.length} 格需要检查 !`
                : "尖端小，开口大"}
          </span>
          <span>{config.inequalities.length} 个大小关系</span>
        </div>
        <ConstraintNumberPad round={round} size={size} />
      </section>
      <aside className="game-notes nc-guide">
        <span className="mini-label">比较 · 排除 · 次序</span>
        <h3>让数字有序生长。</h3>
        <p>
          每行、每列恰好包含 1–{size}
          ，数字不能重复。不等式连接的两个格子也要满足大小关系。
        </p>
        <div className="nc-rule-example" aria-label="例如一小于三">
          <span>1</span>
          <b>&lt;</b>
          <span>3</span>
        </div>
        <div className="note">
          <strong>顺着尖端找小数</strong>
          <p>
            横着看是左、右比较，竖着看是上、下比较。尖端永远指向较小的一格。棋盘没有数独的小方块限制。
          </p>
        </div>
        <p>
          深色数字是固定线索。拿不准时用候选笔记；提示会结合你当前的填写，指出一格或帮你纠正冲突。
        </p>
        <p className="muted">
          方向键选择可填格；1–{size} 填写；Delete / Backspace 清空；N
          切换笔记。也能全程点击或触屏操作。
        </p>
      </aside>
    </div>
  );
}
