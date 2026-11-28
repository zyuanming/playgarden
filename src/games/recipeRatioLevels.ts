// SPDX-License-Identifier: GPL-3.0-only
import type { RecipeBoard } from "./recipeRatioLogic";
export const recipeRatioLevels: RecipeBoard[] = [
  {"id":"recipe-ratio-01","title":"一勺有几格","scoopUnits":3,"stock":[5,10],"orders":[{"topUp":[0,0],"ratio":[1,2],"volumes":[3]}]},
  {"id":"recipe-ratio-02","title":"两倍配方","scoopUnits":4,"stock":[15,5],"orders":[{"topUp":[0,0],"ratio":[3,1],"volumes":[8]}]},
  {"id":"recipe-ratio-03","title":"杯里先有两格","scoopUnits":4,"stock":[5,15],"orders":[{"topUp":[2,0],"ratio":[1,1],"volumes":[6]}]},
  {"id":"recipe-ratio-04","title":"两杯同芯","scoopUnits":6,"stock":[8,14],"orders":[{"topUp":[3,0],"ratio":[5,4],"volumes":[9,27]},{"topUp":[5,1],"ratio":[1,1],"volumes":[12,18]}]},
  {"id":"recipe-ratio-05","title":"一勺还不够","scoopUnits":6,"stock":[18,10],"orders":[{"topUp":[0,6],"ratio":[1,2],"volumes":[12,18]},{"topUp":[2,4],"ratio":[7,5],"volumes":[12,18,24]}]},
  {"id":"recipe-ratio-06","title":"加料找平衡","scoopUnits":6,"stock":[14,14],"orders":[{"topUp":[0,6],"ratio":[1,2],"volumes":[12,18,30]},{"topUp":[6,0],"ratio":[2,1],"volumes":[12,18,30]}]},
  {"id":"recipe-ratio-07","title":"两杯一起算","scoopUnits":4,"stock":[6,12],"orders":[{"topUp":[4,0],"ratio":[1,1],"volumes":[8,12,16]},{"topUp":[1,3],"ratio":[1,3],"volumes":[12,20]}]},
  {"id":"recipe-ratio-08","title":"三色合订","scoopUnits":6,"stock":[6,10,14],"orders":[{"topUp":[3,0,3],"ratio":[1,1,2],"volumes":[12,24]},{"topUp":[0,0,0],"ratio":[1,2,3],"volumes":[6,12]}]},
  {"id":"recipe-ratio-09","title":"少一格也不行","scoopUnits":6,"stock":[11,5,7],"orders":[{"topUp":[0,0,0],"ratio":[3,1,2],"volumes":[12,18]},{"topUp":[0,4,2],"ratio":[3,5,4],"volumes":[12,18,24]}]},
  {"id":"recipe-ratio-10","title":"同样四勺","scoopUnits":6,"stock":[10,6,14],"orders":[{"topUp":[5,1,0],"ratio":[7,2,3],"volumes":[12,24]},{"topUp":[0,1,5],"ratio":[3,2,7],"volumes":[12,24]}]},
  {"id":"recipe-ratio-11","title":"三杯共一罐","scoopUnits":6,"stock":[11,29,20],"orders":[{"topUp":[2,0,1],"ratio":[2,4,3],"volumes":[9,21,27]},{"topUp":[1,1,4],"ratio":[2,5,5],"volumes":[12,24]},{"topUp":[1,0,5],"ratio":[1,2,3],"volumes":[12,18,30]}]},
  {"id":"recipe-ratio-12","title":"三杯差一格","scoopUnits":6,"stock":[21,14,8],"orders":[{"topUp":[5,0,1],"ratio":[7,3,2],"volumes":[12,18,24]},{"topUp":[5,0,1],"ratio":[7,3,2],"volumes":[12,24]},{"topUp":[0,5,1],"ratio":[3,7,2],"volumes":[12,24,30]}]},
];
