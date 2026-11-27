// SPDX-License-Identifier: GPL-3.0-only
export const equationProofs = [
  {"orders":["A"],"x":5},
  {"orders":["B"],"x":4},
  {"orders":["AB","BA"],"x":5},
  {"orders":["DC"],"x":5},
  {"orders":["ECB"],"x":5},
  {"orders":["CAD","CDA"],"x":5},
  {"orders":["CEB"],"x":4},
  {"orders":["ABDE","DEBA"],"x":1},
  {"orders":["BGAE","BGEA"],"x":6},
  {"orders":["CGDE","CGED"],"x":1},
  {"orders":["ACBFD","ACFBD","ACFDB","CABFD","CAFBD","CAFDB"],"x":2},
  {"orders":["BGFED","EGBDF","EGBFD"],"x":3},
] as const;
