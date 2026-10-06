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
  createSpectralState,
  fractionText,
  moveSpectralFilter,
  rgbText,
  searchSpectralFilters,
  spectralBeamOutput,
  spectralCost,
  spectralOutput,
  spectralWon,
  undoSpectralFilter,
  type RGB,
  type SpectralMove,
} from "./spectralFiltersLogic";
import { spectralFiltersLevels } from "./spectralFiltersLevels";
import "./spectralFilters.css";
const swatch = (rgb: RGB) =>
  `rgb(${rgb.map(([n, d]) => Math.round(Math.min(1, n / d) * 255)).join(" ")})`;
export default function SpectralFilters(props: GameProps) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <div
      className="spectral-filters"
      ref={host}
      tabIndex={-1}
      aria-label="理想 RGB 滤光工作台"
    >
      <SpectralRound
        key={`${props.level}:${props.resetToken}`}
        {...props}
        host={host}
      />
    </div>
  );
}
function SpectralRound({
  level,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
  host,
}: GameProps & { host: RefObject<HTMLDivElement | null> }) {
  const config = spectralFiltersLevels[level] ?? spectralFiltersLevels[0];
  const [state, setState] = useState(() => createSpectralState(config));
  const [hint, setHint] = useState<SpectralMove | null>(null);
  const [message, setMessage] = useState(
    "先比较光源和目标，选择每个槽位的滤片。",
  );
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    notified = useRef(false);
  const won = spectralWon(config, state.board),
    locked = paused || won,
    cost = spectralCost(config, state.board),
    output = spectralOutput(config, state.board);
  function say(text: string) {
    setMessage(text);
    onStatus(text);
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
  }, []);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (locked) return;
    const result = searchSpectralFilters(config, state.board);
    setHint(result.move ?? null);
    if (result.status === "found" && result.move) {
      const { slot, filter } = result.move;
      say(
        `提示：光束 ${Math.floor(slot / config.slotsPerBeam) + 1} 的槽 ${(slot % config.slotsPerBeam) + 1}，${filter < 0 ? "取回当前滤片" : `放入${config.filters[filter].name}`}。这是从当前库存与布局找到的一步。`,
      );
    } else
      say(
        result.status === "budget"
          ? "达到搜索预算，尚未找到可靠建议；不代表无解。"
          : "已检查所有允许的滤片分配，没有找到匹配目标的配置。",
      );
  }, [hintToken, locked, state.board]);
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (locked) return;
    setState((s) => undoSpectralFilter(config, s));
    setHint(null);
    say("已请求撤销上一次滤片调整。");
  }, [undoToken, locked]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      say("三个通道精确匹配，且满足库存与成本限制！");
      onComplete();
    }
  }, [won, paused]);
  function act(move: SpectralMove) {
    if (locked) return;
    setState((s) => moveSpectralFilter(config, s, move));
    setHint(null);
    say("光强已更新：叠片逐通道相乘，两束光逐通道相加。");
  }
  function undo() {
    if (locked) return;
    setState((s) => undoSpectralFilter(config, s));
    setHint(null);
    say("已撤销，库存与光强一起恢复。");
  }
  return (
    <div
      className="puzzle-layout"
      data-spectral-game
      data-spectral-board={state.board.join(",")}
      data-spectral-won={won}
    >
      <section className="sf-bench">
        <div className="sf-heading">
          <span className="mini-label">理想滤光 · {config.title}</span>
          <strong>
            成本 {cost} / {config.budget}
          </strong>
        </div>
        <p>{config.lesson}</p>
        <div className="sf-result" aria-label="精确目标与当前输出">
          <div>
            <small>目标强度</small>
            <strong>{rgbText(config.target)}</strong>
            <span
              className="sf-swatch"
              style={{ background: swatch(config.target) }}
              aria-hidden="true"
            />
          </div>
          <div>
            <small>当前强度</small>
            <strong data-spectral-output>{rgbText(output)}</strong>
            <span
              className="sf-swatch"
              style={{ background: swatch(output) }}
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="sf-channels">
          {output.map((f, c) => (
            <span key={c}>
              {["R 红", "G 绿", "B 蓝"][c]}：{fractionText(f)} /{" "}
              {fractionText(config.target[c])}{" "}
              {f[0] * config.target[c][1] === config.target[c][0] * f[1]
                ? "✓ 匹配"
                : "○ 待调"}
            </span>
          ))}
        </div>
        <p className="sf-scroll-help">
          ↔ 光路图可横向滚动，文字保持原尺寸；完整光源与输出列在下方。
        </p>
        <div
          className="sf-viewport"
          tabIndex={0}
          aria-label="光路示意，可横向滚动；所有光源与输出也列在下方"
        >
          <svg
            width="540"
            height={config.beams.length * 100 + 32}
            viewBox={`0 0 540 ${config.beams.length * 100 + 32}`}
            role="img"
            aria-label="每束光先通过最多两片滤片，再将输出相加。数字以卡片为准。"
          >
            {config.beams.map((beam, b) => (
              <g key={b}>
                <path
                  d={`M70 ${b * 100 + 55} H456`}
                  stroke="#61768f"
                  strokeWidth="12"
                />
                <circle
                  cx="47"
                  cy={b * 100 + 55}
                  r="24"
                  fill={swatch(beam)}
                  stroke="#23374b"
                  strokeWidth="3"
                />
                <text x="14" y={b * 100 + 98} fontSize="16" fill="#193349">
                  光束 {b + 1}
                </text>
                {Array.from({ length: config.slotsPerBeam }, (_, s) => {
                  const f = state.board[b * config.slotsPerBeam + s];
                  return (
                    <g key={s}>
                      <rect
                        x={125 + s * 145}
                        y={b * 100 + 28}
                        width="126"
                        height="54"
                        rx="8"
                        fill="#e5f0f4"
                        stroke="#365d72"
                        strokeWidth="2"
                      />
                      <text
                        x={188 + s * 145}
                        y={b * 100 + 60}
                        textAnchor="middle"
                        fontSize="16"
                        fill="#193349"
                      >
                        {f < 0 ? "空槽 · 全透" : config.filters[f].name}
                      </text>
                    </g>
                  );
                })}
                <path
                  d={`M450 ${b * 100 + 42} L469 ${b * 100 + 55} L450 ${b * 100 + 68}`}
                  fill="none"
                  stroke="#193349"
                  strokeWidth="3"
                />
                <circle
                  cx="501"
                  cy={b * 100 + 55}
                  r="23"
                  fill={swatch(spectralBeamOutput(config, state.board, b))}
                  stroke="#23374b"
                  strokeWidth="3"
                />
              </g>
            ))}
          </svg>
        </div>
        <div className="sf-beams">
          {config.beams.map((beam, b) => (
            <article className="sf-beam" key={b}>
              <h3>光束 {b + 1}</h3>
              <p>
                源：{rgbText(beam)}
                <br />
                输出：{rgbText(spectralBeamOutput(config, state.board, b))}
              </p>
              {Array.from({ length: config.slotsPerBeam }, (_, s) => {
                const slot = b * config.slotsPerBeam + s;
                return (
                  <label
                    key={slot}
                    className={hint?.slot === slot ? "sf-hinted" : ""}
                  >
                    槽 {s + 1}
                    {hint?.slot === slot ? " · 提示位置" : ""}
                    <select
                      data-spectral-slot={slot}
                      aria-label={`光束 ${b + 1} 槽 ${s + 1}`}
                      disabled={locked}
                      value={state.board[slot]}
                      onChange={(e) =>
                        act({ slot, filter: Number(e.target.value) })
                      }
                    >
                      <option value={-1}>空槽 · 不改变光</option>
                      {config.filters.map((f, i) => (
                        <option
                          key={f.id}
                          value={i}
                          disabled={
                            i !== state.board[slot] &&
                            (state.board.includes(i) ||
                              cost -
                                (config.filters[state.board[slot]]?.cost ?? 0) +
                                f.cost >
                                config.budget)
                          }
                        >
                          {f.name} · 成本 {f.cost}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </article>
          ))}
        </div>
        <div className="sf-actions">
          <button
            type="button"
            data-spectral-undo
            aria-disabled={locked || !state.history.length}
            onClick={undo}
          >
            撤销调整
          </button>
          <button
            type="button"
            aria-disabled={locked || !hint}
            onClick={() => {
              if (!locked && hint) {
                setHint(null);
                say("提示已收起，布局保持不变。");
              }
            }}
          >
            收起提示
          </button>
          <span>{state.history.length} 次调整</span>
        </div>
        <p className="sf-status" role="status">
          {paused
            ? "已暂停，所有布局调整已锁定。"
            : won
              ? "✓ 精确匹配！重来或换关后可以继续调整。"
              : message}
        </p>
      </section>
      <aside className="sf-notes">
        <h3>共享滤片库存</h3>
        <p>
          每片只用一次；可取回或替换。总成本不能超过 {config.budget}
          。空槽不消耗资源。
        </p>
        <div className="sf-inventory">
          {config.filters.map((f, i) => {
            const slot = state.board.indexOf(i);
            return (
              <article key={f.id}>
                <strong>
                  {i + 1}. {f.name}
                </strong>
                <span>透射率 {rgbText(f.transmission)}</span>
                <span>
                  成本 {f.cost} ·{" "}
                  {slot < 0
                    ? "库存中"
                    : `已在光束 ${Math.floor(slot / config.slotsPerBeam) + 1} 槽 ${(slot % config.slotsPerBeam) + 1}`}
                </span>
              </article>
            );
          })}
        </div>
        <details open>
          <summary>简化模型与操作</summary>
          <p>
            这是理想 RGB
            光强模型，不是颜料混色，也不模拟真实光谱。滤片按通道相乘，光束相加；数值大于
            1 不截断。色块仅示意，会截断到屏幕可显示范围，判定只看精确分数。
          </p>
          <p>
            用 Tab
            进入槽位，再用方向键选择滤片。数字、名称和匹配符号包含全部线索，无需辨色。提示从当前布局重新搜索，不会自动放片。
          </p>
        </details>
      </aside>
    </div>
  );
}
