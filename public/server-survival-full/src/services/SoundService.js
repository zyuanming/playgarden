// SPDX-License-Identifier: GPL-3.0-only
// Original, silent compatibility adapter. No upstream audio assets are loaded.
export class SoundService {
 constructor(){this.ctx={};this.musicMuted=true;this.sfxMuted=true;}
 init(){} playMenuBGM(){} playGameBGM(){} switchBGM(){} playMenuHover(){} playMenuClick(){}
 toggleMusic(){return true;} toggleSfx(){return true;} playTone(){} playPlace(){} playConnect(){}
 playDelete(){} playSuccess(){} playFail(){} playFraudBlocked(){} playGameOver(){}
}
