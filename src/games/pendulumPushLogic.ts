// SPDX-License-Identifier: GPL-3.0-only
// Original nonlinear, damped pendulum with discrete signed angular impulses.
export const pendulumPushLevels = [
  {
    title: "第一声钟",
    target: 25,
    goal: 1,
    window: 14,
    length: 2.8,
    damping: 0.055,
    impulse: 0.52,
    lesson: "等摆锤靠近最低点，再顺着它的运动方向轻推。左右各响一次就过关。",
  },
  {
    title: "稍远的钟声",
    target: 30,
    goal: 1,
    window: 14,
    length: 3,
    damping: 0.055,
    impulse: 0.53,
    lesson: "钟移到 30°。一次推力不一定够，等摆锤下一次经过中央再补能。",
  },
  {
    title: "借回程的力",
    target: 33,
    goal: 1,
    window: 13,
    length: 2.7,
    damping: 0.055,
    impulse: 0.55,
    lesson: "回程也能推。注意速度箭头：摆锤从右侧回来时，向左推才是顺势。",
  },
  {
    title: "四声小曲",
    target: 35,
    goal: 2,
    window: 12,
    length: 2.9,
    damping: 0.056,
    impulse: 0.56,
    lesson: "左右各响两次。摆幅足够时可以等一等，让惯性带它完成下一声。",
  },
  {
    title: "收一点手",
    target: 38,
    goal: 2,
    window: 11,
    length: 2.6,
    damping: 0.055,
    impulse: 0.58,
    lesson: "每次都推容易过头。反向推可能刹车，但用力过猛也会反转并重新加速。",
  },
  {
    title: "窄窗节拍",
    target: 40,
    goal: 2,
    window: 10,
    length: 2.8,
    damping: 0.056,
    impulse: 0.59,
    lesson: "中央推力区缩到 ±10°。提前看运动方向，在绿色窗口亮起时轻点。",
  },
  {
    title: "六声回响",
    target: 42,
    goal: 3,
    window: 10,
    length: 2.5,
    damping: 0.055,
    impulse: 0.61,
    lesson: "左右各响三次。阻尼会慢慢吃掉能量，观察当前摆幅再决定是否补推。",
  },
  {
    title: "摆钟合奏",
    target: 45,
    goal: 3,
    window: 9,
    length: 2.7,
    damping: 0.055,
    impulse: 0.62,
    lesson: "目标在 ±45°，推力区仅 ±9°。把握方向、留出余量，完成六次真实钟声。",
  },
] as const;

export type PendulumLevel = (typeof pendulumPushLevels)[number];
export type PendulumState = {
  theta: number;
  omega: number;
  time: number;
  phase: "ready" | "running" | "won" | "lost";
  left: number;
  right: number;
  pushes: number;
  spent: boolean;
  lastPush: number;
};
export const PEND_GRAVITY = 9.81;
export const PEND_LIMIT = 80;
export const pendRadians = (degrees: number) => (degrees * Math.PI) / 180;
export const pendDegrees = (radians: number) => (radians * 180) / Math.PI;
export const initialPendulum = (): PendulumState => ({
  theta: pendRadians(-12),
  omega: 0,
  time: 0,
  phase: "ready",
  left: 0,
  right: 0,
  pushes: 0,
  spent: false,
  lastPush: -1,
});

/** Mechanical energy per moment of inertia, using the lowest point as zero. */
export function pendulumEnergy(
  level: PendulumLevel,
  state: PendulumState,
): number {
  return (
    state.omega ** 2 / 2 +
    (PEND_GRAVITY / level.length) * (1 - Math.cos(state.theta))
  );
}

/** Present energy converted to amplitude WITHOUT future damping; not a guaranteed peak. */
export function pendulumAmplitude(
  level: PendulumLevel,
  state: PendulumState,
): number {
  const cosine =
    1 - (pendulumEnergy(level, state) * level.length) / PEND_GRAVITY;
  return pendDegrees(Math.acos(Math.max(-1, Math.min(1, cosine))));
}

