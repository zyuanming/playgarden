// SPDX-License-Identifier: GPL-3.0-only
import { makeBoard, type Blueprint } from "./recyclingWorkshopLogic";

const blueprints: Blueprint[] = [
  {"id":"recycling-workshop-01","items":["C(P,M)"],"tools":[1,0],"goal":[1,1,0]},
  {"id":"recycling-workshop-02","items":["C(P,P)","S(M,G)"],"tools":[0,1],"goal":[2,1,1]},
  {"id":"recycling-workshop-03","items":["C(P,S(M,G))"],"tools":[1,1],"goal":[1,1,1]},
  {"id":"recycling-workshop-04","items":["C(P,X)","C(M,G)"],"tools":[1,0],"goal":[0,1,1]},
  {"id":"recycling-workshop-05","items":["C(S(G,C(M,P)),P)","C(G,G)","C(C(M,P),S(X,G))"],"tools":[2,1],"goal":[2,1,3]},
  {"id":"recycling-workshop-06","items":["S(S(G,G),P)","S(G,P)","C(C(P,M),M)"],"tools":[2,1],"goal":[2,2,2]},
  {"id":"recycling-workshop-07","items":["C(C(P,M),X)","C(S(P,P),G)","C(S(M,P),X)"],"tools":[2,1],"goal":[3,1,1]},
  {"id":"recycling-workshop-08","items":["S(M,C(X,P))","S(S(G,M),C(X,X))","C(C(P,M),S(X,M))","S(C(M,G),M)"],"tools":[2,2],"goal":[1,3,1]},
  {"id":"recycling-workshop-09","items":["C(G,C(P,X))","C(M,C(P,S(M,G)))","C(S(M,S(G,G)),P)","S(P,C(C(M,M),G))"],"tools":[2,2],"goal":[2,2,2]},
  {"id":"recycling-workshop-10","items":["C(P,C(M,S(P,M)))","S(C(M,M),X)","C(C(C(M,G),P),P)","S(P,C(G,X))"],"tools":[3,3],"goal":[3,4,1]},
  {"id":"recycling-workshop-11","items":["C(X,C(M,M))","S(C(G,S(G,P)),P)","C(S(G,C(P,M)),G)","C(M,C(M,P))"],"tools":[3,3],"goal":[3,1,3]},
  {"id":"recycling-workshop-12","items":["C(C(P,S(P,G)),M)","C(C(M,G),X)","C(C(P,M),C(G,M))","C(P,S(P,G))"],"tools":[3,2],"goal":[4,1,2]},
];
export const recyclingWorkshopLevels = blueprints.map(makeBoard);
