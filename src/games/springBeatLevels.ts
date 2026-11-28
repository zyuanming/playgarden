// SPDX-License-Identifier: GPL-3.0-only
import type { SpringBoard } from "./springBeatLogic";

export const springBeatLevels: readonly SpringBoard[] = [
  {"id":"spring-beat-01","title":"松手等一拍","start":[1,0],"stock":[0,0],"beats":1,"gates":[],"goal":[0,-1]},
  {"id":"spring-beat-02","title":"向右轻推","start":[0,0],"stock":[1,1],"beats":1,"gates":[],"goal":[1,0]},
  {"id":"spring-beat-03","title":"经过中心还没停","start":[1,0],"stock":[1,1],"beats":2,"gates":[],"goal":[0,0]},
  {"id":"spring-beat-04","title":"在第一拍通过","start":[0,0],"stock":[1,2],"beats":3,"gates":[[1,1,1]],"goal":[0,0]},
  {"id":"spring-beat-05","title":"把推力留到后面","start":[1,1],"stock":[1,1],"beats":4,"gates":[[2,-1,-1]],"goal":[2,0]},
  {"id":"spring-beat-06","title":"不止一条路线","start":[-1,1],"stock":[2,1],"beats":4,"gates":[[2,1,2]],"goal":[-2,0]},
  {"id":"spring-beat-07","title":"右侧窗口","start":[-2,-1],"stock":[1,2],"beats":5,"gates":[[2,1,2]],"goal":[0,2]},
  {"id":"spring-beat-08","title":"两道窗口","start":[-2,-1],"stock":[2,2],"beats":5,"gates":[[2,0,1],[4,0,0]],"goal":[-2,0]},
  {"id":"spring-beat-09","title":"错拍要重来","start":[-1,1],"stock":[2,2],"beats":6,"gates":[[4,-3,-2]],"goal":[2,1]},
  {"id":"spring-beat-10","title":"预留反向推力","start":[-2,1],"stock":[2,2],"beats":6,"gates":[[3,-3,-2],[4,-4,-3]],"goal":[2,-1]},
  {"id":"spring-beat-11","title":"越过后回头","start":[2,0],"stock":[2,2],"beats":7,"gates":[[4,0,1],[5,0,1]],"goal":[-1,2]},
  {"id":"spring-beat-12","title":"最后一拍停稳","start":[-1,-1],"stock":[2,2],"beats":8,"gates":[[3,0,0],[5,-2,-1],[7,0,1]],"goal":[0,0]},
];
