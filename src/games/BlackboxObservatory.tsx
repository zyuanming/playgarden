import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import type { GameProps } from "../lib/types";
import { blackboxChapters, blackboxLevels } from "./blackboxLevels";
import {
  ABSORBED,
  REFLECTED,
  cellName,
  checkBlackbox,
  createBlackboxState,
  fireBlackbox,
  getBlackboxHint,
  markBlackbox,
  observedBlackbox,
  portName,
  resultName,
  undoBlackbox,
  type BlackboxHint,
  type Mark,
} from "./blackboxLogic";
import { loadBlackboxRound, saveBlackboxRound } from "./blackboxStorage";
import "./blackboxObservatory.css";

const intro =
  "从边缘发射探针，听听星雾的回应。用 ★ 标出你推测的星位，再验证星图。不计时，也不限探测次数。";
type Conflict = {
  port: number;
  actual: number;
  predicted: number;
  fresh: boolean;
};
const markNames: Record<Mark, string> = {
  0: "未标记",
  1: "已标星",
  "-1": "已标空",
};

export default function BlackboxObservatory(props: GameProps) {
  const key = `${props.level}:${props.resetToken}`;
  const round = useRef({ key, level: props.level, fresh: false });
  if (round.current.key !== key) {
    round.current = {
      key,
      level: props.level,
      fresh: round.current.level === props.level,
    };
  }
  return (
    <BlackboxRound
      key={key}
      {...props}
      fresh={Boolean(props.freshStart || round.current.fresh)}
    />
  );
}

function BlackboxRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
  fresh,
}: GameProps & { fresh: boolean }) {
  const puzzle = blackboxLevels[level] ?? blackboxLevels[0];
  const chapter = blackboxChapters[puzzle.chapter];
  const [state, setState] = useState(() =>
    fresh ? createBlackboxState(puzzle) : loadBlackboxRound(level, puzzle),
  );
  const [tool, setTool] = useState<Mark>(1);
  const stateRef = useRef(state);
  const toolRef = useRef(tool);
  stateRef.current = state;
  toolRef.current = tool;
  const [cursor, setCursor] = useState(0);
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [hint, setHint] = useState<BlackboxHint | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [saved, setSaved] = useState(true);
  const [message, setMessage] = useState(() =>
    state.history.length || state.probes.length
      ? `已接上这局的观测：${state.probes.length} 次探测，${state.history.length} 步标记可撤销。星图和证据都还在。`
      : intro,
  );
  const completed = useRef(false);
  const tokens = useRef({ hintToken, undoToken });
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const ports = useRef<(HTMLButtonElement | null)[]>([]);
  const won = state.submitted;
  const marked = state.marks.filter((mark) => mark === 1).length;
  const observations = observedBlackbox(state.probes);
  const selectedResult = observations.find(
    (probe) => probe.port === selectedPort,
  )?.result;
  const boardStyle = {
    "--blackbox-size": puzzle.size,
    "--blackbox-tracks": puzzle.size + 2,
  } as CSSProperties;

  function report(text: string) {
    setMessage(text);
    callbacks.current.onStatus(text);
  }

  // Keep every click in the same browser event batch in order, including the
  // final submit. A second click must see the first one's marks or terminal lock.
  function commit(next: typeof state) {
    stateRef.current = next;
    setState(next);
  }

  useEffect(() => {
    setSaved(saveBlackboxRound(level, puzzle, state));
  }, [level, puzzle, state]);
  useEffect(() => {
    callbacks.current.onStatus(message);
  }, []);
  useEffect(() => {
    if (!won || paused || completed.current) return;
    completed.current = true;
    setHint(null);
    setConflict(null);
    report(
      `星图验证通过！${puzzle.atoms.length} 颗星解释了所有边缘响应，共探测 ${state.probes.length} 次。等价星图同样有效，这一局已完成。`,
    );
    callbacks.current.onComplete();
  }, [won, paused, puzzle.atoms.length, state.probes.length]);

  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    const current = stateRef.current;
    if (paused || current.submitted) return;
    const change = current.history.at(-1);
    setHint(null);
    setConflict(null);
    if (!change) {
      report(
        "还没有可撤销的标记。撤销只改变你的笔记，已获得的探测证据始终保留。",
      );
      return;
    }
    commit(undoBlackbox(current));
    report(
      `已撤销${cellName(puzzle.size, change.cell)}的标记，恢复为${markNames[change.before]}。${current.probes.length} 次探测证据全部保留。`,
    );
  }, [undoToken, paused, won, state.history, state.probes.length, puzzle.size]);

  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || stateRef.current.submitted) return;
    const nextHint = getBlackboxHint(
      puzzle.size,
      puzzle.atoms.length,
      stateRef.current,
    );
    setHint(nextHint);
    setConflict(null);
    report(nextHint.reason);
    if (nextHint.kind === "mark") {
      setCursor(nextHint.cell);
      cells.current[nextHint.cell]?.focus({ preventScroll: true });
    } else if (nextHint.kind === "probe") {
      ports.current[nextHint.port]?.focus({ preventScroll: true });
    }
  }, [hintToken, paused, won, state, puzzle.size, puzzle.atoms.length]);

  function markCell(cell: number) {
    const current = stateRef.current;
    if (paused || current.submitted) return;
    const value = current.marks[cell] === toolRef.current ? 0 : toolRef.current;
    const next = markBlackbox(current, cell, value);
    setCursor(cell);
    setHint(null);
    setConflict(null);
    if (next === current) {
      report(`${cellName(puzzle.size, cell)}已经是空白，没有新增撤销步骤。`);
      return;
    }
    commit(next);
    const count = next.marks.filter((mark) => mark === 1).length;
    report(
      `${cellName(puzzle.size, cell)}${value === 0 ? "已擦除标记" : markNames[value]}。已标 ${count} / ${puzzle.atoms.length} 颗星。`,
    );
  }

  function probe(port: number) {
    const current = stateRef.current;
    if (paused || current.submitted) return;
    const known = observedBlackbox(current.probes).find(
      (item) => item.port === port,
    );
    const next = fireBlackbox(puzzle, current, port);
    const result = known?.result ?? next.probes.at(-1)?.result;
    if (result === undefined) return;
    commit(next);
    setSelectedPort(port);
    setHint(null);
    setConflict(null);
    report(
      `${known ? "回看" : "探测"}${portName(puzzle.size, port)}：${resultName(puzzle.size, result)}。${
        known
          ? "这条证据已经取得，探测次数不增加。"
          : result >= 0
            ? `${portName(puzzle.size, result)}反向通往${portName(puzzle.size, port)}，两个方向算同一次探测。`
            : "证据已记下，可以继续从别处探测。"
      }`,
    );
  }

  function verify() {
    const current = stateRef.current;
    if (paused || current.submitted) return;
    const result = checkBlackbox(puzzle, current);
    setHint(null);
    setConflict(null);
    commit(result.state);
    if (result.kind === "count") {
      report(
        `这片星雾里有 ${puzzle.atoms.length} 颗星，你标了 ${current.marks.filter((mark) => mark === 1).length} 颗。先把 ★ 调整到 ${puzzle.atoms.length} 颗，再验证；× 只是笔记，不必填满。`,
      );
    } else if (
      result.kind === "conflict" &&
      result.port !== undefined &&
      result.actual !== undefined &&
      result.predicted !== undefined
    ) {
      const isFresh = result.state.probes.length > current.probes.length;
      setSelectedPort(result.port);
      setConflict({
        port: result.port,
        actual: result.actual,
        predicted: result.predicted,
        fresh: isFresh,
      });
      report(
        `${portName(puzzle.size, result.port)}的响应还对不上：实测${resultName(puzzle.size, result.actual)}，按你的星图会${resultName(puzzle.size, result.predicted)}。${isFresh ? "已补记这次新探测。" : "这是已经取得的证据，没有增加探测次数。"}调整星位后可以再试。`,
      );
    }
  }

  function moveCell(event: KeyboardEvent<HTMLButtonElement>, cell: number) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      if (event.key === "Enter" || event.key === " ") event.preventDefault();
      return;
    }
    if (paused || won) return;
    const row = Math.floor(cell / puzzle.size),
      column = cell % puzzle.size;
    const next =
      event.key === "ArrowUp"
        ? Math.max(0, row - 1) * puzzle.size + column
        : event.key === "ArrowDown"
          ? Math.min(puzzle.size - 1, row + 1) * puzzle.size + column
          : event.key === "ArrowLeft"
            ? row * puzzle.size + Math.max(0, column - 1)
            : event.key === "ArrowRight"
              ? row * puzzle.size + Math.min(puzzle.size - 1, column + 1)
              : event.key === "Home"
                ? row * puzzle.size
                : event.key === "End"
                  ? (row + 1) * puzzle.size - 1
                  : null;
    if (next !== null) {
      event.preventDefault();
      setCursor(next);
      cells.current[next]?.focus({ preventScroll: true });
    }
  }

  return (
    <div
      className="blackbox-layout"
      data-blackbox-won={won}
      data-blackbox-hint={hint?.kind ?? ""}
      onKeyDown={(event) => {
        if (
          (event.ctrlKey || event.metaKey || event.altKey) &&
          (event.key === "Enter" || event.key === " ")
        )
          event.preventDefault();
      }}
    >
      <section className="blackbox-play" aria-label="星雾探测游戏">
        <header className="blackbox-heading">
          <div>
            <span className="blackbox-chapter">
              第 {puzzle.chapter + 1} 章 · {chapter.title}
            </span>
            <h3>{puzzle.title}</h3>
          </div>
          <span className="blackbox-level">
            {String(level + 1).padStart(3, "0")} / {blackboxLevels.length}
          </span>
        </header>
        <p className="blackbox-lesson" data-blackbox-chapter={puzzle.chapter}>
          {chapter.lesson}
        </p>
        <div className="blackbox-stats">
          <span className={marked > puzzle.atoms.length ? "is-over" : ""}>
            已标星{" "}
            <strong data-blackbox-marked={marked}>
              {marked}
              <small> / {puzzle.atoms.length}</small>
            </strong>
          </span>
          <span>
            探测{" "}
            <strong data-blackbox-shots={state.probes.length}>
              {state.probes.length}
              <small> 次</small>
            </strong>
          </span>
          <span className="blackbox-state-label">
            {paused ? "已暂停" : won ? "星图吻合 ✓" : "慢慢推理，不限次数"}
          </span>
        </div>

        <div className="blackbox-instrument">
          <div className="blackbox-window-label">
            <span>
              观测窗 · {puzzle.size} × {puzzle.size}
            </span>
            <span>{won ? "验证完成" : "点边缘探针发射"}</span>
          </div>
          <div
            className="blackbox-board"
            style={boardStyle}
            role="group"
            aria-label="四边探针与星雾格盘"
            data-testid="blackbox-board"
          >
            {[0, 1, 2, 3].map((corner) => (
              <span
                className="blackbox-corner"
                key={corner}
                aria-hidden="true"
                style={{
                  gridColumn: corner % 2 ? puzzle.size + 2 : 1,
                  gridRow: corner < 2 ? 1 : puzzle.size + 2,
                }}
              >
                <svg viewBox="0 0 20 20">
                  <path d="M10 3v5M10 12v5M3 10h5M12 10h5" />
                  <circle cx="10" cy="10" r="2" />
                </svg>
              </span>
            ))}
            {Array.from({ length: puzzle.size * 4 }, (_, port) => {
              const side = Math.floor(port / puzzle.size),
                offset = port % puzzle.size;
              const result = observations.find(
                (item) => item.port === port,
              )?.result;
              const known = result !== undefined;
              const selected = selectedPort === port;
              const paired =
                selectedResult !== undefined &&
                selectedResult >= 0 &&
                selectedResult === port;
              const hinted = hint?.kind === "probe" && hint.port === port;
              const style = {
                gridColumn:
                  side === 1 ? puzzle.size + 2 : side === 3 ? 1 : offset + 2,
                gridRow:
                  side === 0 ? 1 : side === 2 ? puzzle.size + 2 : offset + 2,
              };
              return (
                <button
                  type="button"
                  key={port}
                  className={`blackbox-port ${known ? "is-observed" : ""} ${selected ? "is-selected" : ""} ${paired ? "is-paired" : ""} ${hinted ? "is-hinted" : ""}`}
                  style={style}
                  ref={(element) => {
                    ports.current[port] = element;
                  }}
                  disabled={paused || won}
                  data-blackbox-port={port}
                  data-result={result ?? ""}
                  data-observed={known}
                  data-selected={selected}
                  data-hinted={hinted}
                  aria-label={`${portName(puzzle.size, port)}${known ? `，已观测，${resultName(puzzle.size, result)}，点击回看不增加探测次数` : "，未探测，点击发射探针"}${hinted ? "，提示推荐入口" : ""}`}
                  onClick={(event) => {
                    if (!event.ctrlKey && !event.metaKey && !event.altKey)
                      probe(port);
                  }}
                >
                  <span className="blackbox-port-name">
                    {portName(puzzle.size, port)}
                  </span>
                  <span
                    className={`blackbox-port-result ${result === ABSORBED ? "is-absorbed" : result === REFLECTED ? "is-reflected" : ""}`}
                    aria-hidden="true"
                  >
                    {result === undefined
                      ? ["↓", "←", "↑", "→"][side]
                      : result === ABSORBED
                        ? "●"
                        : result === REFLECTED
                          ? "↩"
                          : `→${portName(puzzle.size, result)}`}
                  </span>
                </button>
              );
            })}
            <div
              className="blackbox-grid"
              role="grid"
              aria-label={`星雾格盘，${puzzle.size} 行 ${puzzle.size} 列，方向键选格，Enter 或空格标记`}
              style={{
                gridRow: `2 / span ${puzzle.size}`,
                gridColumn: `2 / span ${puzzle.size}`,
              }}
            >
              {Array.from({ length: puzzle.size }, (_, row) => (
                <div role="row" className="blackbox-grid-row" key={row}>
                  {Array.from({ length: puzzle.size }, (_, column) => {
                    const cell = row * puzzle.size + column,
                      mark = state.marks[cell];
                    const hinted = hint?.kind === "mark" && hint.cell === cell;
                    return (
                      <div
                        role="gridcell"
                        className="blackbox-grid-cell"
                        key={cell}
                      >
                        <button
                          type="button"
                          className={`blackbox-cell ${mark === 1 ? "has-star" : mark === -1 ? "is-empty" : ""} ${hinted ? "is-hinted" : ""}`}
                          ref={(element) => {
                            cells.current[cell] = element;
                          }}
                          tabIndex={cursor === cell ? 0 : -1}
                          disabled={paused || won}
                          data-testid={`blackbox-cell-${cell}`}
                          data-blackbox-cell={cell}
                          data-mark={mark}
                          data-hinted={hinted}
                          aria-label={`${cellName(puzzle.size, cell)}，${markNames[mark]}${hinted ? "，提示定位" : ""}，${tool === 1 ? "标星工具" : tool === -1 ? "标空工具" : "擦除工具"}`}
                          onFocus={() => setCursor(cell)}
                          onKeyDown={(event) => moveCell(event, cell)}
                          onClick={(event) => {
                            if (
                              !event.ctrlKey &&
                              !event.metaKey &&
                              !event.altKey
                            )
                              markCell(cell);
                          }}
                        >
                          <span
                            className="blackbox-cell-mark"
                            aria-hidden="true"
                          >
                            {mark === 1 ? "★" : mark === -1 ? "×" : "·"}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="blackbox-signal-key" aria-label="探针结果说明">
            <span>
              <b>●</b> 吸收
            </span>
            <span>
              <b>↩</b> 返回原口
            </span>
            <span>
              <b>→</b> 到另一端口
            </span>
          </div>
          <p className="blackbox-readout" data-blackbox-readout>
            {selectedPort !== null && selectedResult !== undefined ? (
              <>
                <strong>{portName(puzzle.size, selectedPort)}</strong>
                <span>{resultName(puzzle.size, selectedResult)}</span>
                <small>
                  {selectedResult >= 0
                    ? "双向证据 · 两端都可回看"
                    : "已记入观测 · 可随时回看"}
                </small>
              </>
            ) : (
              <>
                <span>星位藏在雾里，回应留在边缘。</span>
                <small>第一步，选一个端口试试。</small>
              </>
            )}
          </p>
        </div>

        <div className="blackbox-marking">
          <div className="blackbox-tool-heading">
            <strong>我的星图</strong>
            <span>再点同样标记，可擦除</span>
          </div>
          <div
            className="blackbox-tools"
            role="group"
            aria-label="选择标记工具"
          >
            {(
              [
                { value: 1, symbol: "★", name: "标星" },
                { value: -1, symbol: "×", name: "标空" },
                { value: 0, symbol: "○", name: "擦除" },
              ] as const
            ).map((item) => (
              <button
                type="button"
                key={item.value}
                data-blackbox-tool={item.value}
                className={tool === item.value ? "is-active" : ""}
                aria-pressed={tool === item.value}
                disabled={paused || won}
                onClick={(event) => {
                  if (
                    event.ctrlKey ||
                    event.metaKey ||
                    event.altKey ||
                    paused ||
                    stateRef.current.submitted
                  )
                    return;
                  toolRef.current = item.value;
                  setTool(item.value);
                  report(
                    `已选择${item.name}工具。${item.value === 1 ? "点格子放一颗推测的星，再点同一颗可擦除。" : item.value === -1 ? "点格子记下空位，× 不参与最终验证。" : "点格子清除你的标记，探测证据不变。"}`,
                  );
                }}
              >
                <span aria-hidden="true">{item.symbol}</span>
                {item.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="blackbox-verify"
            data-blackbox-verify
            disabled={paused || won || marked !== puzzle.atoms.length}
            onClick={(event) => {
              if (!event.ctrlKey && !event.metaKey && !event.altKey) verify();
            }}
          >
            {won ? "星图已验证 ✓" : "验证星图"}
            <span>
              {won
                ? "所有边缘响应一致"
                : marked < puzzle.atoms.length
                  ? `还需标 ${puzzle.atoms.length - marked} 颗星`
                  : marked > puzzle.atoms.length
                    ? `请少标 ${marked - puzzle.atoms.length} 颗星`
                    : `检查全部 ${puzzle.size * 4} 个入口`}
            </span>
          </button>
        </div>
        {conflict && (
          <div
            className="blackbox-conflict"
            data-blackbox-conflict={conflict.port}
            role="note"
            aria-label="星图与实测的冲突"
          >
            <p>
              找到一处不一致
              {conflict.fresh ? " · 已补记新探测" : " · 来自已有证据"}
            </p>
            <div>
              <span>
                入口<strong>{portName(puzzle.size, conflict.port)}</strong>
              </span>
              <span>
                实测<strong>{resultName(puzzle.size, conflict.actual)}</strong>
              </span>
              <span>
                你的星图
                <strong>{resultName(puzzle.size, conflict.predicted)}</strong>
              </span>
            </div>
          </div>
        )}
        <p
          className={`blackbox-message ${won ? "is-won" : ""}`}
          role="note"
          data-blackbox-message
        >
          {message}
        </p>
        <p className="blackbox-save" data-blackbox-saved={saved}>
          {saved
            ? "星图、观测与完整撤销记录已存入此浏览器。刷新或换关后可继续；“重来”会清空本局。"
            : "本局暂时无法保存。可以继续玩和撤销，但刷新或离开可能丢失当前进度，请保持页面打开。"}
        </p>
      </section>

      <aside className="blackbox-notes" aria-label="星雾探测玩法">
        <h3>
          看不见星，
          <br />
          也能找到方向。
        </h3>
        <p>
          边缘的探针会直行、偏转或返回。用它带回的证据，拼出雾里的{" "}
          <strong>{puzzle.atoms.length} 颗星</strong>。
        </p>
        <div className="blackbox-rules">
          <RuleDiagram
            kind="absorb"
            title="正前有星，先吸收"
            text="探针正前方有星就停止。即使斜前方也有星，仍优先吸收。"
          />
          <RuleDiagram
            kind="deflect"
            title="斜前有星，向外偏"
            text="斜前方一侧有星，探针转 90°，朝远离那颗星的方向走。"
          />
          <RuleDiagram
            kind="reflect"
            title="入口邻侧有星，返回"
            text="还没入场，入口格的左右邻格有星，就从原入口返回。"
          />
        </div>
        <p className="blackbox-double-note">
          <span aria-hidden="true">↩</span>
          <span>途中斜前方两侧都有星，也会原路返回。正前吸收仍然优先。</span>
        </p>
        <details className="blackbox-help">
          <summary>完整玩法与键盘</summary>
          <ol>
            <li>点四边端口探测。● 是吸收，↩ 是返回，箭头后的编号是出口。</li>
            <li>
              连通的两个端口互为入口与出口；点任一已知端口只回看，不增加次数。
            </li>
            <li>
              选择工具，在格内标 ★ 星位、× 空位或擦除。撤销只撤标记，证据保留。
            </li>
            <li>
              标足星数后验证。系统检查全部入口，即使尚未探测，也必须与真实响应一致。
            </li>
          </ol>
          <p>
            若不同布局的完整响应相同，任一等价星图都能通过。×
            仅是笔记，不必把格盘填满。没有计时，也没有探测上限。
          </p>
          <p>
            Tab 选择边缘端口、工具或进入格盘。格盘内用方向键移动，Home / End
            到本行两端，Enter 或空格执行所选工具。Escape 暂停或继续。
          </p>
          <p>
            提示只依据已经取得的观测，亮起一个值得探测的入口或能确定的格子。它只定位，不自动发射或改标记。
          </p>
        </details>
        <details className="blackbox-log">
          <summary>
            观测手记 <span>{state.probes.length} 次</span>
          </summary>
          {state.probes.length ? (
            <ol>
              {state.probes.map((item, index) => (
                <li key={`${index}:${item.port}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{portName(puzzle.size, item.port)}</strong>
                  <span>{resultName(puzzle.size, item.result)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>还没有观测。点边缘任意一个端口，留下第一条证据。</p>
          )}
          <p>每行记录一次新探测；成对出口的反向证据已包含在同一次观测里。</p>
        </details>
      </aside>
    </div>
  );
}

function RuleDiagram({
  kind,
  title,
  text,
}: {
  kind: "absorb" | "deflect" | "reflect";
  title: string;
  text: string;
}) {
  return (
    <div className="blackbox-rule">
      <svg
        className="blackbox-rule-diagram"
        viewBox="0 0 120 110"
        role="img"
        aria-label={`${title}的示意图`}
      >
        <path
          className="blackbox-diagram-grid"
          d="M14 12H106V102H14ZM14 42H106M14 72H106M44 12V102M76 12V102"
        />
        {kind === "absorb" ? (
          <>
            <text className="blackbox-diagram-star is-secondary" x="92" y="34">
              ★
            </text>
            <text className="blackbox-diagram-star" x="60" y="34">
              ★
            </text>
            <path className="blackbox-diagram-ray" d="M60 94V51" />
            <circle className="blackbox-diagram-stop" cx="60" cy="47" r="4" />
            <path className="blackbox-diagram-direction" d="m60 62-4 7h8Z" />
          </>
        ) : kind === "deflect" ? (
          <>
            <text className="blackbox-diagram-star" x="92" y="34">
              ★
            </text>
            <path className="blackbox-diagram-ray" d="M60 94V57H20" />
            <path className="blackbox-diagram-direction" d="m18 57 8-5v10Z" />
          </>
        ) : (
          <>
            <path className="blackbox-diagram-boundary" d="M9 72H111" />
            <text className="blackbox-diagram-star" x="92" y="64">
              ★
            </text>
            <path
              className="blackbox-diagram-ray"
              d="M50 101V87Q50 77 60 77Q70 77 70 87V99"
            />
            <path className="blackbox-diagram-direction" d="m70 103-5-8h10Z" />
          </>
        )}
      </svg>
      <div>
        <h4>{title}</h4>
        <p>{text}</p>
      </div>
    </div>
  );
}
