import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { MechanicalScene } from "./MechanicalScene";
import {
  createGearState,
  formatGearFraction,
  gearDirection,
  gearHint,
  gearLevels,
  gearNextMove,
  gearPartName,
  gearTransmission,
  isGearSolved,
  moveGear,
  undoGear,
  type GearMove,
  type GearPart,
} from "./gearLogic";
import "./mechanicalGames.css";
const parts: GearPart[] = ["driver", "idler", "driven"];
export default function GearWorks(props: GameProps) {
  return <GearLevel key={`${props.level}:${props.resetToken}`} {...props} />;
}
function GearLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = gearLevels[level] ?? gearLevels[0];
  const [state, setState] = useState(() => createGearState(config));
  const [hint, setHint] = useState<GearMove | null>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const result = gearTransmission(config.input, state.settings);
  const won = isGearSolved(config, state);
  const model = useMemo(() => {
    const transmission = gearTransmission(config.input, state.settings);
    return {
      kind: "gears" as const,
      stages: state.settings.map((s, i) => ({
        driver: s.driver ?? config.stages[i].driver[0],
        driven: s.driven ?? config.stages[i].driven[0],
        idler: s.idler ?? config.stages[i].idler[0],
        driverSpeed: transmission
          ? transmission.stages[i].driver.numerator /
            transmission.stages[i].driver.denominator
          : 0,
        drivenSpeed: transmission
          ? transmission.stages[i].driven.numerator /
            transmission.stages[i].driven.denominator
          : 0,
        idlerSpeed: transmission?.stages[i].idler
          ? transmission.stages[i].idler!.numerator /
            transmission.stages[i].idler!.denominator
          : 0,
      })),
    };
  }, [config, state.settings]);
  useEffect(() => {
    onStatus(
      `选择各级齿轮，让输出达到${gearDirection(config.target)} ${formatGearFraction(config.target, true)} 转/分。`,
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    setHint(gearNextMove(config, state));
    onStatus(gearHint(config, state));
  }, [hintToken, paused, won, config, state, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused) return;
    const previous = undoGear(state);
    setState(previous);
    setHint(null);
    onStatus(
      previous === state ? "还没有选择可以撤销。" : "已撤销一次齿轮选择。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `传动成功！输出${gearDirection(config.target)} ${formatGearFraction(config.target, true)} 转/分。`,
      );
      onComplete();
    }
  }, [won, paused, config, onStatus, onComplete]);
  function choose(move: GearMove) {
    if (paused || won) return;
    const next = moveGear(config, state, move);
    if (next === state) return;
    setState(next);
    setHint(null);
    const output = gearTransmission(config.input, next.settings);
    onStatus(
      output
        ? `当前输出${gearDirection(output.output)} ${formatGearFraction(output.output, true)} 转/分，共 ${output.meshes} 次外啮合。`
        : "齿轮已选好。继续完成其余选项，就能看到精确输出。",
    );
  }
  return (
    <div className="puzzle-layout mechanical-game gear-works">
      <section className="mechanical-workbench" aria-label="齿轮传动实验台">
        <div className="mechanical-title">
          <span className="mini-label">齿轮工坊 · {config.title}</span>
          <span>{config.stages.length} 级传动</span>
        </div>
        <MechanicalScene model={model} paused={paused || !result} won={won} />
        <div className={`gear-readouts ${won ? "is-balanced" : ""}`}>
          <div>
            <small>输入 · 顺时针</small>
            <strong>
              {formatGearFraction(config.input, true)} <span>转/分</span>
            </strong>
          </div>
          <div>
            <small>目标 · {gearDirection(config.target)}</small>
            <strong>
              {formatGearFraction(config.target, true)} <span>转/分</span>
            </strong>
          </div>
          <div aria-live="polite">
            <small>
              当前 · {result ? gearDirection(result.output) : "待装配"}
            </small>
            <strong data-testid="gear-output">
              {result ? formatGearFraction(result.output, true) : "?"}{" "}
              <span>{result ? "转/分" : "选好所有齿轮"}</span>
            </strong>
          </div>
        </div>
        <p className="mechanical-instruction">
          {paused
            ? "实验已暂停。"
            : won
              ? "转速和方向全部匹配，设计完成！"
              : "选择齿数试一试。传动轴会随尺寸调整，所有组合都能装配。"}
        </p>
        <div className="gear-stage-list">
          {config.stages.map((stage, i) => (
            <div key={i} className="gear-stage">
              {i > 0 && (
                <div className="gear-shaft-note">
                  ↳ 同轴连接：第 {i} 级从动轮 = 第 {i + 1} 级主动轮的转速和方向
                </div>
              )}
              <h4>
                第 {i + 1} 级{" "}
                <span>
                  {state.settings[i].idler
                    ? "主动轮 ⇄ 惰轮 ⇄ 从动轮"
                    : "主动轮 ⇄ 从动轮"}
                </span>
              </h4>
              <div className="gear-part-grid">
                {parts.map((part) => {
                  const options = stage[part];
                  if (
                    part === "idler" &&
                    options.length === 1 &&
                    options[0] === 0
                  )
                    return null;
                  return (
                    <fieldset key={part}>
                      <legend>
                        {gearPartName[part]}
                        {options.length === 1 ? " · 固定" : ""}
                      </legend>
                      <div className="gear-options">
                        {options.map((teeth) => (
                          <button
                            key={teeth}
                            data-stage={i}
                            data-part={part}
                            data-teeth={teeth}
                            disabled={paused || won || options.length === 1}
                            aria-pressed={state.settings[i][part] === teeth}
                            aria-label={`第 ${i + 1} 级${gearPartName[part]}，${teeth === 0 ? "不安装" : `${teeth} 齿`}${options.length === 1 ? "，固定" : ""}`}
                            className={`${state.settings[i][part] === teeth ? "selected" : ""} ${hint?.stage === i && hint.part === part && hint.teeth === teeth ? "hinted" : ""}`}
                            onClick={() => choose({ stage: i, part, teeth })}
                          >
                            {teeth === 0 ? (
                              "不安装"
                            ) : (
                              <>
                                <strong>{teeth}</strong>
                                <small>齿</small>
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
              <p className="gear-equation">
                {result
                  ? `速比 ${formatGearFraction(result.stages[i].ratio)} · ${result.stages[i].meshes} 次啮合 · 输出${gearDirection(result.stages[i].driven)} ${formatGearFraction(result.stages[i].driven, true)} 转/分`
                  : "选好所有级的齿轮后，这里会显示精确速比。"}
              </p>
            </div>
          ))}
        </div>
        <p className="mechanical-caption">
          预览是可调轴距的理想齿轮模型，忽略摩擦与惯性。未装齐时只显示备选尺寸，暂停转动。
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">比例 · 方向 · 工程</span>
        <h3>把转动送到刚刚好。</h3>
        <p>{config.idea}</p>
        <div className="note">
          <strong>每次外啮合都会反向</strong>
          <p>从动转速 = −主动转速 × 主动齿数 ÷ 从动齿数。负号表示转向相反。</p>
          <p>
            惰轮只增加一次反向，不改变输入到输出的速比大小。同轴的齿轮一起转，下一传动级的速比才继续相乘。
          </p>
        </div>
        <p className="muted">
          顺、逆时针均从齿轮正面观察。Tab 选择选项，Enter
          或空格装配；触屏直接点按。没有计时压力。
        </p>
      </aside>
    </div>
  );
}
