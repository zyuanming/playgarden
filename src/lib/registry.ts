import { lazy } from "react";
import type { GameId } from "./types";
export const games = [
  {
    id: "light" as GameId,
    title: "光线实验室",
    subtitle: "调整镜子与光路，让光线点亮目标吧。",
    category: "逻辑思维",
    difficulty: "初级",
    tone: "green",
    image: 0,
    component: lazy(() => import("../games/LightLab")),
  },
  {
    id: "robot" as GameId,
    title: "机器人路线",
    subtitle: "编写指令，带领小机器人抵达终点。",
    category: "编程启蒙",
    difficulty: "初级",
    tone: "purple",
    image: 1,
    component: lazy(() => import("../games/RobotRoutes")),
  },
  {
    id: "bridge" as GameId,
    title: "积木桥梁",
    subtitle: "旋转积木连接桥面，让小旗帜重逢。",
    category: "空间想象",
    difficulty: "中级",
    tone: "orange",
    image: 2,
    component: lazy(() => import("../games/BridgeBlocks")),
  },
];
