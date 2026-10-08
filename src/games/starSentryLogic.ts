// SPDX-License-Identifier: GPL-3.0-only
// Original rules, finite stages and geometry. No upstream game code or assets.
export const SENTRY_WORLD = { width: 600, height: 440, shipY: 396, shipSpeed: 225, shotSpeed: 390, maxShots: 36 } as const;
export type SentryInput = { left: boolean; right: boolean; fire: boolean };
export type SentryPhase = "ready" | "playing" | "won" | "lost";
type Motion = "patrol" | "bob" | "opposed" | "weave";
type Volley = "aim" | "straight" | "pair" | "fan";
export type SentryRobot = { id: number; homeX: number; homeY: number; x: number; y: number; row: number; hp: number };
export type SentryShelter = { id: number; x: number; y: number; width: number; hp: number; maxHp: number };
export type SentryShot = { id: number; side: "ship" | "robot"; x: number; y: number; vx: number; vy: number };
export type SentryWarning = { robotId: number; target: number; countdown: number };
export type SentryLevel = {
  id: string; name: string; lesson: string; formation: readonly (readonly number[])[];
  top: number; gap: number; motion: Motion; amplitude: number; pace: number;
  volley: Volley; interval: number; bulletSpeed: number;
  shelters: readonly (readonly [number, number, number])[]; armored?: readonly number[];
};
export const starSentryLevels: readonly SentryLevel[] = [
  { id: "first-signal", name: "01 · 第一束信号", lesson: "先横移对齐，再发射。只有三台慢速机器人；橙色圈会提前提示它们的反击。", formation: [[220, 300, 380]], top: 110, gap: 48, motion: "patrol", amplitude: 18, pace: 0.55, volley: "aim", interval: 3.8, bulletSpeed: 102, shelters: [] },
  { id: "roof-and-window", name: "02 · 屋檐与窗口", lesson: "浅蓝掩体能挡子弹，也会挡自己的光束。到两座掩体中间找射击窗口。", formation: [[140, 220, 300, 380, 460]], top: 102, gap: 48, motion: "patrol", amplitude: 40, pace: 0.6, volley: "straight", interval: 3.2, bulletSpeed: 106, shelters: [[175, 90, 5], [425, 90, 5]] },
  { id: "two-heights", name: "03 · 上下两层", lesson: "先清掉前排，后排才会露出来。离开橙色弹道后，再停下来瞄准。", formation: [[210, 300, 390], [210, 300, 390]], top: 72, gap: 66, motion: "bob", amplitude: 44, pace: 0.64, volley: "aim", interval: 3.3, bulletSpeed: 110, shelters: [[115, 72, 4], [485, 72, 4]] },
  { id: "passing-rows", name: "04 · 交错的队列", lesson: "两排向相反方向移动。不要追着每一台跑，守住一个窗口等它经过。", formation: [[170, 300, 430], [170, 300, 430]], top: 74, gap: 70, motion: "opposed", amplitude: 62, pace: 0.66, volley: "pair", interval: 3.9, bulletSpeed: 109, shelters: [[300, 98, 6]] },
  { id: "double-core", name: "05 · 双芯机器人", lesson: "有两枚亮点的机器人需要命中两次。先看核心数量，再决定停留多久。", formation: [[180, 300, 420], [135, 245, 355, 465]], top: 78, gap: 64, motion: "patrol", amplitude: 32, pace: 0.82, volley: "straight", interval: 2.8, bulletSpeed: 117, shelters: [[175, 74, 4], [425, 74, 4]], armored: [0, 1, 2] },
  { id: "open-fan", name: "06 · 扇形信号", lesson: "扇形反击会分成三束。先观察间隔，横移到空处，别一直贴住边缘。", formation: [[175, 255, 335, 415], [175, 255, 335, 415]], top: 72, gap: 60, motion: "bob", amplitude: 48, pace: 0.66, volley: "fan", interval: 4.2, bulletSpeed: 112, shelters: [[120, 62, 5], [300, 62, 5], [480, 62, 5]] },
  { id: "wide-watch", name: "07 · 两翼巡航", lesson: "两翼留下宽阔中路。掩体耐久有限，及时换到仍完整的一侧。", formation: [[115, 195, 405, 485], [115, 195, 405, 485]], top: 76, gap: 68, motion: "opposed", amplitude: 34, pace: 0.83, volley: "pair", interval: 3.5, bulletSpeed: 119, shelters: [[150, 100, 3], [450, 100, 3]], armored: [1, 2] },
  { id: "diamond-window", name: "08 · 菱形窗口", lesson: "菱形编队会缓缓起伏。先打开下方出口，再瞄准侧翼与顶部。", formation: [[300], [205, 300, 395], [150, 225, 300, 375, 450]], top: 65, gap: 50, motion: "weave", amplitude: 42, pace: 0.72, volley: "aim", interval: 2.7, bulletSpeed: 124, shelters: [[100, 60, 5], [500, 60, 5]], armored: [0, 2] },
  { id: "three-windows", name: "09 · 三扇小窗", lesson: "中间三座掩体把射线分成窗口。你也能主动打穿掩体，但会失去保护。", formation: [[140, 220, 300, 380, 460], [140, 220, 300, 380, 460]], top: 72, gap: 66, motion: "patrol", amplitude: 50, pace: 0.9, volley: "fan", interval: 3.8, bulletSpeed: 122, shelters: [[190, 64, 4], [300, 64, 4], [410, 64, 4]], armored: [0, 2, 4] },
  { id: "staggered-echo", name: "10 · 错位回声", lesson: "错位队列有两种高度，反击也来自两侧。提前选好下一处空位再开火。", formation: [[145, 245, 345, 445], [195, 295, 395], [210, 300, 390]], top: 58, gap: 56, motion: "opposed", amplitude: 52, pace: 0.8, volley: "pair", interval: 3.2, bulletSpeed: 129, shelters: [[120, 70, 5], [355, 90, 5]], armored: [0, 3, 5] },
  { id: "quiet-comet", name: "11 · 彗星弧线", lesson: "弧形队列会横移和起伏。先照顾近处弹道，射击可以稍等，护盾更重要。", formation: [[155, 230, 305, 380, 455], [195, 270, 345, 420], [270, 345]], top: 60, gap: 54, motion: "weave", amplitude: 45, pace: 0.95, volley: "fan", interval: 3.3, bulletSpeed: 126, shelters: [[175, 90, 4], [450, 70, 4]], armored: [0, 2, 4, 9] },
  { id: "home-gate", name: "12 · 守住归途", lesson: "三排双向巡航，双芯目标和双束反击。用短横移留出余地，一台一台清空星门。", formation: [[165, 255, 345, 435], [165, 255, 345, 435], [165, 255, 345, 435]], top: 58, gap: 56, motion: "opposed", amplitude: 62, pace: 0.87, volley: "pair", interval: 2.8, bulletSpeed: 132, shelters: [[120, 70, 4], [300, 70, 4], [480, 70, 4]], armored: [0, 1, 2, 3, 6] },
];
export type SentryState = {
  level: number; phase: SentryPhase; x: number; shields: number; elapsed: number; invulnerable: number;
  robots: SentryRobot[]; shelters: SentryShelter[]; shots: SentryShot[]; warnings: SentryWarning[];
  autoFire: boolean; fireCooldown: number; volleyCooldown: number; volleyCount: number;
  nextShot: number; fired: number; hits: number; reason: string;
};
export const emptySentryInput = (): SentryInput => ({ left: false, right: false, fire: false });
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function createStarSentry(level: number): SentryState {
  const index = Number.isInteger(level) ? clamp(level, 0, starSentryLevels.length - 1) : 0;
  const stage = starSentryLevels[index];
  const robots: SentryRobot[] = [];
  stage.formation.forEach((row, r) => row.forEach(x => {
    const id = robots.length, y = stage.top + r * stage.gap;
    robots.push({ id, homeX: x, homeY: y, x, y, row: r, hp: stage.armored?.includes(id) ? 2 : 1 });
  }));
  return { level: index, phase: "ready", x: 300, shields: 3, elapsed: 0, invulnerable: 0,
    robots, shelters: stage.shelters.map(([x, width, hp], id) => ({ id, x, width, hp, maxHp: hp, y: 314 })),
    shots: [], warnings: [], autoFire: false, fireCooldown: 0, volleyCooldown: stage.interval,
    volleyCount: 0, nextShot: 0, fired: 0, hits: 0, reason: "" };
}
export const startStarSentry = (state: SentryState): SentryState => state.phase === "ready" ? { ...state, phase: "playing" } : state;
export const toggleSentryAuto = (state: SentryState): SentryState => state.phase === "playing" ? { ...state, autoFire: !state.autoFire } : state;
export function sentryGuidance(state: SentryState): string {
  if (state.phase === "won" || state.phase === "lost") return state.reason;
  if (state.phase === "ready") return `${starSentryLevels[state.level].lesson} 按开始守望后才会移动。`;
  if (state.shields === 1) return "还剩一格护盾。橙色圈提前预告反击；短横移躲开弹道，再重新瞄准。没有倒计时，随时可暂停。";
  return starSentryLevels[state.level].lesson;
}
function robotPosition(robot: SentryRobot, stage: SentryLevel, elapsed: number) {
  const phase = elapsed * stage.pace;
  const sign = stage.motion === "opposed" && robot.row % 2 === 1 ? -1 : 1;
  const x = robot.homeX + Math.sin(phase + (stage.motion === "weave" ? robot.row * 0.8 : 0)) * stage.amplitude * sign;
  const y = robot.homeY + (stage.motion === "bob" || stage.motion === "weave" ? Math.sin(phase * 1.3 + robot.row) * 10 : 0);
  return { ...robot, x, y };
}
/** A delayed frame advances at most 50 ms, split into <= 1/120 s steps.
 * There is no backlog, descending deadline, growing wave or unbounded projectile list. */
