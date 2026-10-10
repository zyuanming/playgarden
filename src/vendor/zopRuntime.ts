// SPDX-License-Identifier: GPL-3.0-only
import {createZopEngine} from './zopOriginal';
export type ZopDot={id:number;r:number;c:number;x:number;y:number;ty:number;color:string;settled:boolean};
export type ZopSnapshot={phase:'waiting'|'playing'|'gameover'|'disposed';time:number;score:number;elapsed:number;disposed:boolean;width:number;height:number;dotSize:number;xs:number;ys:number;selecting:boolean;squareColor:string|null;selected:number[];dots:ZopDot[];metrics:{clears:number;loops:number;lastRemoved:number;lastLoopColor:string|null}};
export type ZopEngine={start():void;frame(dt:number):void;down(x:number,y:number):void;move(x:number,y:number):void;up():void;cancel():void;snapshot():ZopSnapshot;dispose():void};
export function mountZop(canvas:HTMLCanvasElement,best:()=>number,finish:(score:number)=>void):ZopEngine{return createZopEngine(canvas,best,finish) as ZopEngine;}
