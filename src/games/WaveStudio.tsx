// SPDX-License-Identifier: GPL-3.0-only
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { GameProps } from "../lib/types";
import {
  createWaveSearch,
  createWaveState,
  moveWaveOscillator,
  sampleWave,
  undoWaveOscillator,
  waveCoefficients,
  waveCost,
  waveWon,
  WAVE_SEARCH_LIMIT,
  type WaveCoefficients,
  type WaveMove,
} from "./waveStudioLogic";
import { waveStudioLevels } from "./waveStudioLevels";
import "./waveStudio.css";
const fieldNames = { frequency: "频率", amplitude: "振幅", phase: "相位" };
export default function WaveStudio(props: GameProps) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <div
      className="wave-studio"
      ref={host}
      tabIndex={-1}
      aria-label="谐波工作室"
    >
      <WaveRound
        key={`${props.level}:${props.resetToken}`}
        {...props}
        host={host}
      />
    </div>
  );
}
function WaveRound({
  level,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
  host,
}: GameProps & { host: RefObject<HTMLDivElement | null> }) {
  const config = waveStudioLevels[level] ?? waveStudioLevels[0];
  const [state, setState] = useState(() => createWaveState(config));
  const [message, setMessage] = useState(
    "选择频率、振幅与相位，精确匹配下方系数。",
  );
  const [hint, setHint] = useState<WaveMove | null>(null),
    [busy, setBusy] = useState(false),
    [checked, setChecked] = useState(0);
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    notified = useRef(false);
  const task = useRef<{
    search: ReturnType<typeof createWaveSearch>;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const won = waveWon(config, state.board),
    locked = paused || won;
  const coefficients = waveCoefficients(state.board),
    cost = waveCost(state.board),
    active = state.board.filter((o) => o.amplitude > 0).length;
  const scale = Math.max(
    1,
    ...[config.target, coefficients].map((c) =>
      [...c.cosine, ...c.sine].reduce((s, n) => s + Math.abs(n), 0),
    ),
  );
  function path(c: WaveCoefficients) {
    return Array.from(
      { length: 129 },
      (_, i) =>
        `${i ? "L" : "M"}${48 + (i / 128) * 552},${136 - (sampleWave(c, i / 128) / scale) * 94}`,
    ).join(" ");
  }
  function say(text: string) {
    setMessage(text);
    onStatus(text);
  }
  function stop() {
    if (task.current) {
      task.current.search.cancel();
      if (task.current.timer !== null) clearTimeout(task.current.timer);
      task.current = null;
    }
    setBusy(false);
  }
  useLayoutEffect(
    () => () => {
      if (host.current?.contains(document.activeElement))
        host.current.focus({ preventScroll: true });
    },
    [],
  );
  useLayoutEffect(() => {
    if (
      locked &&
      host.current?.contains(document.activeElement) &&
      document.activeElement instanceof HTMLSelectElement
    )
      host.current.focus({ preventScroll: true });
  }, [locked]);
  useEffect(() => {
    onStatus(config.lesson);
    return () => {
      if (task.current) {
        task.current.search.cancel();
        if (task.current.timer !== null) clearTimeout(task.current.timer);
        task.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (locked && task.current) {
      stop();
      setHint(null);
      setMessage("搜索已取消；恢复后可重新请求提示。");
    }
  }, [locked]);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (locked) return;
    stop();
    setHint(null);
    setChecked(0);
    setBusy(true);
    say("正在检查当前设置的可行组合，可以随时取消或继续调整。");
    const job = {
      search: createWaveSearch(config, state.board),
      timer: null as ReturnType<typeof setTimeout> | null,
    };
    task.current = job;
    const tick = () => {
      if (task.current !== job) return;
      const result = job.search.step();
      setChecked(result.checked);
      if (result.status === "searching") {
        job.timer = setTimeout(tick, 0);
        return;
      }
      task.current = null;
      setBusy(false);
      setHint(result.move ?? null);
      if (result.status === "found" && result.move)
        say(
          `提示：振荡器 ${result.move.oscillator + 1} 的${fieldNames[result.move.field]}改为 ${result.move.value}${result.move.field === "phase" ? "°" : ""}。只调整这一项，然后观察系数变化。`,
        );
      else if (result.status === "budget")
        say(
          `达到 ${WAVE_SEARCH_LIMIT} 个设置的预算，未找到可靠建议；这不代表无解。`,
        );
      else if (result.status === "exhausted")
        say("已检查全部允许设置，没有找到符合目标、开启台数与振幅预算的组合。");
      else say("搜索已取消或输入无效，没有应用任何设置。");
    };
    job.timer = setTimeout(tick, 0);
  }, [hintToken, locked]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (locked) return;
    stop();
    setHint(null);
    setState((s) => undoWaveOscillator(config, s));
    say("已请求撤销上一次设置调整。");
  }, [undoToken, locked]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      stop();
      say("全部谐波系数精确匹配，开启台数与振幅预算也符合要求！");
      onComplete();
    }
  }, [won, paused]);
  function act(move: WaveMove) {
    if (locked) return;
    stop();
    setHint(null);
    setState((s) => moveWaveOscillator(config, s, move));
    say("设置已更新。比较当前系数与目标；曲线仅帮助观察。");
  }
  function undo() {
    if (locked || !state.history.length) return;
    stop();
    setHint(null);
    setState((s) => undoWaveOscillator(config, s));
    say("已撤销上一次单项设置。");
  }
  return (
    <div
      className="puzzle-layout"
      data-wave-game
      data-wave-board={JSON.stringify(state.board)}
      data-wave-won={won}
      data-wave-searching={busy}
    >
      <section className="ws-bench">
        <div className="ws-heading">
          <span className="mini-label">谐波工作室 · {config.title}</span>
          <strong>{state.history.length} 次调整</strong>
        </div>
        <p>{config.lesson}</p>
        <div className="ws-budget">
          <span>
            开启 {active} / 必须 {config.activeRequired} 台{" "}
            {active === config.activeRequired ? "✓" : "○"}
          </span>
          <span>
            总振幅 {cost} / 上限 {config.budget}{" "}
            {cost <= config.budget ? "✓" : "⚠ 超额"}
          </span>
        </div>
        <div className="ws-legend">
          <span>┄┄ 目标曲线</span>
          <span>━━ 当前曲线</span>
          <span>横轴：一圈时间；纵轴：振幅</span>
        </div>
        <p className="ws-scroll-help">
          ↔ 波形图可横向滚动，刻度保持原尺寸；完整数字见谐波系数表。
        </p>
        <div
          className="ws-viewport"
          tabIndex={0}
          aria-label="波形图，可横向滚动；等价的精确数字见谐波系数表"
        >
          <svg
            width="640"
            height="280"
            viewBox="0 0 640 280"
            role="img"
            aria-label={`目标与当前波形，横轴 0 到 1，纵轴负 ${scale} 到 ${scale}。虚线目标，实线当前。`}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  x1={48 + t * 552}
                  x2={48 + t * 552}
                  y1="30"
                  y2="240"
                  stroke="#d0d5e4"
                />
                <text
                  x={48 + t * 552}
                  y="262"
                  textAnchor="middle"
                  fontSize="15"
                  fill="#253758"
                >
                  {t}
                </text>
              </g>
            ))}
            {[-1, 0, 1].map((n) => (
              <g key={n}>
                <line
                  x1="48"
                  x2="600"
                  y1={136 - n * 94}
                  y2={136 - n * 94}
                  stroke={n === 0 ? "#5b6680" : "#d0d5e4"}
                />
                <text
                  x="38"
                  y={141 - n * 94}
                  textAnchor="end"
                  fontSize="15"
                  fill="#253758"
                >
                  {n * scale}
                </text>
              </g>
            ))}
            <path
              d={path(config.target)}
              fill="none"
              stroke="#8b4b11"
              strokeWidth="5"
              strokeDasharray="10 7"
            />
            <path
              d={path(coefficients)}
              fill="none"
              stroke="#164f87"
              strokeWidth="2.5"
            />
          </svg>
        </div>
        <div className="ws-oscillators">
          {state.board.map((o, i) => (
            <article key={i}>
              <h3>
                振荡器 {i + 1}{" "}
                <small>{o.amplitude === 0 ? "静默" : "开启"}</small>
              </h3>
              <p>
                {o.amplitude} × cos(2π × {o.frequency} × t + {o.phase}°)
              </p>
              {(["frequency", "amplitude", "phase"] as const).map((field) => (
                <label
                  key={field}
                  className={
                    hint?.oscillator === i && hint.field === field
                      ? "ws-hinted"
                      : ""
                  }
                >
                  {fieldNames[field]}
                  {hint?.oscillator === i && hint.field === field
                    ? " · 提示位置"
                    : ""}
                  <select
                    aria-label={`振荡器 ${i + 1} ${fieldNames[field]}`}
                    data-wave-oscillator={i}
                    data-wave-field={field}
                    disabled={locked}
                    value={o[field]}
                    onChange={(e) =>
                      act({
                        oscillator: i,
                        field,
                        value: Number(e.target.value),
                      })
                    }
                  >
                    {(field === "frequency"
                      ? config.frequencies
                      : field === "amplitude"
                        ? config.amplitudes
                        : config.phases
                    ).map((value) => (
                      <option value={value} key={value}>
                        {value}
                        {field === "phase"
                          ? "°"
                          : field === "frequency"
                            ? " 周期 / 圈"
                            : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </article>
          ))}
        </div>
        <div className="ws-actions">
          <button
            type="button"
            data-wave-undo
            aria-disabled={locked || !state.history.length}
            onClick={undo}
          >
            撤销调整
          </button>
          <button
            type="button"
            data-wave-cancel
            aria-disabled={locked || (!busy && !hint)}
            onClick={() => {
              if (locked || (!busy && !hint)) return;
              stop();
              setHint(null);
              say("提示已取消，设置保持不变。");
            }}
          >
            取消提示
          </button>
          <span>{busy ? `已检查 ${checked} 个设置` : "无倒计时 · 无声音"}</span>
        </div>
        <p className="ws-status" role="status">
          {paused
            ? "已暂停，调整锁定，进行中的搜索已取消。"
            : won
              ? "✓ 所有条件匹配！重来或换关后可以继续调整。"
              : message}
        </p>
      </section>
      <aside className="ws-notes">
        <h3>精确谐波系数</h3>
        <p>
          每行是一种频率。C 为余弦系数，S 为正弦系数。八个整数必须全部匹配。
        </p>
        <p className="ws-scroll-help">
          ↔ 系数表可横向滚动，查看当前、目标与比较结果。
        </p>
        <div
          className="ws-table-wrap"
          tabIndex={0}
          aria-label="精确谐波系数表，可横向滚动"
        >
          <table>
            <thead>
              <tr>
                <th>频率</th>
                <th>当前 C / S</th>
                <th>目标 C / S</th>
                <th>比较</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((i) => (
                <tr key={i} data-wave-coefficient={i + 1}>
                  <th>{i + 1}</th>
                  <td>
                    {coefficients.cosine[i]} / {coefficients.sine[i]}
                  </td>
                  <td>
                    {config.target.cosine[i]} / {config.target.sine[i]}
                  </td>
                  <td>
                    {coefficients.cosine[i] === config.target.cosine[i] &&
                    coefficients.sine[i] === config.target.sine[i]
                      ? "✓ 匹配"
                      : "○ 待调"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details open>
          <summary>四分之一圈的规则</summary>
          <p>
            每台产生 a × cos(2πft + φ)。相位 0° 加入 +a 的 C；90° 加入 −a 的
            S；180° 加入 −a 的 C；270° 加入 +a 的
            S。同频率系数相加，不同频率独立。
          </p>
          <p>
            这是有限谐波的数学模型，不模拟真实声学设备。图形使用采样显示，通关只看精确整数系数与资源条件。没有自动播放或计时压力。
          </p>
          <p>
            Tab 进入设置，方向键选择。振幅 0
            表示静默，仍可预设频率和相位。超出振幅预算时可以继续调整或撤销，不能通关。提示分批检查最多{" "}
            {WAVE_SEARCH_LIMIT.toLocaleString()}{" "}
            个设置；取消、调整或暂停会终止本次搜索。
          </p>
        </details>
      </aside>
    </div>
  );
}
