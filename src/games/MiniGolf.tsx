// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  miniGolfLevels,
  simulateGolf,
  miniGolfHint,
  type GolfPoint,
  type GolfShot,
} from "./miniGolfLogic";
import "./miniGolf.css";
export default function MiniGolf(p: GameProps) {
  return <GolfRound key={`${p.level}:${p.resetToken}`} {...p} />;
}
function GolfRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = miniGolfLevels[level] ?? miniGolfLevels[0];
  const [ball, setBall] = useState<GolfPoint>({ ...config.start }),
    [history, setHistory] = useState<GolfPoint[]>([]),
    [angleText, setAngleText] = useState(
      String(
        Math.round(
          (Math.atan2(
            config.hole.y - config.start.y,
            config.hole.x - config.start.x,
          ) *
            180) /
            Math.PI,
        ),
      ),
    ),
    [powerText, setPowerText] = useState("60"),
    [flight, setFlight] = useState<GolfShot | null>(null),
    [won, setWon] = useState(false),
    [preview, setPreview] = useState<GolfShot | null>(null),
    [message, setMessage] = useState(config.lesson);
  const cursor = useRef(0),
    running = useRef(false),
    pause = useRef(paused),
    done = useRef(false),
    tokens = useRef({ hintToken, undoToken }),
    callbacks = useRef({ onComplete, onStatus });
  pause.current = paused;
  callbacks.current = { onComplete, onStatus };
  const rawAngle = Number(angleText),
    rawPower = Number(powerText);
  const angle = Number.isFinite(rawAngle) ? rawAngle : 0;
  const power = Number.isFinite(rawPower) ? rawPower : 60;
  const validControls =
    angleText.trim() !== "" &&
    powerText.trim() !== "" &&
    Number.isFinite(rawAngle) &&
    Number.isFinite(rawPower) &&
    angle >= -180 &&
    angle <= 180 &&
    power >= 15 &&
    power <= 100;
  const locked = paused || won || !!flight;
  function report(s: string) {
    setMessage(s);
    callbacks.current.onStatus(s);
  }
  useEffect(() => {
    callbacks.current.onStatus(config.lesson);
  }, []);
  useEffect(() => {
    if (!flight || paused) return;
    running.current = true;
    let id = 0,
      last = 0,
      acc = 0;
    const frame = (now: number) => {
      if (!running.current || pause.current) return;
      if (last) acc += Math.min(0.05, (now - last) / 1000);
      last = now;
      while (acc >= 1 / 60) {
        cursor.current++;
        acc -= 1 / 60;
      }
      const index = Math.min(cursor.current, flight.points.length - 1);
      setBall(flight.points[index]);
      if (index === flight.points.length - 1) {
        running.current = false;
        setFlight(null);
        setWon(flight.won);
        if (!flight.won) report("球停稳了。可以调整角度和力度，再来一杆。");
        return;
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => {
      running.current = false;
      cancelAnimationFrame(id);
    };
  }, [flight, paused]);
  useEffect(() => {
    if (won && !paused && !done.current) {
      done.current = true;
      report(
        `小球入杯！用了 ${history.length} 杆。参考杆数只是练习目标，不限制通关。`,
      );
      callbacks.current.onComplete();
    }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const hint = miniGolfHint(config, ball);
    if (hint) {
      setAngleText(String(hint.angle));
      setPowerText(String(hint.power));
      setPreview(hint.shot);
      report(
        hint.exact
          ? "从当前停球处找到了入杯路线。角度和力度已标好，按“推杆”自己出手。"
          : "本次粗粒度搜索没找到一杆入杯；给出了较接近的停球建议。也可以自己选择中转点，提示不保证最少杆数。",
      );
    }
  }, [hintToken]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || won) return;
    if (history.length) {
      running.current = false;
      setFlight(null);
      setBall(history.at(-1)!);
      setHistory(history.slice(0, -1));
      setPreview(null);
      report("已收回上一杆，小球回到出手前的位置。");
    } else report("还没有推杆记录。");
  }, [undoToken]);
  function shoot() {
    if (locked || !validControls) return;
    const shot = simulateGolf(config, ball, angle, power);
    setHistory([...history, ball]);
    cursor.current = 0;
    setPreview(null);
    setFlight(shot);
    report("小球正在滚动。暂停可冻结，撤销可收回整杆。");
  }
  const aim = {
    x: ball.x + Math.cos((angle * Math.PI) / 180) * 42,
    y: ball.y + Math.sin((angle * Math.PI) / 180) * 42,
  };
  return (
    <div
      className="mg-game"
      data-mini-golf-game
      data-golf-ball={JSON.stringify(ball)}
      data-mini-golf-won={won}
      data-mini-golf-phase={flight ? "rolling" : won ? "won" : "ready"}
      data-mini-golf-strokes={history.length}
    >
      <section className="mg-green">
        <header>
          <div>
            <span>A LITTLE PUTT, A NEW PATH</span>
            <h3>{config.title}</h3>
          </div>
          <b>
            {history.length}
            <small> 杆</small>
          </b>
        </header>
        <p>{config.lesson}</p>
        <div className="mg-course">
          <svg
            viewBox="0 0 480 320"
            role="img"
            aria-label="俯视果岭，花坛和边墙会反弹小球"
          >
            <defs>
              <pattern
                id="golf-grass"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <rect width="32" height="32" fill="#dfecc5" />
                <path
                  d="m4 13 3-4 3 4m16 13 3-4"
                  stroke="#cadcaf"
                  strokeWidth="1.5"
                  fill="none"
                />
              </pattern>
            </defs>
            <rect width="480" height="320" rx="15" fill="url(#golf-grass)" />
            <rect
              x="3"
              y="3"
              width="474"
              height="314"
              rx="12"
              stroke="#92ac76"
              strokeWidth="6"
              fill="none"
            />
            {config.walls.map((w, i) => (
              <g key={i}>
                <rect
                  {...w}
                  rx="8"
                  fill="#8eaa7c"
                  stroke="#66885e"
                  strokeWidth="2"
                />
                <path
                  d={`M${w.x + 8} ${w.y + 10}h${w.width - 16}`}
                  stroke="#bfd5a8"
                  strokeWidth="3"
                />
                <circle
                  cx={w.x + w.width / 2}
                  cy={w.y + w.height / 2}
                  r="9"
                  fill="#c1d8a4"
                />
              </g>
            ))}
            <circle
              cx={config.hole.x}
              cy={config.hole.y}
              r="13"
              fill="#315342"
            />
            <circle
              cx={config.hole.x}
              cy={config.hole.y}
              r="18"
              fill="none"
              stroke="#f8f4cf"
              strokeDasharray="3 4"
            />
            <path
              d={`M${config.hole.x} ${config.hole.y - 7}v-34h24l-6 7 6 7h-24`}
              stroke="#69816a"
              strokeWidth="2"
              fill="#e8aa73"
            />
            {preview && (
              <polyline
                points={preview.points
                  .filter((_, i) => i % 5 === 0)
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke="#9a844b"
                strokeWidth="2"
                strokeDasharray="4 5"
              />
            )}
            {!flight && !won && (
              <path
                d={`M${ball.x} ${ball.y}L${aim.x} ${aim.y}`}
                stroke="#6f8766"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}
            <circle cx={ball.x + 2} cy={ball.y + 3} r="6" fill="#54774744" />
            <circle
              cx={ball.x}
              cy={ball.y}
              r={won ? 4 : 6}
              fill="#fffefa"
              stroke="#a5af86"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div className="mg-settings">
          <label>
            角度（度）
            <input
              aria-label="推杆角度"
              type="number"
              min="-180"
              max="180"
              step="1"
              value={angleText}
              disabled={locked}
              onChange={(e) => {
                setAngleText(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <label>
            力度（15–100）
            <input
              aria-label="推杆力度"
              type="number"
              min="15"
              max="100"
              step="1"
              value={powerText}
              disabled={locked}
              onChange={(e) => {
                setPowerText(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <button
            type="button"
            className="mg-shoot"
            disabled={locked || !validControls}
            onClick={shoot}
          >
            推杆
          </button>
        </div>
        {!validControls && (
          <p role="alert">
            角度需要在 −180 到 180 之间，力度需要在 15 到 100 之间。
          </p>
        )}
        <p className="mg-angles">0° 向右 · 90° 向下 · −90° 向上 · 180° 向左</p>
        <p className="mg-message" role="status">
          {paused ? "果岭已暂停，小球停在这一刻。" : message}
        </p>
      </section>
      <aside className="mg-notes">
        <span>角度 · 力度 · 反弹</span>
        <h3>
          不一定一杆，
          <br />
          每杆都在靠近。
        </h3>
        <ol>
          <li>设置角度与力度，按“推杆”让球滚出。</li>
          <li>草地持续减速，边墙和花坛会反弹并损失一些速度。</li>
          <li>小球靠近洞心十二个场地单位内，就会被洞口接住。</li>
        </ol>
        <p>
          这是简化的平面推杆模型，没有风、坡度或旋转。参考 {config.par}{" "}
          杆是练习目标；不限杆数，入杯才通关。
        </p>
        <details>
          <summary>暂停、撤销与提示</summary>
          <p>
            输入框支持键盘数字和上下箭头，触屏也可编辑。提示会在当前停球处搜索一个候选角度与力度，并画出计算的路径；仍需自己按推杆。滚动中也能撤销整杆。暂停恢复后继续原来的轨迹，重来回到开球点。
          </p>
        </details>
      </aside>
    </div>
  );
}
