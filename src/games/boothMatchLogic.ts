// SPDX-License-Identifier: GPL-3.0-only
export type BoothBoard = {id:string;title:string;teams:readonly string[];booths:readonly string[]};
export const teams = ["松鼠队","海狸队","燕子队","小鹿队","白鹭队","刺猬队"] as const;
export const booths = ["纸艺","木工","乐器","观星","种植","拼图"] as const;
export const rank = (order:string,partner:number) => order.indexOf(String(partner))+1;
export function moveTeam(seats:readonly number[],team:number,booth:number) {
  const next=[...seats], displaced=seats.indexOf(booth);
  if(displaced>=0) next[displaced]=seats[team];
  next[team]=booth;
  return next;
}
export function conflicts(board:BoothBoard,seats:readonly number[]) {
  const failures:{team:number;booth:number;teamBefore:number;teamAfter:number;boothBefore:number;boothAfter:number}[]=[];
  if(seats.some(n=>n<0)) return failures;
  for(let team=0;team<seats.length;team++){
    const teamBefore=rank(board.teams[team],seats[team]);
    for(let booth=0;booth<seats.length;booth++){
      const teamAfter=rank(board.teams[team],booth);
      const boothBefore=rank(board.booths[booth],seats.indexOf(booth));
      const boothAfter=rank(board.booths[booth],team);
      if(teamAfter<teamBefore && boothAfter<boothBefore)
        failures.push({team,booth,teamBefore,teamAfter,boothBefore,boothAfter});
    }
  }
  return failures;
}
export function rankTotal(board:BoothBoard,seats:readonly number[]) {
  if(seats.some(n=>n<0)) return null;
  return seats.reduce((total,booth,team)=>total+rank(board.teams[team],booth)+rank(board.booths[booth],team),0);
}
