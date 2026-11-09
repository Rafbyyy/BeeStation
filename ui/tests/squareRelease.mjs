import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BEEHOOKS_TEST_URL;
if(!base?.startsWith('http://127.0.0.1:'))throw Error('A local running release is required');
const evidence=new URL('../../evidence/',import.meta.url),checks=[];
const status=async()=>{const r=await fetch(base+'/api/admin/status',{headers:{'X-BeeHooks':'local'}});assert.ok(r.ok);return r.json();};
const before=await status();assert.equal(before.session,null,'Do not interact with a live session');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
 await page.locator('[data-game]').nth(1).click();
 const active=page.locator('[data-game].selected');
 // Real trailer startup can delay frames; require settled geometry, not a fixed sleep.
 await expect.poll(async()=>{const b=await active.boundingBox();return Math.abs(b.x+b.width/2-640);},{timeout:5000}).toBeLessThan(.5);
 await page.waitForTimeout(200);
 const rest=await active.boundingBox();assert.ok(Math.abs(rest.width-rest.height)<1);
 const neighbor=await page.locator('[data-game]:not(.selected)').first().boundingBox();assert.ok(rest.width>neighbor.width*1.2);
 checks.push('Installed library displays square cards with a larger centered selection');
 await page.screenshot({path:new URL('square-gallery-RELEASE.png',evidence).pathname.slice(1)});
 await active.hover();await page.mouse.down();await page.waitForTimeout(130);const early=await active.boundingBox();await page.waitForTimeout(280);const held=await active.boundingBox();
 assert.ok(held.width>early.width+2&&held.width>rest.width);
 await page.screenshot({path:new URL('square-gallery-hold-RELEASE.png',evidence).pathname.slice(1),timeout:2000});
 await page.mouse.up();await page.waitForTimeout(800);assert.equal(await page.locator('.game-detail').count(),0);
 checks.push('Holding grows the selected square; releasing early cancels room entry');
 await active.focus();await page.keyboard.down('Enter');try{await page.locator('.game-detail').waitFor({timeout:4000});}finally{await page.keyboard.up('Enter');}
 assert.equal((await status()).session,null);checks.push('Completed keyboard hold opens the room without starting a session or game');
 await page.locator('#back-games').click();await active.waitFor();await page.waitForTimeout(500);
 assert.deepEqual(errors,[]);checks.push('Published application has no browser JavaScript errors');
 await fs.writeFile(new URL('square-gallery-release.json',evidence),JSON.stringify({base,simulation:false,checks,geometry:{rest,early,held},sessionUnchanged:(await status()).session===before.session,physicalAudioListening:false},null,2));
 console.log(JSON.stringify({checks:checks.length,rest:rest.width,holding:held.width,errors}));
}finally{await browser.close();}