export function canPushPendulum(
  level: PendulumLevel,
  state: PendulumState,
): boolean {
  if (
    state.phase !== "running" ||
    Math.abs(state.theta) > pendRadians(level.window)
  )
    return false;
  // A braked, small oscillation may never leave the gate. Explicitly rearm it
  // after 0.8 s instead of leaving the player permanently unable to restart.
  return (
    !state.spent ||
    (state.time - state.lastPush >= 0.8 &&
      pendulumAmplitude(level, state) <= level.window)
  );
}

export function pushPendulum(
  level: PendulumLevel,
  state: PendulumState,
  direction: -1 | 1,
): PendulumState {
  if (!canPushPendulum(level, state)) return state;
  return {
    ...state,
    omega: state.omega + direction * level.impulse,
    pushes: state.pushes + 1,
    spent: true,
    lastPush: state.time,
  };
}

export function stepPendulum(
  level: PendulumLevel,
  state: PendulumState,
  seconds: number,
): PendulumState {
  if (state.phase !== "running" || !Number.isFinite(seconds) || seconds <= 0)
    return state;
  // RK4 with <= 1/240 s substeps. A delayed/background frame cannot catch up
  // more than 50 ms; pausing and resuming also creates a fresh frame timestamp.
  const elapsed = Math.min(seconds, 0.05),
    count = Math.ceil(elapsed * 240),
    dt = elapsed / count;
  const gravity = PEND_GRAVITY / level.length,
    target = pendRadians(level.target);
  const acceleration = (theta: number, omega: number) =>
    -gravity * Math.sin(theta) - level.damping * omega;
  let next = { ...state };
  for (let i = 0; i < count; i++) {
    const { theta, omega } = next;
    const a1 = acceleration(theta, omega);
    const w2 = omega + (a1 * dt) / 2,
      a2 = acceleration(theta + (omega * dt) / 2, w2);
    const w3 = omega + (a2 * dt) / 2,
      a3 = acceleration(theta + (w2 * dt) / 2, w3);
    const w4 = omega + a3 * dt,
      a4 = acceleration(theta + w3 * dt, w4);
    const angle = theta + (dt * (omega + 2 * w2 + 2 * w3 + w4)) / 6;
    const velocity = omega + (dt * (a1 + 2 * a2 + 2 * a3 + a4)) / 6;
    const left = Math.min(
      level.goal,
      next.left + Number(theta > -target && angle <= -target && velocity < 0),
    );
    const right = Math.min(
      level.goal,
      next.right + Number(theta < target && angle >= target && velocity > 0),
    );
    next = {
      ...next,
      theta: angle,
      omega: velocity,
      time: next.time + dt,
      left,
      right,
      spent: Math.abs(angle) > pendRadians(level.window) ? false : next.spent,
    };
    // The angle, not an estimate or an impulse count, determines a real overswing.
    if (Math.abs(angle) >= pendRadians(PEND_LIMIT)) {
      next.phase = "lost";
      break;
    }
    if (left >= level.goal && right >= level.goal) {
      next.phase = "won";
      break;
    }
  }
  return next;
}

export function pendulumHint(
  level: PendulumLevel,
  state: PendulumState,
): string {
  if (state.phase === "ready")
    return "先点“开始摆动”。中央绿色扇区是推力窗口；每次经过最多推一次，左右目标钟都要响。";
  const amplitude = pendulumAmplitude(level, state).toFixed(1);
  const direction =
    state.omega > 0.025
      ? "向右"
      : state.omega < -0.025
        ? "向左"
        : state.theta <= 0
          ? "向右"
          : "向左";
  const energy = `当前能量折算摆幅约 ${amplitude}°，考虑阻尼后实际峰值会更小。`;
  if (pendulumAmplitude(level, state) >= level.target + 8)
    return `${energy}目前能量较充足，先等下一声钟；反向推可能刹车，也可能反转，不能当作固定减速键。`;
  if (!canPushPendulum(level, state))
    return `${energy}等下一次绿色推力窗口；若摆幅留在窗口内，用过推力 0.8 秒后可再推。`;
  return `${energy}此刻可${direction}推一下，顺势补能。目标钟在 ±${level.target}°，不要每次经过都推。`;
}
