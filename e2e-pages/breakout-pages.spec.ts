// SPDX-License-Identifier: GPL-3.0-only
import {test,expect} from '@playwright/test';
import {openBreakout,freezeBreakout,playBreakout} from '../e2e/breakoutJourney';
test('breakout exact published build opens and clears first original stage',async({page},info)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await openBreakout(page,'./');if(process.env.GITHUB_SHA)await expect(page.locator('meta[name="playgarden-commit"]')).toHaveAttribute('content',process.env.GITHUB_SHA);await freezeBreakout(page);await playBreakout(page,info,0);expect(errors).toEqual([]);});
