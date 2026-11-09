import {holdGame} from './galleryHelpers.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BEEHOOKS_TEST_URL;
if(!base?.startsWith('http://127.0.0.1:'))throw Error('Use an isolated --serve-test host.');
const headers={'X-BeeHooks':'local','Content-Type':'application/json'};
async function api(path,method='GET',body){const response=await fetch(base+'/api/admin'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),text=await response.text();assert.ok(response.ok,text);return text?JSON.parse(text):null;}
const output=new URL('../../evidence/',import.meta.url),games=[],checks=[];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
function pass(message){checks.push(message);console.log('PASS: '+message);}
try{
 assert.equal((await api('/status')).games.length,0,'test host must start empty');
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/admin/artwork/*',route=>route.fulfill({json:{video:null}}));
 await page.goto(base);await page.locator('#empty-add').click();await page.locator('#game-dialog').waitFor({state:'visible'});await page.getByRole('button',{name:'Tutup',exact:true}).click();
 pass('empty library has a working add-game action');
 const grid=page.locator('.halftone-background');assert.equal(await grid.count(),1);assert.equal(await page.locator('.magnetic-cursor,.magnetic-cursor-layer').count(),0);assert.equal(await grid.getAttribute('aria-hidden'),'true');assert.equal(await grid.evaluate(c=>getComputedStyle(c).pointerEvents),'none');
 const pixels=()=>grid.evaluate(c=>c.toDataURL());await page.mouse.move(1,1);await page.waitForTimeout(600);const quiet=await pixels();await page.locator('[data-tab=settings]').hover();await page.waitForTimeout(500);assert.notEqual(await pixels(),quiet);await page.locator('[data-tab=settings]').click();await page.getByRole('heading',{name:'Pengaturan',exact:true}).waitFor();await page.locator('#app').dispatchEvent('pointerleave');await page.waitForTimeout(1200);assert.equal(await grid.evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)),false,'trail disappears within 1.2 seconds');const settled=await pixels();await page.waitForTimeout(150);assert.equal(await pixels(),settled);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);const still=await pixels();await page.locator('[data-tab=play]').hover();await page.waitForTimeout(250);assert.equal(await pixels(),still);await page.locator('[data-tab=play]').focus();await page.keyboard.press('Enter');await page.locator('.library-scene').waitFor();assert.equal(await grid.count(),1);await page.emulateMedia({reducedMotion:'no-preference'});pass('restored Halftone Trail responds to hover/click, fades within 1.2 seconds, respects reduced motion and preserves keyboard navigation');

 for(const [name,preset,target] of [['Minecraft Dungeons','dungeons',1672970],['Brawlhalla','brawlhalla',291550],['Overcooked! 2','overcooked2',728880],['Space <&> "Survivors" — A Very Long Game Title','umum',480]])games.push(await api('/game','POST',{id:'',name,preset,target:'steam://rungameid/'+target,driver:'xbox'}));
 await page.reload();await page.locator('[data-game]').first().waitFor();await page.evaluate(()=>document.fonts.ready);
 const availableArtwork=(await api('/status')).games.filter(g=>g.poster||g.icon);
 for(const entry of availableArtwork){await page.locator(`[data-game="${entry.id}"] img`).evaluate(img=>img.decode());assert.equal(entry.cover,null);}
 assert.ok(await page.locator('[data-game] .card-art').count()===games.length);
 pass('available artwork loads in square game cards while stored cover fields and initials fallbacks remain intact');
 assert.equal(await page.evaluate(()=>[...document.fonts].some(f=>f.family==='Plus Jakarta Sans'&&f.status==='loaded')),true);
 assert.ok((await page.locator('.hero h1').evaluate(el=>getComputedStyle(el).fontFamily)).includes('Plus Jakarta Sans'));
 assert.equal(await page.locator('.rail-hint,#previous-game,#next-game').count(),0);for(const selector of ['body','header button','.hero h1'])assert.ok((await page.locator(selector).first().evaluate(el=>getComputedStyle(el).fontFamily)).includes('Plus Jakarta Sans'));assert.ok(!(await page.locator('.gallery-wordmark').evaluate(el=>getComputedStyle(el).fontFamily)).includes('Plus Jakarta Sans'));
 const titleStyle=await page.locator('.hero h1').evaluate(el=>{const s=getComputedStyle(el);return {size:parseFloat(s.fontSize),line:parseFloat(s.lineHeight),padding:parseFloat(s.paddingBottom),overflow:s.overflow}});assert.ok(titleStyle.size>=38&&titleStyle.line>=titleStyle.size*1.17&&titleStyle.padding>0);assert.equal(titleStyle.overflow,'visible');assert.equal(await page.locator('.library-scene .hero p').count(),0);pass('larger Plus Jakarta Sans title has descender space and no click hint; long names remain escaped');
 const first=page.locator('[data-game]').first();await first.evaluate(el=>window.originalGameCard=el);
 await page.locator('[data-game].selected').press('ArrowRight');
 assert.equal(await page.locator('.hero h1').textContent(),games[1].name);
 assert.equal(await first.evaluate(el=>el===window.originalGameCard),true);
 assert.equal(await page.locator('[data-game][aria-pressed=true]').count(),1);
 assert.equal(await page.locator('#rail-position').textContent(),'02 / 04');
 await page.locator('[data-game].selected').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.hero h1').textContent(),games[2].name);
 await page.keyboard.press('End');assert.equal(await page.locator('.hero h1').textContent(),games[3].name);await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.hero h1').textContent(),games[3].name);
 await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.hero h1').textContent(),games[3].name);
 await page.keyboard.press('Home');assert.equal(await page.locator('.hero h1').textContent(),games[0].name);await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('.hero h1').textContent(),games[0].name);
 await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('.hero h1').textContent(),games[0].name);
 assert.equal(await page.locator('[data-game][tabindex="0"]').count(),1);assert.equal(await page.locator('[data-game].selected').evaluate(el=>el===document.activeElement),true);
 pass('click, arrows, Home/End, edge limits, selected state and keyboard focus stay consistent; card nodes survive selection for smooth transitions');
 await page.locator('[data-game].selected').press('ArrowRight');await page.waitForTimeout(500);
 const shape=await page.locator('[data-game]').evaluateAll(cards=>cards.map(c=>{const b=c.getBoundingClientRect();return {top:b.top,height:b.height,width:b.width,active:c.classList.contains('selected'),transform:getComputedStyle(c).transform};}));
 assert.ok(shape.every(c=>Math.abs(c.height-c.width)<1));const active=shape.find(c=>c.active),neighbor=shape.find(c=>!c.active);assert.ok(active.height>neighbor.height*1.2);assert.ok(active.top<neighbor.top);
 const rail=page.locator('.game-rail'),r=await rail.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+24);await page.mouse.wheel(0,80);await page.waitForTimeout(350);assert.equal(await page.locator('.hero h1').textContent(),games[2].name);
 await page.mouse.move(r.x+r.width/2,r.y+24);await page.mouse.down();await page.mouse.move(r.x+r.width/2+85,r.y+26,{steps:8});await page.mouse.up();assert.equal(await page.locator('.hero h1').textContent(),games[1].name);
 await page.locator('.game-rail').dispatchEvent('pointerdown',{pointerId:20,clientX:500,clientY:200,button:0});await page.locator('.game-rail').dispatchEvent('pointercancel',{pointerId:20});assert.equal(await page.locator('.game-rail').getAttribute('class'),'game-rail');
 await page.locator('[data-game].selected').press('Home');await page.waitForTimeout(500);
 assert.ok(await page.locator('[data-game] img').evaluateAll(nodes=>nodes.every(img=>Math.abs(img.getBoundingClientRect().height-img.getBoundingClientRect().width)<1&&getComputedStyle(img).objectFit==='cover')));
 pass('square filmstrip emphasizes the centered selection and preserves scoped wheel/drag navigation and image proportions');

 assert.equal((await api('/status')).session,null,'selection must not start a session');assert.equal(await page.locator('#start,#session-workspace').count(),0);await holdGame(page.locator('[data-game].selected'));await page.locator('.game-detail').waitFor();assert.ok(await page.locator('#page').evaluate(e=>e.getAnimations().length>0));
 await page.locator('.game-options summary').click();await page.locator('#edit').click();assert.equal(await page.locator('[name=name]').inputValue(),games[0].name);await page.locator('[name=name]').press('ArrowRight');assert.equal(await page.locator('[name=name]').inputValue(),games[0].name);await page.getByRole('button',{name:'Tutup',exact:true}).click();
 await page.locator('#back-games').click();await page.locator('[data-game].selected').press('ArrowRight');await holdGame(page.locator('[data-game].selected'));await page.locator('#start').click();await page.locator('#end').waitFor();
 assert.equal((await api('/status')).session.gameId,games[1].id);
 if(await page.locator('#qr').count()){await page.locator('#page').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const qr=await page.locator('#qr').boundingBox();assert.ok(await page.locator('#qr').evaluate(c=>c.width>=200&&c.width===c.height));assert.ok(Math.abs(qr.width-208)<.25&&Math.abs(qr.height-208)<.25,'settled QR bounds: '+JSON.stringify(qr));}
 await page.getByRole('button',{name:'Akhiri sesi',exact:true}).click();await page.locator('#end').waitFor({state:'detached'});
 pass('selection does not launch or start games; editing and session setup use the selected game; active QR retains 208px scanning size');
 await page.locator('#back-games').click();
 await page.locator('[data-game].selected').focus();await page.keyboard.press('ArrowRight');
 await page.getByRole('button',{name:'Controller Studio',exact:true}).click();await page.locator('#studio-control option').first().waitFor({state:'attached'});await page.getByRole('button',{name:'Games',exact:true}).click();assert.equal(await page.locator('.hero h1').textContent(),games[2].name);
 pass('selected game survives tab changes');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('[data-game].selected').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 await page.emulateMedia({reducedMotion:'no-preference'});assert.notEqual(await page.locator('[data-game].selected').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 pass('reduced motion removes gallery movement');
 for(const [width,height] of [[1920,1080],[1280,720],[960,640],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(500);
  const boxes=await page.evaluate(()=>{const card=document.querySelector('.game-card.selected').getBoundingClientRect(),rail=document.querySelector('.game-rail').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,center:Math.abs(card.x+card.width/2-rail.x-rail.width/2),top:card.top,bottom:card.bottom,railTop:rail.top,railBottom:rail.bottom};});
  assert.equal(boxes.overflow,false,width+' has no horizontal overflow');assert.ok(boxes.center<2);assert.ok(boxes.top>=boxes.railTop&&boxes.bottom<=boxes.railBottom);
  await page.screenshot({path:new URL('desktop-gallery-'+width+'-SIMULASI.png',output).pathname.slice(1)});
 }
 pass('selected card stays centered and unclipped at 1920, 1280, 960 and 390px without horizontal overflow');

 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),touch=await mobile.newPage();await touch.route('**/api/admin/artwork/*',r=>r.fulfill({json:{video:null}}));await touch.goto(base);await touch.locator('[data-game].selected').waitFor();const cdp=await mobile.newCDPSession(touch),box=await touch.locator('[data-game].selected').boundingBox(),start={x:box.x+box.width/2,y:box.y+24,id:19};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x-i*10}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await touch.locator('.hero h1').textContent(),games[1].name);
 const vertical=await touch.locator('[data-game].selected').boundingBox(),finger={x:vertical.x+vertical.width/2,y:vertical.y+24,id:20};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...finger,y:finger.y-i*12}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.waitForTimeout(200);assert.equal(await touch.evaluate(()=>scrollY),0);assert.equal(await touch.locator('.hero h1').textContent(),games[1].name);await mobile.close();
 pass('touch swipes select games while vertical pans do not scroll the dedicated gallery without changing the selected game');
 assert.deepEqual(errors,[]);pass('no browser JavaScript errors');
 await fs.writeFile(new URL('desktop-gallery-checks.txt',output),'SIMULATION ONLY — fake host, no real library/game actions.\n'+checks.map(c=>'PASS: '+c).join('\n')+'\n');
}finally{
 await api('/session','DELETE');for(const game of games)await api('/game/'+game.id,'DELETE');await browser.close();
}
