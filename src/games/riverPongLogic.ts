// SPDX-License-Identifier: GPL-3.0-only
export const riverPongLevels = [
  {
    title: "接住第一球",
    target: 1,
    speed: 220,
    aiSpeed: 55,
    playerWidth: 108,
    aiWidth: 76,
    lesson: "横向移动下方球拍。碰到靠边的位置，球会斜着反弹。",
  },
  {
    title: "两次好落点",
    target: 2,
    speed: 235,
    aiSpeed: 65,
    playerWidth: 106,
    aiWidth: 78,
    lesson: "让球从拍面两侧弹出，给对面的球拍制造一点变化。",
  },
  {
    title: "借一面墙",
    target: 2,
    speed: 245,
    aiSpeed: 75,
    playerWidth: 102,
    aiWidth: 76,
    lesson: "边墙会反射横向速度。提前想一想球碰墙后的落点。",
  },
  {
    title: "三球小局",
    target: 3,
    speed: 250,
    aiSpeed: 80,
    playerWidth: 102,
    aiWidth: 80,
    lesson: "每一分之后都由你再次发球，可以先摆好球拍位置。",
  },
  {
    title: "窄拍练习",
    target: 3,
    speed: 250,
    aiSpeed: 85,
    playerWidth: 92,
    aiWidth: 78,
    lesson: "球拍稍窄了。观察球的方向，提早移动到它将要到达的位置。",
  },
  {
    title: "轻快的来回",
    target: 3,
    speed: 275,
    aiSpeed: 90,
    playerWidth: 98,
    aiWidth: 80,
    lesson: "用拍面边缘改变方向，但也要先保证能接到球。",
  },
  {
    title: "四分河湾",
    target: 4,
    speed: 280,
    aiSpeed: 100,
    playerWidth: 98,
    aiWidth: 80,
    lesson: "对面的球拍会追着球移动，速度有限。斜线与墙面能帮你打开空隙。",
  },
  {
    title: "河畔决胜局",
    target: 5,
    speed: 295,
    aiSpeed: 105,
    playerWidth: 100,
    aiWidth: 78,
    lesson:
      "先拿五分的一方获胜。暂停随时可用；每分后由你决定什么时候继续发球。",
  },
];
export type PongLevel = (typeof riverPongLevels)[number];
export type PongState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  paddle: number;
  ai: number;
  playerScore: number;
  aiScore: number;
  phase: "ready" | "play" | "between" | "won" | "lost";
  last: "player" | "ai" | null;
};
export const initialPong = (): PongState => ({
  x: 180,
  y: 230,
  vx: 0,
  vy: 0,
  paddle: 180,
  ai: 180,
  playerScore: 0,
  aiScore: 0,
  phase: "ready",
  last: null,
});
export const clampPaddle = (x: number, width: number) =>
  Math.max(width / 2, Math.min(360 - width / 2, x));
export function servePong(level: PongLevel, s: PongState): PongState {
  if (s.phase !== "ready" && s.phase !== "between") return s;
  const vx = (s.playerScore + s.aiScore) % 2 ? -85 : 85;
  return {
    ...s,
    x: 180,
    y: 230,
    vx,
    vy: Math.sqrt(level.speed ** 2 - vx ** 2),
    phase: "play",
    last: null,
  };
}
export function pongStep(
  level: PongLevel,
  s: PongState,
  seconds: number,
): PongState {
  if (s.phase !== "play") return s;
  const dt = Math.min(0.035, Math.max(0, seconds));
  let { x, y, vx, vy } = s;
  const desired = clampPaddle(x, level.aiWidth),
    ai = clampPaddle(
      s.ai +
        Math.sign(desired - s.ai) *
          Math.min(Math.abs(desired - s.ai), level.aiSpeed * dt),
      level.aiWidth,
    );
  const oldY = y;
  x += vx * dt;
  y += vy * dt;
  if (x < 6) {
    x = 12 - x;
    vx = Math.abs(vx);
  } else if (x > 354) {
    x = 708 - x;
    vx = -Math.abs(vx);
  }
  const bounce = (center: number, width: number, up: boolean) => {
    const ratio = Math.max(-0.94, Math.min(0.94, (x - center) / (width / 2))),
      angle = (ratio * Math.PI) / 3,
      speed = level.speed;
    vx = Math.sin(angle) * speed;
    vy = (up ? -1 : 1) * Math.cos(angle) * speed;
  };
  if (
    vy > 0 &&
    oldY <= 413 &&
    y >= 413 &&
    Math.abs(x - s.paddle) <= level.playerWidth / 2 + 6
  ) {
    y = 413;
    bounce(s.paddle, level.playerWidth, true);
  } else if (
    vy < 0 &&
    oldY >= 47 &&
    y <= 47 &&
    Math.abs(x - ai) <= level.aiWidth / 2 + 6
  ) {
    y = 47;
    bounce(ai, level.aiWidth, false);
  }
  if (y < -8 || y > 468) {
    const player = y < -8,
      playerScore = s.playerScore + (player ? 1 : 0),
      aiScore = s.aiScore + (player ? 0 : 1);
    return {
      ...s,
      x: 180,
      y: 230,
      vx: 0,
      vy: 0,
      ai,
      playerScore,
      aiScore,
      last: player ? "player" : "ai",
      phase:
        playerScore >= level.target
          ? "won"
          : aiScore >= level.target
            ? "lost"
            : "between",
    };
  }
  return { ...s, x, y, vx, vy, ai };
}
