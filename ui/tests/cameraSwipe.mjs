import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BEEHOOKS_TEST_URL;
if(!base?.startsWith('http://127.0.0.1:'))throw Error('Use isolated --serve-test host');
const headers={'X-BeeHooks':'local','Content-Type':'application/json'},checks=[],errors=[];
async function api(path,method='GET',body,token){const r=await fetch(base+'/api'+path,{method,headers:{...headers,...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),text=await r.text();assert.ok(r.ok,path+': '+text);return text?JSON.parse(text):null;}
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+label);}
const pass=text=>{checks.push(text);console.log('PASS: '+text)},browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});let game;
try{
 assert.equal((await api('/admin/status')).games.length,0);
 game=await api('/admin/game','POST',{id:'',name:'Kamera simulasi',target:'steam://rungameid/480',preset:'umum',driver:'xbox'});
 await api('/admin/session/'+game.id,'POST',{});const invite=(await api('/admin/status')).session.invite;
 for(const [width,height]of [[844,390],[390,844]]){
  const portrait=height>width,context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),deviceKey='camera-test-device-'+width+'-'+('0'.repeat(32));
  const joined=await api('/join','POST',{invite,name:'Kamera '+width,deviceKey});
  const player=(await api('/admin/status')).players.at(-1);await api('/admin/player/'+player.id+'/approve','POST',{});
  await context.addInitScript(({invite,token,deviceKey})=>{localStorage.setItem('beehooks-device',deviceKey);sessionStorage.setItem('beehooks-session',JSON.stringify({invite,token}));},{invite,token:joined.token,deviceKey});
  const p=await context.newPage(),sent=[];p.on('pageerror',e=>errors.push(e.message));p.on('websocket',socket=>socket.on('framesent',frame=>{try{const s=JSON.parse(String(frame.payload));if(Number.isInteger(s.seq))sent.push(s);}catch{}}));
  await p.goto(base+'/controller.html#'+invite);await p.locator('#stage').waitFor();await until(async()=>await p.locator('#connection').textContent()==='Terhubung','controller connection');
  let touching=false;const cdp=await context.newCDPSession(p),touch=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});touching=type!=='touchCancel'&&points.length>0;};
  const neutral=async()=>{if(touching)await touch('touchCancel',[]);await until(async()=>{const s=(await api('/admin/status')).players.find(n=>n.id===player.id).state;return s.rx===0&&s.ry===0&&s.lx===0&&s.ly===0&&s.buttons.length===0;},'neutral');};
  const center=async(selector,id)=>{const r=await p.locator(selector).boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2,id};};
  const shift=(point,dx,dy)=>({...point,x:point.x+(portrait?-dy:dx),y:point.y+(portrait?dx:dy)});
  async function empty(id){return p.locator('#stage').evaluate((el,{portrait,id})=>{const r=el.getBoundingClientRect(),x=el.clientWidth*.73,y=el.clientHeight*.1;return {x:portrait?r.right-y:r.left+x,y:portrait?r.top+x:r.top+y,id};},{portrait,id});}
  const has=(index,predicate,label)=>until(()=>sent.slice(index).some(predicate),label).catch(error=>{console.log('STATE DEBUG',label,JSON.stringify(sent.slice(index).slice(-5)));throw error});
  let index=sent.length,cam=await empty(1);await touch('touchStart',[cam]);await p.waitForTimeout(20);cam=shift(cam,45,-14);await touch('touchMove',[cam]);await has(index,s=>s.rx>0&&s.ry<0,'swipe right/up');await touch('touchEnd',[]);await neutral();
  pass(width+': empty right area sends analog-right camera movement and release returns neutral');

  let left=await center('[data-mapping=leftStick]',2),attack=await center('[data-mapping=a]',3);await touch('touchStart',[left]);left=shift(left,40,0);await touch('touchMove',[left]);await touch('touchStart',[left,attack]);cam=await empty(4);await touch('touchStart',[left,attack,cam]);index=sent.length;cam=shift(cam,40,-12);await touch('touchMove',[left,attack,cam]);await has(index,s=>s.rx>0&&s.ry<0&&s.lx>.1&&s.buttons.includes('a'),'three touches');index=sent.length;await touch('touchEnd',[cam]);await has(index,s=>s.rx===0&&s.ry===0&&s.lx>.1&&s.buttons.includes('a'),'camera release preserves movement/button');await neutral();
  pass(width+': walking, action button and camera work together; releasing camera preserves the other fingers');

  cam=await empty(5);await touch('touchStart',[cam]);cam=shift(cam,30,0);index=sent.length;await touch('touchMove',[cam]);await has(index,s=>s.rx>0,'camera pulse');await p.waitForTimeout(180);assert.equal(sent.at(-1).rx,0);assert.equal(sent.at(-1).ry,0);index=sent.length;cam=shift(cam,-30,12);await touch('touchMove',[cam]);await has(index,s=>s.rx<0&&s.ry>0,'reverse camera');await neutral();
  pass(width+': camera stops when dragging stops and follows a reversed swipe without a new tap');

  const action=await center('[data-mapping=y]',6);index=sent.length;await touch('touchStart',[action]);await touch('touchMove',[shift(action,30,0)]);await p.waitForTimeout(80);assert.ok(sent.slice(index).some(s=>s.buttons.includes('y')));assert.ok(sent.slice(index).every(s=>s.rx===0&&s.ry===0));await neutral();
  let stick=await center('[data-mapping=rightStick]',7);await touch('touchStart',[stick]);stick=shift(stick,35,0);await touch('touchMove',[stick]);cam=await empty(8);index=sent.length;await touch('touchStart',[stick,cam]);await touch('touchMove',[stick,shift(cam,-35,0)]);await has(index,s=>s.rx>0,'manual right stick priority');assert.ok(sent.slice(index).every(s=>s.rx>=0));await neutral();
  pass(width+': buttons never start camera swipes, and an already-held right stick keeps ownership');

  for(const event of ['blur','resize']){cam=await empty(9);await touch('touchStart',[cam]);cam=shift(cam,30,0);await touch('touchMove',[cam]);await p.evaluate(type=>window.dispatchEvent(new Event(type)),event);await neutral();}
  await p.locator('#edit').click();assert.equal(await p.locator('#cameraSwipe').isChecked(),true);await p.locator('#cameraSwipe').uncheck();await p.locator('#save').click();await p.locator('#editor').waitFor({state:'hidden'});assert.equal((await api('/player','GET',undefined,joined.token)).layout.cameraSwipe,false);await p.reload();await p.locator('#stage').waitFor();await until(async()=>await p.locator('#connection').textContent()==='Terhubung','reload connection');index=sent.length;cam=await empty(10);await touch('touchStart',[cam]);await touch('touchMove',[shift(cam,40,0)]);await p.waitForTimeout(100);await neutral();assert.ok(sent.slice(index).every(s=>s.rx===0&&s.ry===0));
  pass(width+': cancellation/blur/resize clear input and a saved disabled camera option survives reload');

  if(!portrait){
   const pc=await browser.newPage({viewport:{width:1280,height:800}});pc.on('pageerror',e=>errors.push(e.message));await pc.route('**/api/admin/artwork/*',r=>r.fulfill({json:{video:null}}));await pc.goto(base);await pc.locator('[data-tab=layouts]').click();const toggle=pc.locator('#studio-camera');await toggle.waitFor();await until(()=>toggle.isEnabled(),'Studio loaded');assert.equal(await toggle.isChecked(),true);await toggle.uncheck();await pc.locator('#studio-save').click();await until(async()=>(await api('/admin/status')).games[0].profile?.cameraSwipe===false,'Studio off');await toggle.check();await pc.locator('#studio-save').click();await until(async()=>(await api('/admin/status')).games[0].profile?.cameraSwipe===true,'Studio on');assert.equal((await api('/player','GET',undefined,joined.token)).layout.cameraSwipe,false);
   await p.locator('#edit').click();assert.equal(await p.locator('#cameraSwipe').isChecked(),false);await p.locator('#reset').click();await until(()=>p.locator('#cameraSwipe').isChecked(),'adopt default');assert.equal((await api('/player','GET',undefined,joined.token)).layout.cameraSwipe,false);await p.locator('#save').click();await p.locator('#editor').waitFor({state:'hidden'});assert.equal((await api('/player','GET',undefined,joined.token)).layout.cameraSwipe,true);await pc.close();
   pass('Studio can switch the game default off/on without overwriting personal layouts; Reset + Save explicitly adopts it');
  }
  await api('/admin/player/'+player.id+'/kick','POST',{});await context.close();
 }
 assert.deepEqual(errors,[]);pass('no JavaScript errors across landscape, rotated portrait and Studio');
 await fs.writeFile(new URL('../../evidence/camera-swipe-checks.json',import.meta.url),JSON.stringify({simulation:true,checks},null,2));
}finally{await browser.close();await api('/admin/session','DELETE');if(game)await api('/admin/game/'+game.id,'DELETE');}
