// SPDX-License-Identifier: GPL-3.0-only
type Mode = { plots: number[]; cost: number };
type Valve = { tank: number; modes: Mode[] };
export type IrrigationLevel = {
  id: string;
  width: number;
  height: number;
  needs: number[];
  caps: number[];
  valves: Valve[];
  solution: number[];
};
export const tankNames = ["Ⅰ", "Ⅱ"];
export const modeNames = ["关闭", "窄喷", "宽喷"];
export const plotName = (i: number) => String.fromCharCode(65 + i);
const pack = [
  ["2×1", "11", "4", "I(A:2) I(B:2)", "11"],
  ["3×1", "111", "4", "I(A:2,AB:3) I(C:1,BC:3)", "21"],
  [
    "3×2",
    "121111",
    "10",
    "I(C:1,BC:2) I(F:3,EF:5) I(AB:4,ABC:5) I(DE:3,DEF:4)",
    "2012",
  ],
  [
    "3×2",
    "221111",
    "9",
    "I(DE:2,ADE:3) I(F:3,EF:5) I(B:1,BC:3) I(AB:2,ABD:3) I(C:2,CF:3)",
    "20112",
  ],
  [
    "3×2",
    "121221",
    "12",
    "I(BE:3,ABE:5) I(C:1,CF:2) I(BE:2,BDE:3) I(F:2,EF:3) I(D:2,DE:4)",
    "22201",
  ],
  [
    "3×2",
    "211111",
    "5/4",
    "I(A:2,AB:4) II(AB:4,ABE:5) I(C:2,BC:4) II(AD:2,ADE:4) I(CF:2,BCF:3)",
    "10022",
  ],
  [
    "3×2",
    "121221",
    "5/5",
    "I(F:1,EF:2) II(BC:2,BCF:3) I(DE:2,ADE:3) II(F:1,EF:3) I(AD:2,ABD:3)",
    "01122",
  ],
  [
    "3×2",
    "122211",
    "4/10",
    "I(B:1,BE:2) II(BC:2,BCE:3) I(CF:3,CEF:5) II(D:3,DE:5) I(EF:3,CEF:5) II(A:2,AD:4)",
    "121102",
  ],
  [
    "3×2",
    "221211",
    "5/7",
    "I(EF:2,DEF:4) II(AD:3,ADE:5) I(BC:4,BCF:5) II(AD:2,ABD:4) I(AD:3,ABD:4) II(BC:3,ABC:5)",
    "100211",
  ],
  [
    "3×2",
    "121331",
    "8/8",
    "I(DE:2,BDE:3) II(E:2,DE:4) I(F:1,CF:2) II(AD:3,ABD:5) I(A:3,AD:4) II(BC:2,BCE:4)",
    "221022",
  ],
  [
    "3×2",
    "112122",
    "7/8",
    "I(DE:2,ADE:4) II(DE:2,ADE:4) I(BE:3,BCE:5) II(CF:4,BCF:5) I(EF:3,DEF:4) II(EF:4,BEF:6) I(AD:2,ABD:4)",
    "0021011",
  ],
  [
    "3×2",
    "132132",
    "9/10",
    "I(DE:2,DEF:4) II(B:2,BC:4) I(EF:3,CEF:4) II(B:3,BE:5) I(C:3,CF:4) II(AB:3,ABC:5) I(B:1,AB:3)",
    "2022021",
  ],
  ["3×2","211132","19","I(CF:4,CEF:6) I(AD:1,ABD:2) I(B:4,AB:6) I(AD:1,ADE:3) I(EF:2,CEF:4)","20221"], // 13
  ["3×2","222121","18","I(AD:3,ADE:5) I(A:2,AB:4) I(B:2,BC:4) I(BC:4,BCE:5) I(BC:2,BCF:4)","21022"], // 14
  ["3×2","113113","15","I(CF:1,BCF:2) I(E:3,BE:5) I(F:2,CF:3) I(EF:3,CEF:4) I(AB:3,ABD:5)","10222"], // 15
  ["3×2","121111","9","I(BC:2,BCF:3) I(DE:3,DEF:5) I(F:1,EF:2) I(AD:2,ABD:3)","1022"], // 16
  ["3×2","111121","9","I(D:2,AD:3) I(B:4,BC:6) I(CF:1,CEF:3) I(BE:1,BEF:3) I(D:3,DE:5)","20210"], // 17
  ["3×2","111122","16","I(F:2,EF:4) I(D:4,AD:5) I(F:1,EF:2) I(AB:1,ABD:3) I(BC:3,BCF:4)","22201"], // 18
  ["3×2","122122","15","I(CF:2,CEF:4) I(C:1,BC:3) I(CF:2,CEF:3) I(B:2,AB:3) I(AD:2,ABD:4)","20212"], // 19
  ["3×2","211211","12","I(AD:2,ABD:4) I(BC:2,BCF:4) I(AB:3,ABC:4) I(DE:2,ADE:4)","1202"], // 20
  ["3×2","211131","14","I(B:2,BE:4) I(E:3,DE:4) I(AB:3,ABC:4) I(CF:1,CEF:2) I(AD:3,ADE:4)","01122"], // 21
  ["3×2","121122","16","I(C:2,BC:4) I(EF:4,CEF:6) I(AD:3,ABD:5) I(E:2,DE:4) I(EF:1,DEF:2)","21201"], // 22
  ["3×2","122211","20","I(F:4,CF:5) I(AD:4,ABD:6) I(D:4,DE:5) I(A:2,AB:3) I(BC:2,BCF:4)","22201"], // 23
  ["3×2","112113","18","I(D:1,AD:3) I(EF:4,DEF:5) I(D:1,DE:3) I(C:4,CF:6) I(CF:2,BCF:3)","21022"], // 24
  ["3×2","121222","17","I(DE:2,BDE:3) I(AB:4,ABD:6) I(D:1,AD:3) I(AD:4,ABD:6) I(C:4,CF:6) I(EF:3,DEF:5)","211021"], // 25
  ["3×2","111132","12","I(D:1,AD:2) I(AB:3,ABE:5) I(F:2,EF:3) I(CF:3,CEF:4) I(CF:2,CEF:3)","12202"], // 26
  ["3×2","111122","9","I(B:1,BC:2) I(F:1,EF:2) I(D:2,DE:3) I(BC:2,ABC:3) I(E:1,DE:2) I(F:2,EF:4)","020221"], // 27
  ["3×2","121112","12","I(AD:2,ABD:3) I(F:3,CF:5) I(E:4,DE:5) I(EF:4,CEF:5) I(CF:4,BCF:5) I(BE:3,BDE:5)","200120"], // 28
  ["3×2","113111","9","I(BC:2,ABC:3) I(EF:3,BEF:5) I(C:1,BC:2) I(AB:2,ABE:3) I(DE:2,ADE:4) I(C:2,CF:3)","201012"], // 29
  ["3×2","112221","9","I(BC:2,ABC:4) I(CF:4,CEF:5) I(B:1,AB:3) I(DE:1,ADE:3) I(AD:1,ABD:2) I(A:2,AD:4)","120110"], // 30
  ["3×2","122113","21","I(B:4,AB:5) I(E:4,DE:6) I(F:2,EF:3) I(F:2,CF:4) I(B:3,AB:4) I(BC:4,BCF:5)","021222"], // 31
  ["3×2","131211","12","I(DE:4,DEF:5) I(BC:3,BCF:5) I(AB:1,ABD:3) I(B:1,BE:3) I(E:4,DE:5)","21210"], // 32
  ["3×2","221221","10","I(AD:1,ABD:3) I(AB:2,ABE:3) I(D:2,DE:3) I(F:2,CF:4) I(BC:2,BCF:3)","12202"], // 33
  ["3×2","122111","10","I(AD:4,ABD:5) I(C:4,CF:6) I(BC:4,BCE:6) I(BE:2,BCE:3) I(BC:1,BCF:3)","10022"], // 34
  ["3×2","121122","12","I(EF:2,DEF:4) I(F:3,EF:5) I(AD:3,ABD:5) I(F:3,CF:4) I(AD:1,ABD:2) I(BC:3,ABC:5)","120021"], // 35
  ["3×2","122221","11","I(F:2,CF:4) I(DE:2,BDE:4) I(BC:1,BCE:2) I(E:4,EF:6) I(AD:1,ADE:3)","22201"], // 36
  ["3×2","211311","16","I(A:3,AD:5) I(D:3,DE:5) I(C:2,CF:3) I(BC:2,BCF:3) I(AD:3,ABD:4)","22021"], // 37
  ["3×2","131322","20","I(F:4,CF:5) I(BE:1,BDE:2) I(D:2,AD:3) I(F:4,EF:5) I(AD:4,ABD:5) I(BC:4,BCF:6)","021222"], // 38
  ["3×2","111222","14","I(F:3,CF:5) I(D:3,DE:5) I(D:1,DE:3) I(E:3,EF:4) I(AB:2,ABE:3) I(EF:2,BEF:4)","211021"], // 39
  ["3×2","222211","20","I(AB:4,ABC:6) I(EF:2,CEF:4) I(AD:4,ABD:6) I(E:1,EF:3) I(D:4,DE:5) I(C:3,BC:5)","222010"], // 40
  ["3×2","111122","6/11","I(C:1,CF:2) II(D:2,DE:4) I(F:3,EF:5) II(E:3,BE:5) I(BC:1,ABC:3) II(F:4,CF:5)","021121"], // 41
  ["3×2","212211","7/7","I(AD:1,ADE:2) II(AD:2,ADE:4) I(DE:2,DEF:4) II(E:2,DE:3) I(C:3,BC:4) II(AB:3,ABC:5)","012012"], // 42
  ["3×2","222211","10/8","I(AD:4,ABD:6) II(C:2,CF:3) I(E:4,DE:5) II(A:1,AB:3) I(C:4,CF:5) II(AD:2,ABD:3)","012222"], // 43
  ["3×2","131132","10/2","I(AB:3,ABD:5) II(F:3,EF:4) I(DE:1,BDE:3) II(E:1,EF:3) I(CF:2,BCF:4) II(EF:1,BEF:2)","102121"], // 44
  ["3×2","221112","10/5","I(AB:4,ABD:5) II(BC:4,ABC:5) I(F:4,EF:6) II(E:4,EF:6) I(AB:1,ABE:3) II(CF:3,CEF:5)","201012"], // 45
  ["3×2","221221","11/12","I(B:4,BC:6) II(DE:4,BDE:6) I(AD:2,ABD:4) II(B:2,AB:4) I(E:4,EF:5) II(AD:4,ABD:6)","210221"], // 46
  ["3×2","221222","11/8","I(AB:2,ABC:3) II(CF:4,CEF:5) I(A:4,AD:6) II(A:3,AB:5) I(BE:1,BDE:2) II(F:3,EF:5)","122021"], // 47
  ["3×2","312112","8/11","I(BC:4,ABC:6) II(EF:4,DEF:6) I(C:3,CF:4) II(A:1,AD:2) I(A:3,AD:5) II(AB:3,ABC:5)","012212"], // 48
  ["3×2","133121","7/14","I(DE:2,BDE:3) II(C:4,BC:5) I(A:4,AD:6) II(C:2,CF:3) I(E:4,EF:6) II(BC:3,ABC:5)","220212"], // 49
  ["3×2","111133","5/13","I(B:1,AB:2) II(D:3,AD:5) I(E:1,EF:3) II(E:4,EF:6) I(D:2,AD:3) II(CF:2,CEF:4)","212202"], // 50
  ["3×2","132221","5/4","I(E:1,BE:3) II(CF:1,BCF:2) I(AD:2,ADE:4) II(BC:1,ABC:3) I(DE:1,BDE:2) II(B:4,BC:5)","121120"], // 51
  ["3×2","233122","11/6","I(BC:4,ABC:6) II(CF:2,BCF:3) I(BE:4,BCE:6) II(DE:1,ADE:2) I(D:4,DE:6) II(CF:1,BCF:3)","221201"], // 52
  ["3×2","122123","9/10","I(BC:2,ABC:3) II(A:3,AB:4) I(DE:2,DEF:4) II(C:4,BC:5) I(F:1,EF:3) II(C:2,CF:3)","122022"], // 53
  ["3×2","112213","8/8","I(CF:1,BCF:2) II(A:4,AD:5) I(F:4,CF:5) II(CF:1,CEF:3) I(D:2,DE:4) II(C:4,CF:5)","221210"], // 54
  ["3×2","122111","7/13","I(D:4,DE:5) II(AD:1,ABD:2) I(B:3,BC:5) II(CF:4,BCF:5) I(B:1,BC:2) II(B:4,AB:6)","200122"], // 55
  ["3×2","211132","8/11","I(AB:3,ABC:4) II(D:1,DE:3) I(A:3,AD:4) II(CF:3,CEF:5) I(E:3,EF:5) II(A:2,AD:4)","120221"], // 56
  ["3×2","232211","6/12","I(BC:4,BCF:5) II(AB:3,ABD:4) I(DE:2,ADE:4) II(BC:4,BCF:6) I(CF:2,CEF:3) II(D:2,AD:3)","111202"], // 57
  ["3×2","221121","9/4","I(AB:3,ABC:5) II(E:4,DE:5) I(AD:2,ABD:3) II(EF:2,CEF:3) I(CF:1,CEF:3) II(B:3,BC:4)","112020"], // 58
  ["3×2","222231","5/10","I(D:1,AD:3) II(BE:3,ABE:5) I(D:4,DE:6) II(E:1,DE:3) I(C:1,CF:2) II(DE:3,ADE:4) I(BC:2,ABC:4)","1201221"], // 59
  ["3×2","132131","9/9","I(EF:4,CEF:5) II(A:4,AB:5) I(E:1,EF:2) II(CF:1,CEF:2) I(C:1,BC:3) II(D:2,DE:4) I(BE:4,BEF:5)","0212211"], // 60
  ["3×2","321111","5/8","I(AD:4,ADE:5) II(DE:3,ADE:5) I(F:1,CF:3) II(AB:3,ABC:5) I(D:4,DE:6) II(F:1,EF:3) I(A:1,AB:2)","0221002"], // 61
  ["3×2","221232","15/6","I(EF:4,CEF:5) II(AD:1,ABD:2) I(E:4,DE:6) II(EF:3,BEF:4) I(B:4,BE:5) II(BC:4,ABC:5) I(EF:2,DEF:3)","1100222"], // 62
  ["3×2","331211","8/9","I(B:4,AB:5) II(DE:3,ADE:4) I(D:3,AD:5) II(F:1,EF:3) I(B:1,BE:2) II(A:4,AB:5) I(CF:1,BCF:2)","0220122"], // 63
  ["3×2","221322","8/14","I(AD:4,ABD:6) II(A:3,AB:4) I(A:4,AD:6) II(CF:3,BCF:5) I(D:4,AD:6) II(E:4,DE:5) I(EF:2,DEF:4)","1202022"], // 64
  ["3×2","231131","10/13","I(DE:3,ADE:4) II(AB:4,ABD:5) I(B:2,BE:4) II(F:4,EF:6) I(C:4,BC:5) II(AB:3,ABD:5) I(B:2,BE:3)","1102112"], // 65
  ["3×2","221232","11/9","I(EF:1,CEF:3) II(CF:3,BCF:5) I(AB:1,ABC:2) II(BE:4,ABE:5) I(D:3,AD:4) II(BC:4,ABC:5) I(AD:4,ADE:6)","1111102"], // 66
  ["3×2","113113","5/8","I(D:1,AD:2) II(F:1,CF:2) I(E:2,DE:3) II(B:2,BC:3) I(CF:1,BCF:2) II(F:3,CF:5) I(BE:4,BEF:6)","2212110"], // 67
  ["3×2","212113","14/7","I(F:1,CF:3) II(D:4,AD:6) I(E:4,EF:6) II(F:1,EF:2) I(B:3,AB:5) II(C:1,CF:2) I(CF:4,CEF:6)","2201202"], // 68
  ["3×2","132111","4/7","I(B:4,AB:6) II(C:2,BC:3) I(AB:2,ABC:4) II(D:2,AD:3) I(BE:1,ABE:3) II(DE:2,BDE:4) I(F:1,CF:2)","0210022"], // 69
  ["3×2","331222","13/9","I(F:1,EF:3) II(B:2,BE:3) I(AB:3,ABE:4) II(A:4,AD:6) I(C:3,CF:5) II(F:1,CF:3) I(AD:2,ABD:3)","1222202"], // 70
  ["3×2","222123","12/7","I(E:3,EF:4) II(A:2,AB:4) I(C:1,CF:2) II(CF:4,BCF:5) I(A:4,AD:6) II(DE:2,DEF:3) I(B:1,AB:2)","2022112"], // 71
  ["3×2","112132","9/7","I(CF:4,CEF:5) II(C:2,BC:3) I(AD:3,ABD:4) II(CF:4,CEF:5) I(BE:3,BCE:5) II(DE:3,BDE:5) I(A:1,AD:3)","2001111"], // 72
  ["3×2","123212","12/6","I(BC:1,BCF:2) II(D:2,AD:4) I(A:3,AD:5) II(C:3,BC:5) I(EF:2,BEF:4) II(BC:4,BCF:5) I(CF:4,CEF:6)","1120111"], // 73
  ["3×2","132132","6/16","I(BE:1,ABE:3) II(E:4,EF:6) I(C:1,CF:2) II(B:3,BE:5) I(F:3,CF:4) II(CF:4,BCF:5) I(AD:3,ABD:5)","1122021"], // 74
  ["3×2","122122","5/8","I(C:2,CF:4) II(A:3,AD:4) I(EF:3,CEF:5) II(EF:3,CEF:5) I(C:2,BC:3) II(EF:1,BEF:2) I(B:1,BC:2)","0201212"], // 75
  ["3×2","322221","10/10","I(DE:1,ADE:2) II(CF:4,CEF:5) I(D:4,DE:6) II(C:3,BC:4) I(C:1,BC:3) II(BE:4,ABE:5) I(A:3,AD:5)","2100222"], // 76
  ["3×2","221132","11/6","I(AB:3,ABD:4) II(E:2,DE:4) I(D:2,AD:3) II(EF:4,BEF:5) I(EF:4,CEF:5) II(AD:2,ABD:4) I(E:1,BE:3)","1001212"], // 77
  ["3×2","122123","5/9","I(F:2,CF:3) II(B:3,BC:4) I(E:2,DE:3) II(EF:1,BEF:2) I(CF:1,CEF:2) II(EF:1,CEF:2) I(D:3,AD:4)","0102122"], // 78
  ["3×2","212121","10/6","I(A:2,AB:4) II(C:3,CF:5) I(A:3,AD:4) II(EF:1,BEF:2) I(E:3,BE:5) II(BE:4,BEF:5) I(C:1,BC:3)","1122101"], // 79
  ["3×2","122211","5/4","I(CF:4,BCF:5) II(BC:2,BCE:3) I(D:2,DE:3) II(CF:2,BCF:3) I(DE:1,BDE:3) II(A:4,AD:5) I(AD:1,ADE:3)","0101201"], // 80
  ["3×2","233312","12/8","I(B:2,BC:4) II(AD:1,ABD:2) I(AB:4,ABE:6) II(AD:2,ABD:4) I(DE:3,BDE:5) II(F:2,CF:4) I(BC:3,BCF:4)","2201122"], // 81
  ["3×2","331212","11/7","I(BE:3,ABE:4) II(A:1,AD:3) I(A:3,AB:5) II(D:3,AD:4) I(AB:1,ABD:3) II(F:1,EF:3) I(BC:4,BCF:6)","2201112"], // 82
  ["3×2","212323","8/10","I(E:2,EF:3) II(CF:4,CEF:5) I(AD:2,ABD:4) II(A:2,AD:3) I(BC:2,ABC:3) II(EF:4,DEF:5) I(EF:2,DEF:3)","0110222"], // 83
  ["3×2","223212","7/9","I(BC:3,BCF:4) II(D:4,DE:5) I(CF:1,BCF:3) II(AB:2,ABC:3) I(CF:2,BCF:3) II(A:3,AD:5) I(D:1,AD:3)","0212202"], // 84
  ["3×2","231131","8/5","I(AB:1,ABE:3) II(CF:1,BCF:2) I(CF:3,BCF:4) II(A:1,AD:3) I(A:1,AD:2) II(DE:3,DEF:5) I(BE:2,BCE:3)","2200111"], // 85
  ["3×2","211211","2/6","I(D:1,AD:2) II(AB:2,ABD:4) I(BE:3,ABE:5) II(F:1,CF:3) I(CF:1,CEF:3) II(DE:2,ADE:3) I(F:4,EF:5)","1100120"], // 86
  ["3×2","113222","10/8","I(D:2,DE:3) II(DE:2,DEF:4) I(E:1,EF:3) II(A:4,AD:5) I(C:4,CF:6) II(BE:1,BCE:2) I(C:1,CF:2)","1101222"], // 87
  ["3×2","212323","10/7","I(AD:4,ABD:5) II(A:1,AD:2) I(BC:3,BCF:4) II(CF:1,CEF:2) I(CF:2,CEF:3) II(EF:2,DEF:4) I(C:2,CF:3)","2201220"], // 88
  ["3×2","111122","10/2","I(F:2,CF:4) II(D:1,AD:2) I(AD:3,ABD:4) II(C:2,BC:4) I(F:1,EF:2) II(CF:3,BCF:4) I(E:2,DE:4)","1021201"], // 89
  ["3×2","212231","10/6","I(CF:2,CEF:3) II(AD:1,ABD:3) I(E:4,BE:6) II(C:1,BC:2) I(E:2,EF:4) II(AD:3,ADE:5) I(F:4,EF:5)","2112110"], // 90
  ["3×2","231332","17/5","I(BE:4,ABE:6) II(C:2,CF:3) I(B:2,AB:3) II(DE:1,ADE:3) I(DE:3,DEF:4) II(A:2,AD:3) I(AD:4,ABD:6)","1221202"], // 91
  ["3×2","112321","15/7","I(BE:3,BCE:5) II(B:4,BC:5) I(A:4,AB:5) II(C:2,CF:3) I(D:4,AD:6) II(D:1,DE:3) I(D:4,DE:5)","2002221"], // 92
  ["3×2","232231","10/11","I(BC:4,BCE:5) II(D:4,AD:6) I(BC:4,ABC:6) II(BE:2,ABE:3) I(AD:1,ADE:3) II(EF:4,CEF:6) I(AB:1,ABE:2)","2112110"], // 93
  ["3×2","123111","7/5","I(BC:4,BCF:6) II(B:1,BC:2) I(BE:2,BEF:3) II(BC:4,ABC:5) I(C:2,CF:3) II(AD:2,ABD:3) I(CF:2,BCF:3)","0210111"], // 94
  ["3×2","211211","10/5","I(D:2,AD:4) II(F:1,CF:3) I(DE:3,ADE:4) II(A:4,AB:6) I(BE:4,BEF:5) II(AB:3,ABC:5) I(BC:4,ABC:6)","1121001"], // 95
  ["3×2","112121","4/6","I(AD:2,ABD:4) II(D:4,DE:5) I(AB:4,ABD:5) II(AB:1,ABC:2) I(CF:2,CEF:3) II(B:1,BC:2) I(E:1,EF:2)","0102201"], // 96
  ["3×2","233322","13/13","I(AD:3,ADE:5) II(BC:3,BCF:4) I(F:3,CF:4) II(AB:3,ABC:5) I(DE:2,BDE:3) II(D:3,DE:5) I(E:4,EF:6)","2222210"], // 97
  ["3×2","111231","14/5","I(D:3,DE:4) II(F:2,CF:3) I(E:4,BE:5) II(C:3,BC:4) I(E:2,DE:4) II(A:2,AB:3) I(A:3,AD:5)","2220210"], // 98
  ["3×2","122133","12/5","I(CF:2,CEF:3) II(EF:4,BEF:5) I(C:4,BC:5) II(C:3,CF:4) I(AD:1,ABD:3) II(F:4,CF:6) I(BE:2,BEF:4)","2210102"], // 99
  ["3×2","332111","8/9","I(AD:3,ADE:5) II(F:3,CF:5) I(A:2,AB:4) II(D:2,DE:3) I(A:2,AB:3) II(C:1,BC:3) I(AB:1,ABD:3)","0222211"], // 100
] as const;
export const irrigationLevels: IrrigationLevel[] = pack.map(
  ([size, needs, caps, valves, answer], i) => {
    const [width, height] = size.split("×").map(Number);
    return {
      id: `irrigation-plan-${String(i + 1).padStart(3, "0")}`,
      width,
      height,
      needs: [...needs].map(Number),
      caps: caps.split("/").map(Number),
      valves: valves.split(" ").map((token) => {
        const m = /^(I|II)\(([^)]+)\)$/.exec(token);
        if (!m) throw Error("Invalid valve");
        return {
          tank: m[1].length - 1,
          modes: [
            { plots: [], cost: 0 },
            ...m[2].split(",").map((row) => {
              const [plots, cost] = row.split(":");
              return {
                plots: [...plots].map((plot) => plot.charCodeAt(0) - 65),
                cost: Number(cost),
              };
            }),
          ],
        };
      }),
      solution: [...answer].map(Number),
    };
  },
);
export const initial = (level: IrrigationLevel) => level.valves.map(() => 0);
export function inspect(level: IrrigationLevel, modes: readonly number[]) {
  const doses = level.needs.map(() => 0),
    spent = level.caps.map(() => 0);
  for (const [i, valve] of level.valves.entries()) {
    const mode = valve.modes[modes[i]];
    if (!mode) continue;
    spent[valve.tank] += mode.cost;
    for (const plot of mode.plots) doses[plot]++;
  }
  const exact = doses.every((dose, i) => dose === level.needs[i]);
  const underCaps = spent.every((cost, i) => cost <= level.caps[i]);
  return { doses, spent, exact, underCaps, won: exact && underCaps };
}
export function edit(
  level: IrrigationLevel,
  current: readonly number[],
  valve: number,
  mode: number,
) {
  if (
    !level.valves[valve]?.modes[mode] ||
    mode === current[valve] ||
    inspect(level, current).won
  )
    return current;
  return current.map((m, i) => (i === valve ? mode : m));
}
// Search the public constraints, not the replay. Every board has at most 3^7 drafts.
// The nearest valid plan gives actionable hints even from an overfilled draft.
export function hint(level: IrrigationLevel, current: readonly number[]) {
  let nearest: number[] | null = null,
    best = Infinity;
  const draft = initial(level);
  function search(index: number, distance: number) {
    if (distance >= best) return;
    if (index === level.valves.length) {
      if (inspect(level, draft).won) {
        nearest = draft.slice();
        best = distance;
      }
      return;
    }
    for (let mode = 0; mode < level.valves[index].modes.length; mode++) {
      draft[index] = mode;
      search(index + 1, distance + Number(mode !== current[index]));
    }
  }
  search(0, 0);
  const plan = nearest as number[] | null;
  if (!plan) return null;
  const valve = plan.findIndex((mode, i) => mode !== current[i]);
  return valve < 0 ? null : { valve, mode: plan[valve] };
}