export function stepStarSentry(state: SentryState, input: SentryInput, seconds: number): SentryState {
  if (state.phase !== "playing" || !Number.isFinite(seconds) || seconds <= 0) return state;
  const duration = Math.min(seconds, 0.05), steps = Math.ceil(duration * 120), dt = duration / steps;
  let next = state;
  for (let i = 0; i < steps && next.phase === "playing"; i++) next = step(next, input, dt);
  return next;
}
function step(state: SentryState, input: SentryInput, dt: number): SentryState {
  const stage = starSentryLevels[state.level], elapsed = state.elapsed + dt;
  const next: SentryState = { ...state, elapsed,
    x: clamp(state.x + (Number(input.right) - Number(input.left)) * SENTRY_WORLD.shipSpeed * dt, 26, 574),
    invulnerable: Math.max(0, state.invulnerable - dt), fireCooldown: state.fireCooldown - dt,
    volleyCooldown: state.volleyCooldown - dt,
    robots: state.robots.map(robot => robotPosition(robot, stage, elapsed)),
    shelters: state.shelters.map(shelter => ({ ...shelter })), shots: state.shots.map(shot => ({ ...shot })),
    warnings: state.warnings.map(warning => ({ ...warning, countdown: warning.countdown - dt })),
  };
  const addShot = (side: SentryShot["side"], x: number, y: number, vx: number, vy: number) => {
    if (next.shots.length < SENTRY_WORLD.maxShots) next.shots.push({ id: next.nextShot++, side, x, y, vx, vy });
  };
  if ((input.fire || next.autoFire) && next.fireCooldown <= 0) {
    addShot("ship", next.x, SENTRY_WORLD.shipY - 24, 0, -SENTRY_WORLD.shotSpeed);
    next.fireCooldown = 0.27; next.fired++;
  }
  if (next.volleyCooldown <= 0 && next.robots.length) {
    // Prefer exposed lower robots; cycle shooters so the attack does not silently home.
    const front = next.robots.filter(robot => !next.robots.some(other => other.y > robot.y + 15 && Math.abs(other.x - robot.x) < 30));
    const shooters = [...front].sort((a, b) => Math.abs(a.x - next.x) - Math.abs(b.x - next.x));
    const first = shooters[next.volleyCount % shooters.length];
    const selected = stage.volley === "pair" && shooters.length > 1 ? [first, shooters[(next.volleyCount + Math.ceil(shooters.length / 2)) % shooters.length]] : [first];
    next.warnings.push(...selected.map(robot => ({ robotId: robot.id, target: next.x, countdown: 0.8 })));
    next.volleyCooldown = stage.interval; next.volleyCount++;
  }
  for (const warning of next.warnings.filter(warning => warning.countdown <= 0)) {
    const robot = next.robots.find(robot => robot.id === warning.robotId);
    if (!robot) continue;
    const vx = stage.volley === "straight" ? 0 : clamp((warning.target - robot.x) / ((SENTRY_WORLD.shipY - robot.y) / stage.bulletSpeed), -65, 65);
    const spread = stage.volley === "fan" ? [-36, 0, 36] : [0];
    for (const offset of spread) addShot("robot", robot.x, robot.y + 22, vx + offset, stage.bulletSpeed);
  }
  next.warnings = next.warnings.filter(warning => warning.countdown > 0 && next.robots.some(robot => robot.id === warning.robotId));
  const remaining: SentryShot[] = [];
  for (const shot of next.shots) {
    shot.x += shot.vx * dt; shot.y += shot.vy * dt;
    if (shot.x < -12 || shot.x > 612 || shot.y < -14 || shot.y > 454) continue;
    const shelter = next.shelters.find(shelter => shelter.hp > 0 && Math.abs(shot.x - shelter.x) < shelter.width / 2 + 4 && Math.abs(shot.y - shelter.y) < 14);
    if (shelter) { shelter.hp--; continue; }
    if (shot.side === "ship") {
      const robot = next.robots.find(robot => robot.hp > 0 && Math.abs(shot.x - robot.x) < 22 && Math.abs(shot.y - robot.y) < 19);
      if (robot) { robot.hp--; next.hits++; continue; }
    } else if (Math.abs(shot.x - next.x) < 21 && Math.abs(shot.y - SENTRY_WORLD.shipY) < 18) {
      if (next.invulnerable <= 0) { next.shields--; next.invulnerable = 1.15; }
      continue;
    }
    remaining.push(shot);
  }
  next.shots = remaining;
  next.robots = next.robots.filter(robot => robot.hp > 0);
  next.warnings = next.warnings.filter(warning => next.robots.some(robot => robot.id === warning.robotId));
  if (next.shields <= 0) { next.phase = "lost"; next.reason = "护盾用完了。观察橙色预告，横移让开弹道；重试次数不限。"; }
  else if (!next.robots.length) { next.phase = "won"; next.reason = "星门已清空！所有机器人都已被你的光束解除，归途恢复宁静。"; }
  if (next.phase !== "playing") { next.autoFire = false; next.shots = []; next.warnings = []; }
  return next;
}
