// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { GameProps } from "../lib/types";
import {
  PEND_LIMIT,
  canPushPendulum,
  initialPendulum,
  pendDegrees,
  pendRadians,
  pendulumAmplitude,
  pendulumEnergy,
  pendulumHint,
  pendulumPushLevels,
  pushPendulum,
  stepPendulum,
  type PendulumState,
} from "./pendulumPushLogic";
import "./pendulumPush.css";

export default function PendulumPush(props: GameProps) {
  return (
    <PendulumRound key={`${props.level}:${props.resetToken}`} {...props} />
  );
}

const point = (degrees: number, radius = 230) => ({
  x: 310 + Math.sin(pendRadians(degrees)) * radius,
  y: 85 + Math.cos(pendRadians(degrees)) * radius,
});
const arc = (from: number, to: number, radius: number) => {
  const a = point(from, radius),
    b = point(to, radius);
  return `M${a.x} ${a.y} A${radius} ${radius} 0 0 0 ${b.x} ${b.y}`;
};

function PendulumRound({
  level,
  paused,
  hintToken,
  onStatus,
  onComplete,
}: GameProps) {
  const config = pendulumPushLevels[level] ?? pendulumPushLevels[0];
  const [state, setState] = useState(initialPendulum);
  const [message, setMessage] = useState(config.lesson as string);
  const live = useRef(state),
    pause = useRef(paused),
    completed = useRef(false),
    heardBells = useRef(0),
    seenHint = useRef(hintToken);
  const callbacks = useRef({ onStatus, onComplete });
  pause.current = paused;
  callbacks.current = { onStatus, onComplete };

  function commit(next: PendulumState) {
    live.current = next;
    setState(next);
  }
  function report(text: string) {
    setMessage(text);
    callbacks.current.onStatus(text);
  }
  useEffect(() => {
    callbacks.current.onStatus(config.lesson);
  }, [config]);

  useEffect(() => {
    if (paused || state.phase !== "running") return;
    let frameId = 0,
      last: number | null = null;
    const frame = (now: number) => {
      if (pause.current || live.current.phase !== "running") return;
      if (last !== null)
        commit(stepPendulum(config, live.current, (now - last) / 1000));
      last = now;
      if (live.current.phase === "running")
        frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [config, paused, state.phase]);

  useEffect(() => {
    if (paused) return;
    const newBell = state.left + state.right > heardBells.current;
    heardBells.current = state.left + state.right;
    if (state.phase === "won" && !completed.current) {
      completed.current = true;
      report(
        `左右钟各响 ${config.goal} 次，节拍完成！每一声都来自摆锤向外经过目标角度。`,
      );
      callbacks.current.onComplete();
    } else if (state.phase === "lost") {
      report(
        `摆角超过安全线 ${PEND_LIMIT}°，这一轮停下了。点“重新尝试”，下一轮少推几次就好。`,
      );
    } else if (state.phase === "running" && newBell) {
      report(
        `叮！左钟 ${state.left}/${config.goal}，右钟 ${state.right}/${config.goal}。有余力时可以等一等，不用每次都推。`,
      );
    }
  }, [state.phase, state.left, state.right, paused, config]);

  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (
      pause.current ||
      live.current.phase === "won" ||
      live.current.phase === "lost"
    )
      return;
    report(pendulumHint(config, live.current));
  }, [hintToken, config]);

  function startOrRetry() {
    if (pause.current) return;
    if (live.current.phase === "lost") {
      completed.current = false;
      commit(initialPendulum());
      report("回到起点。点“开始摆动”，观察箭头再出手。");
    } else if (live.current.phase === "ready") {
      commit({ ...live.current, phase: "running" });
      report("摆锤已释放。在中央绿色区域轻推，先观察它正在往哪边走。");
    }
  }
  function push(direction: -1 | 1) {
    if (pause.current) return;
    const before = live.current,
      next = pushPendulum(config, before, direction);
    if (next === before) return;
    const difference =
      pendulumEnergy(config, next) - pendulumEnergy(config, before);
    commit(next);
    report(
      `${direction === -1 ? "向左" : "向右"}推了一次：${difference < -0.00001 ? "这次降低了动能，起到刹车作用" : difference > 0.00001 ? "这次增加了动能" : "方向改变，动能几乎不变"}。等下次经过中央再决定。`,
    );
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (
      target.isContentEditable ||
      /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)
    )
      return;
    if (event.repeat) {
      if (
        ["ArrowLeft", "ArrowRight", "a", "A", "d", "D", "Enter", " "].includes(
          event.key,
        )
      )
        event.preventDefault();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
      return;
    if (["ArrowLeft", "a", "A"].includes(event.key)) {
      event.preventDefault();
      push(-1);
    }
    if (["ArrowRight", "d", "D"].includes(event.key)) {
      event.preventDefault();
      push(1);
    }
  }

  const degrees = pendDegrees(state.theta),
    amplitude = pendulumAmplitude(config, state);
  const canPush = !paused && canPushPendulum(config, state);
  const movingRight = state.omega > 0.025,
    movingLeft = state.omega < -0.025;
  const bob = point(degrees),
    leftBell = point(-config.target),
    rightBell = point(config.target);
  const gate = point(-config.window, 245);
  const phaseText = paused
    ? "已暂停"
    : state.phase === "ready"
      ? "等待开始"
      : state.phase === "won"
        ? "节拍完成"
        : state.phase === "lost"
          ? "摆幅过大"
          : canPush
            ? "可以轻推"
            : Math.abs(degrees) > config.window
              ? "等待中央"
              : "本次已推";
  const pips = (count: number) =>
    Array.from({ length: config.goal }, (_, i) => (
      <i
        key={i}
        className={i < count ? "pend-filled" : ""}
        aria-hidden="true"
      />
    ));

  return (
    <div
      className="pend-game"
      onKeyDown={keyDown}
      data-pend-phase={state.phase}
      data-pend-angle={degrees.toFixed(3)}
      data-pend-omega={state.omega.toFixed(4)}
      data-pend-amplitude={amplitude.toFixed(2)}
      data-pend-target={config.target}
      data-pend-time={state.time.toFixed(3)}
      data-pend-left={state.left}
      data-pend-right={state.right}
      data-pend-pushes={state.pushes}
      data-pend-can-push={canPush}
    >
      <section className="pend-workbench" aria-label="摆钟实验台">
        <header className="pend-heading">
          <div>
            <span className="pend-eyebrow">PENDULUM · TIMING LAB</span>
            <h3>{config.title}</h3>
          </div>
          <div className="pend-time">
            <strong>
              {state.time.toFixed(1)}
              <small> s</small>
            </strong>
            <span>自由节拍 · 无倒计时</span>
          </div>
        </header>
        <div className="pend-scoreboard">
          <div>
            <span>左钟 −{config.target}°</span>
            <strong>
              {state.left}
              <small> / {config.goal}</small>
            </strong>
            <div className="pend-pips">{pips(state.left)}</div>
          </div>
          <div className={`pend-phase ${canPush ? "pend-open" : ""}`}>
            <span>{phaseText}</span>
            <small>推力区 ±{config.window}°</small>
          </div>
          <div>
            <span>右钟 +{config.target}°</span>
            <strong>
              {state.right}
              <small> / {config.goal}</small>
            </strong>
            <div className="pend-pips">{pips(state.right)}</div>
          </div>
        </div>
        <div
          className={`pend-stage ${canPush ? "pend-stage-open" : ""}`}
          tabIndex={0}
          role="group"
          aria-label="摆钟场地，A 或左方向键向左推，D 或右方向键向右推"
        >
          <svg
            viewBox="0 0 620 400"
            role="img"
            aria-label={`摆角 ${degrees.toFixed(1)} 度，${movingRight ? "向右" : movingLeft ? "向左" : "接近转向"}，左钟 ${state.left} 次，右钟 ${state.right} 次`}
          >
            <defs>
              <linearGradient id="pend-brass" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#ffe7a1" />
                <stop offset="1" stopColor="#cf943c" />
              </linearGradient>
              <radialGradient id="pend-face">
                <stop stopColor="#fffdf2" />
                <stop offset="1" stopColor="#f1e8cc" />
              </radialGradient>
            </defs>
            <rect width="620" height="400" rx="22" fill="url(#pend-face)" />
            <g stroke="#dfd7bd" strokeWidth="1">
              <path d="M35 55H585M35 375H585" />
              <path d="M310 110V344" strokeDasharray="3 6" />
            </g>
            <path
              d={`M310 85 L${gate.x} ${gate.y} ${arc(-config.window, config.window, 245).replace(/^M[^A]+/, "")} Z`}
              className="pend-gate"
            />
            <path
              d={arc(-80, 80, 230)}
              fill="none"
              stroke="#d4c7a6"
              strokeWidth="2"
              strokeDasharray="3 6"
            />
            {[-80, -60, -40, -20, 0, 20, 40, 60, 80].map((angle) => {
              const a = point(angle, 245),
                b = point(angle, 252),
                label = point(angle, 269);
              return (
                <g key={angle}>
                  <path
                    d={`M${a.x} ${a.y} L${b.x} ${b.y}`}
                    stroke={Math.abs(angle) === 80 ? "#b96149" : "#b6a888"}
                    strokeWidth="2"
                  />
                  <text
                    x={label.x}
                    y={label.y + 5}
                    textAnchor="middle"
                    className={
                      Math.abs(angle) === 80
                        ? "pend-limit-label"
                        : "pend-scale-label"
                    }
                  >
                    {angle}°
                  </text>
                </g>
              );
            })}
            {([-1, 1] as const).map((side) => {
              const b = side === -1 ? leftBell : rightBell,
                score = side === -1 ? state.left : state.right;
              return (
                <g
                  key={side}
                  className={
                    score >= config.goal ? "pend-bell-done" : "pend-bell"
                  }
                >
                  <path
                    d={`M310 85L${b.x} ${b.y}`}
                    stroke="#b79d67"
                    strokeWidth="1.5"
                    strokeDasharray="4 7"
                  />
                  <circle
                    cx={b.x}
                    cy={b.y}
                    r="31"
                    fill={score >= config.goal ? "#d7e9dd" : "#f7df9d"}
                    opacity=".85"
                  />
                  <g
                    transform={`translate(${b.x} ${b.y})`}
                    fill={score >= config.goal ? "#528c79" : "#b88739"}
                  >
                    <path d="M-16 10 Q-11 3-11-6 A11 11 0 0 1 11-6 Q11 3 16 10 Z" />
                    <circle cy="15" r="4" />
                    <circle cy="-20" r="3" />
                  </g>
                  <text
                    x={b.x}
                    y={b.y - 43}
                    textAnchor="middle"
                    className="pend-bell-label"
                  >
                    {side === -1 ? "左" : "右"} {config.target}°
                  </text>
                </g>
              );
            })}
            <path
              d={`M310 85 L${bob.x} ${bob.y}`}
              stroke="#978968"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d={`M310 85 L${bob.x} ${bob.y}`}
              stroke="#eee6cf"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <rect x="269" y="42" width="82" height="31" rx="9" fill="#436c60" />
            <path
              d="M281 73V85H339V73"
              fill="none"
              stroke="#436c60"
              strokeWidth="7"
            />
            <circle
              cx="310"
              cy="85"
              r="14"
              fill="#688e7d"
              stroke="#fff9e7"
              strokeWidth="5"
            />
            <circle cx="310" cy="85" r="4" fill="#e6dab7" />
            <circle
              cx={bob.x}
              cy={bob.y}
              r="22"
              fill="url(#pend-brass)"
              stroke="#9b7436"
              strokeWidth="3"
            />
            <circle
              cx={bob.x}
              cy={bob.y}
              r="13"
              fill="none"
              stroke="#fff5ce"
              strokeWidth="2"
            />
            <text
              x={bob.x}
              y={bob.y + 6}
              textAnchor="middle"
              fontSize="20"
              fill="#755728"
            >
              {movingRight ? "→" : movingLeft ? "←" : "·"}
            </text>
            <text
              x="310"
              y="379"
              textAnchor="middle"
              className="pend-stage-caption"
            >
              绿色扇区可推 · 向外过钟才计数 · ±80° 安全线
            </text>
          </svg>
        </div>
        <div className="pend-readouts" aria-label="实时摆锤读数">
          <div>
            <span>当前摆角</span>
            <strong>
              {degrees > 0 ? "+" : ""}
              {degrees.toFixed(1)}°
            </strong>
          </div>
          <div>
            <span>角速度</span>
            <strong>
              {state.omega.toFixed(2)}
              <small> rad/s</small>
            </strong>
          </div>
          <div>
            <span>能量折算摆幅</span>
            <strong>{amplitude.toFixed(1)}°</strong>
          </div>
        </div>
        <p className="pend-estimate-note">
          折算摆幅不计未来阻尼，实际峰值会更小。正角度、正速度都朝右。
        </p>
        <div className="pend-controls">
          <button
            type="button"
            className="pend-push"
            aria-label="向左推"
            disabled={!canPush}
            onClick={(e) => {
              if (!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) push(-1);
            }}
          >
            <strong>← 向左推</strong>
            <small>A / ←</small>
          </button>
          <button
            type="button"
            className="pend-push"
            aria-label="向右推"
            disabled={!canPush}
            onClick={(e) => {
              if (!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) push(1);
            }}
          >
            <strong>向右推 →</strong>
            <small>D / →</small>
          </button>
        </div>
        <button
          type="button"
          className="pend-start"
          disabled={
            paused || state.phase === "running" || state.phase === "won"
          }
          onClick={(e) => {
            if (!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey))
              startOrRetry();
          }}
        >
          {state.phase === "ready"
            ? "开始摆动"
            : state.phase === "lost"
              ? "重新尝试"
              : state.phase === "won"
                ? "节拍完成"
                : "摆动进行中"}
        </button>
        <p className="pend-message" role="status">
          {paused
            ? "已暂停。摆锤与计时都已冻结，继续时不会补走时间。"
            : message}
        </p>
      </section>
      <aside className="pend-notes">
        <span className="pend-eyebrow">相位 · 动能 · 恰好的推力</span>
        <h3>
          轻轻推一下，
          <br />
          让钟声接力。
        </h3>
        <p>{config.lesson}</p>
        <ol>
          <li>点“开始摆动”，摆锤从左侧 −12° 静止释放。</li>
          <li>摆锤进入绿色中央区时，向左或向右推。每次经过最多推一次。</li>
          <li>
            向外摆过目标钟才响；往中央返回时不重复计数。左右各响 {config.goal}{" "}
            次即完成。
          </li>
          <li>如果实际摆角达到 ±{PEND_LIMIT}°，本轮结束，可以无限重试。</li>
        </ol>
        <div className="pend-rule-card">
          <strong>推力有方向</strong>
          <p>
            顺着速度推会补能；反向推可能刹车，也可能把摆锤推到反向。按钮表示施力方向，不能把每一次推都当作“加能量”。
          </p>
        </div>
        <dl className="pend-specs">
          <div>
            <dt>摆长</dt>
            <dd>{config.length.toFixed(1)} m</dd>
          </div>
          <div>
            <dt>每推改变角速度</dt>
            <dd>±{config.impulse.toFixed(2)} rad/s</dd>
          </div>
          <div>
            <dt>已施力</dt>
            <dd>{state.pushes} 次</dd>
          </div>
        </dl>
        <details>
          <summary>操作与节拍提示</summary>
          <p>
            触屏轻点大按钮；键盘聚焦场地后用 A / D
            或左右方向键。不接受长按连发或组合快捷键。也可用 Tab 选按钮，再按
            Enter / 空格。
          </p>
          <p>
            如果刹车后摆幅困在中央区，距上次推力 0.8
            秒后就能再推，不会卡住。摆幅够高时先等钟声，阻尼会慢慢消耗能量。
          </p>
          <p>
            暂停冻结运动，重来恢复起点。实时物理无法撤销。提示只解释当前能量与时机，不会替你推。
          </p>
        </details>
      </aside>
    </div>
  );
}
