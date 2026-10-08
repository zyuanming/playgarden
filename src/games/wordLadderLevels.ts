// SPDX-License-Identifier: GPL-3.0-only
// Original finite wordbooks and lesson design. Glosses are concise authored cues,
// not dictionary definitions. No external word list or dictionary is bundled.
export type LadderWord = { word: string; gloss: string };
export type WordLadderLevel = {
  id: string;
  title: string;
  lesson: string;
  start: string;
  target: string;
  book: readonly LadderWord[];
};

const words = (source: string): LadderWord[] => source.split(" ").map(entry => {
  const [word, gloss] = entry.split(":");
  return { word, gloss };
}).sort((a, b) => a.word.localeCompare(b.word, "en"));

export const wordLadderLevels: readonly WordLadderLevel[] = [
  {
    id: "wl-01-cat-dog", title: "猫咪去串门", start: "CAT", target: "DOG",
    lesson: "换一个字母，走过一块踏脚石。通往小狗的路不止一条。",
    book: words("CAT:猫 COT:小床 COG:齿轮齿 DOT:小点 DOG:狗 BAT:蝙蝠"),
  },
  {
    id: "wl-02-hat-pig", title: "帽子里的转弯", start: "HAT", target: "PIG",
    lesson: "中间的元音也能换；先比较字母位置，再选择落脚处。",
    book: words("HAT:帽子 HIT:击中 PIT:小坑 PIG:猪 PAT:轻拍 HOT:热的 POT:锅 CAT:猫 COT:小床 CUT:切开"),
  },
  {
    id: "wl-03-pen-cat", title: "两条小支流", start: "PEN", target: "CAT",
    lesson: "从同一个词出发，试试经由 PET 或 PAN 的两种路线。",
    book: words("PEN:钢笔 PET:宠物 PAT:轻拍 CAT:猫 PAN:平底锅 CAN:罐头 TEN:十 TAN:棕褐色 PIT:小坑"),
  },
  {
    id: "wl-04-dog-sun", title: "追着阳光走", start: "DOG", target: "SUN",
    lesson: "有些词是汇合点。绕了路也没关系，可以撤销再比较。",
    book: words("DOG:狗 LOG:木头 LUG:用力拖 BUG:小虫 BUN:小圆面包 SUN:太阳 HOG:大猪 HUG:拥抱 DOT:小点 POT:锅 HOT:热的"),
  },
  {
    id: "wl-05-cold-warm", title: "给冬天加点暖", start: "COLD", target: "WARM",
    lesson: "四个字母仍然每次只换一个。CARD 和 WORD 都能搭桥。",
    book: words("COLD:冷的 CORD:绳子 CARD:卡片 WARD:病房 WARM:温暖 WORD:单词 GOLD:金子 BOLD:大胆 BARD:诗人"),
  },
  {
    id: "wl-06-head-tail", title: "从头说到尾", start: "HEAD", target: "TAIL",
    lesson: "先找连通两边的桥梁。看起来接近终点的词，未必更省步。",
    book: words("HEAD:头 HEAL:愈合 TEAL:蓝绿色 TELL:告诉 TALL:高的 TAIL:尾巴 HEAT:热量 SEAT:座位 SEAL:海豹 TALK:交谈 WALK:步行"),
  },
  {
    id: "wl-07-book-read", title: "翻开一本书", start: "BOOK", target: "READ",
    lesson: "往回换字母也是合法一步。留意短桥和长长的环路。",
    book: words("BOOK:书 BOOT:靴子 BOAT:小船 BEAT:敲击 BEAD:珠子 READ:阅读 COOK:烹饪 COOL:凉爽 COAL:煤 COAT:外套 LOOK:看 LOCK:锁 ROCK:岩石 SOCK:袜子"),
  },
  {
    id: "wl-08-fish-sand", title: "游向沙滩", start: "FISH", target: "SAND",
    lesson: "两条长路线会在 CASE 汇合。每一个中间词都必须在词本里。",
    book: words("FISH:鱼 DISH:盘子 DASH:冲刺 CASH:现金 CASE:盒子 CANE:手杖 SANE:理智的 SAND:沙子 FIST:拳头 FAST:快的 LAST:最后 CAST:投掷 LASH:鞭打"),
  },
  {
    id: "wl-09-moon-star", title: "月亮拜访星星", start: "MOON", target: "STAR",
    lesson: "岔路不代表失败。若走到只剩回头的角落，撤销或换回旧词。",
    book: words("MOON:月亮 MOAN:低声抱怨 MOAT:护城河 BOAT:小船 BEAT:敲击 BEAR:熊 SEAR:煎焦表面 STAR:星星 SOON:很快 NOON:中午 TEAR:眼泪 NEAR:附近 BOAR:野猪"),
  },
  {
    id: "wl-10-love-hate", title: "词义反方向", start: "LOVE", target: "HATE",
    lesson: "这里按拼写连路，不按词义连路。每种合法路线都能过关。",
    book: words("LOVE:喜爱 MOVE:移动 MORE:更多 CORE:核心 CARE:关心 HARE:野兔 HATE:讨厌 COVE:小海湾 CAVE:洞穴 HAVE:拥有 LIVE:居住 GIVE:给予 GAVE:给过"),
  },
  {
    id: "wl-11-east-west", title: "东西之间的桥", start: "EAST", target: "WEST",
    lesson: "找找哪一个词把两群邻居连起来。新词未必更远，旧词也不一定错。",
    book: words("EAST:东 FAST:快的 LAST:最后 VAST:辽阔 VEST:背心 WEST:西 BEST:最好的 REST:休息 TEST:测试 NEST:鸟巢 NEXT:下一个 TEXT:文字"),
  },
  {
    id: "wl-12-goat-wolf", title: "穿过词语森林", start: "GOAT", target: "WOLF",
    lesson: "把长旅程分成几段：先过桥，再换方向，最后走向森林里的狼。",
    book: words("GOAT:山羊 COAT:外套 COAL:煤 COOL:凉爽 WOOL:羊毛 WOOD:木材 GOOD:好的 GOLD:金子 GOLF:高尔夫 WOLF:狼 BOAT:小船 BOOT:靴子 BOOK:书 COOK:烹饪 WORD:单词 CORD:绳子 COLD:冷的 FOOD:食物 FOOL:傻瓜"),
  },
];
