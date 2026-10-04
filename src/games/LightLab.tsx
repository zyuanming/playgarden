import { useEffect, useState } from "react";
import type { GameProps } from "../lib/types";
import { lightLevels, traceLight, type Mirror } from "./lightLogic";
export default function LightLab({
  level,
  paused,
  resetToken,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = lightLevels[level];
  const [mirrors, setMirrors] = useState(config.mirrors);
  const [history, setHistory] = useState<Mirror[][]>([]);
  const result = traceLight(config, mirrors);
  useEffect(() => {
    setMirrors(config.mirrors);
    setHistory([]);
    onStatus("点击镜子旋转 90°，把光线送到星星。");
  }, [level, resetToken]);
  useEffect(() => {
    if (hintToken) onStatus(config.hint);
  }, [hintToken]);
  useEffect(() => {
    if (undoToken)
      setHistory((h) => {
        if (h.length) setMirrors(h[h.length - 1]);
        return h.slice(0, -1);
      });
  }, [undoToken]);
  useEffect(() => {
    if (result.won) {
      onStatus("光线到达目标！你掌握了反射的秘密。");
      onComplete();
    }
  }, [result.won]);
  function rotate(i: number) {
    if (paused || result.won) return;
    setHistory((h) => [...h, mirrors]);
    setMirrors((ms) =>
      ms.map((m, j) => (j === i ? { ...m, slash: !m.slash } : m)),
    );
  }
  const n = config.size;
  return (
    <div className="puzzle-layout">
      <div className="light-board board" style={{ aspectRatio: "1" }}>
        <svg
          viewBox={`0 0 ${n * 80} ${n * 80}`}
          aria-label="光路预览"
          role="img"
        >
          <defs>
            <pattern
              id="grid"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <rect x="4" y="4" width="72" height="72" rx="14" fill="#224e44" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <polyline
            points={result.path
              .map((p) => `${p.x * 80 + 40},${p.y * 80 + 40}`)
              .join(" ")}
            fill="none"
            stroke="#ffee82"
            strokeWidth="13"
            opacity=".4"
            filter="url(#glow)"
          />
          <polyline
            points={result.path
              .map((p) => `${p.x * 80 + 40},${p.y * 80 + 40}`)
              .join(" ")}
            fill="none"
            stroke="#ffed89"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle
            cx={config.start.x * 80 + 40}
            cy={config.start.y * 80 + 40}
            r="21"
            fill="#ffad45"
          />
          <text
            x={config.start.x * 80 + 40}
            y={config.start.y * 80 + 49}
            textAnchor="middle"
            fontSize="25"
          >
            ☀
          </text>
          <text
            x={config.target.x * 80 + 40}
            y={config.target.y * 80 + 53}
            textAnchor="middle"
            fill={result.won ? "#e4fa40" : "#e5e9d5"}
            fontSize="40"
          >
            ★
          </text>
        </svg>
        {mirrors.map((m, i) => (
          <button
            key={i}
            className="mirror"
            aria-label={`镜子 ${i + 1}，${m.slash ? "斜杠" : "反斜杠"}，点击旋转`}
            disabled={paused || result.won}
            onClick={() => rotate(i)}
            style={{
              left: `${(m.x / n) * 100}%`,
              top: `${(m.y / n) * 100}%`,
              width: `${100 / n}%`,
              height: `${100 / n}%`,
            }}
          >
            <span style={{ transform: `rotate(${m.slash ? -45 : 45}deg)` }} />
          </button>
        ))}
      </div>
      <aside className="game-notes">
        <span className="mini-label">观察 · 推理 · 实验</span>
        <h3>让光拐个弯。</h3>
        <p>光沿直线前进，碰到镜子时转弯。点击一面镜子，看看光路发生了什么。</p>
        <div className="note">
          <strong>小发现</strong>
          <p>入射角等于反射角。在这里，45° 的镜子让光转弯 90°。</p>
        </div>
        <p className="muted">键盘：Tab 选择镜子，Enter 或空格旋转。</p>
      </aside>
    </div>
  );
}
