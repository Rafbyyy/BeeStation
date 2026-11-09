import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.BEEHOOKS_TEST_URL;
if(!base?.startsWith('http://127.0.0.1:'))throw Error('Use an isolated --serve-test host.');
const headers={'X-BeeHooks':'local','Content-Type':'application/json'};
async function api(path,method='GET',body){const r=await fetch(base+'/api/admin'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),text=await r.text();assert.ok(r.ok,text);return text?JSON.parse(text):null;}
const games=[],checks=[],metrics={};
const pass=message=>{checks.push(message);console.log('PASS: '+message);};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 assert.equal((await api('/status')).games.length,0,'test host must start empty');
 for(const [name,id,preset] of [['Minecraft Dungeons','1672970','dungeons'],['Overcooked! 2','728880','overcooked2']]){
  const g=await api('/game','POST',{id:'',name,target:'steam://rungameid/'+id,preset,driver:'xbox'});games.push(g);
  const {video}=await api('/artwork/'+g.id),{audio}=await api('/artwork/'+g.id+'?audio=true');assert.ok(video&&audio);
  for(const url of [video,audio]){const r=await fetch(base+url);assert.ok(r.ok);await fs.writeFile(new URL('../../evidence/media/'+url.split('/').pop(),import.meta.url),Buffer.from(await r.arrayBuffer()));}
 }
 pass('official Steam 1080p video and matching AAC audio are cached for both installed games');
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.navSounds=0;window.navPeak=0;window.navAudioState='uncreated';
  const createGain=AudioContext.prototype.createGain;
  AudioContext.prototype.createGain=function(...args){
   window.navSounds++;window.navAudioState=this.state;const node=createGain.apply(this,args),analyser=this.createAnalyser();analyser.fftSize=32768;node.connect(analyser);
   const buffer=new Float32Array(analyser.fftSize);let frames=0;
   const sample=()=>{window.navAudioState=this.state;analyser.getFloatTimeDomainData(buffer);window.navPeak=Math.max(window.navPeak,...buffer.map(Math.abs));if(frames++<60)requestAnimationFrame(sample);else analyser.disconnect();};requestAnimationFrame(sample);return node;
  };
 });
 await page.goto(base);await page.locator('.desktop-backdrop audio').waitFor({state:'attached'});
 assert.equal(await page.locator('.desktop-backdrop audio').evaluate(a=>a.paused),true);
 await page.getByRole('button',{name:'Aktifkan suara trailer',exact:true}).waitFor();
 pass('initial page stays quiet until a real game selection or sound-button gesture');
 await page.getByRole('button',{name:'Aktifkan suara trailer',exact:true}).click();
 await page.locator('[data-game].selected').press('ArrowRight');
 const audio=page.locator('.desktop-backdrop audio'),video=page.locator('.desktop-backdrop video');
 await page.waitForFunction(()=>{const v=document.querySelector('.desktop-backdrop video'),a=document.querySelector('.desktop-backdrop audio');return a?.src.includes('728880')&&a.readyState>=2&&!a.paused&&!a.muted&&v?.videoHeight===1080;},null,{timeout:20000});
 assert.equal(await audio.evaluate(a=>a.volume),.3);
 metrics.resolution=await video.evaluate(v=>[v.videoWidth,v.videoHeight]);
 await page.waitForFunction(()=>window.navPeak>.001,null,{timeout:5000}).catch(async()=>{throw Error('Audio measurement: '+JSON.stringify(await page.evaluate(()=>({count:window.navSounds,peak:window.navPeak,state:window.navAudioState,visibility:document.visibilityState}))));});
 metrics.navigationPeak=await page.evaluate(()=>window.navPeak);
 pass('sound-button activation and game navigation produce low-volume trailer audio and a measurable selection sound; video decodes at 1920x1080');
 await audio.evaluate(async a=>{
  const context=new AudioContext();await context.resume();const source=context.createMediaElementSource(a),analyser=context.createAnalyser();source.connect(context.destination);source.connect(analyser);
  const buffer=new Float32Array(analyser.fftSize);window.trailerPeak=0;
  for(let i=0;i<90;i++){analyser.getFloatTimeDomainData(buffer);window.trailerPeak=Math.max(window.trailerPeak,...buffer.map(Math.abs));await new Promise(r=>setTimeout(r,20));}
 });
 metrics.trailerPeak=await page.evaluate(()=>window.trailerPeak);assert.ok(metrics.trailerPeak>.001);
 const drift=()=>page.evaluate(()=>Math.abs(document.querySelector('.desktop-backdrop video').currentTime-document.querySelector('.desktop-backdrop audio').currentTime));
 assert.ok(await drift()<.4);pass('actual AAC trailer samples are non-silent and stay synchronized with video');
 await page.getByRole('button',{name:'Jeda video latar',exact:true}).click();
 assert.equal(await audio.evaluate(a=>a.paused),true);assert.equal(await video.evaluate(v=>v.paused),true);
 await page.getByRole('button',{name:'Putar video latar',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.desktop-backdrop audio').paused);
 assert.ok(await drift()<.4);pass('pause/resume controls both video and its soundtrack');
 await video.evaluate(v=>{v.currentTime=16.5;});
 await page.waitForFunction(()=>document.querySelector('.desktop-backdrop video').currentTime<3,null,{timeout:5000});
 await page.waitForFunction(()=>Math.abs(document.querySelector('.desktop-backdrop video').currentTime-document.querySelector('.desktop-backdrop audio').currentTime)<.4);
 pass('soundtrack resynchronizes when the trailer seeks and loops');
 await page.getByRole('button',{name:'Matikan suara trailer',exact:true}).click();
 assert.equal(await audio.evaluate(a=>a.muted&&a.paused),true);const count=await page.evaluate(()=>{window.navPeak=0;return window.navSounds});
 await page.locator('[data-game].selected').press('ArrowLeft');
 await page.waitForFunction(()=>document.querySelector('.desktop-backdrop audio')?.src.includes('1672970'));
 assert.ok(await page.evaluate(()=>window.navSounds)>count);await page.waitForFunction(()=>window.navPeak>.001);metrics.mutedTrailerNavigationPeak=await page.evaluate(()=>window.navPeak);assert.equal(await audio.evaluate(a=>a.muted&&a.paused),true);
 pass('mute silences only the trailer; game selection still produces a measurable navigation sound while the trailer stays muted');
 await page.getByRole('button',{name:'Aktifkan suara trailer',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.desktop-backdrop audio').paused);
 const priorAudio=await audio.elementHandle(),beforeKeyboard=await page.evaluate(()=>window.navSounds);await page.locator('.game-card.selected').press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('.desktop-backdrop audio')?.src.includes('728880')&&!document.querySelector('.desktop-backdrop audio').paused);
 assert.equal(await priorAudio.evaluate(a=>a.paused),true);assert.equal(await audio.count(),1);
 assert.ok(await page.evaluate(()=>window.navSounds)>beforeKeyboard);pass('keyboard selection plays the effect and retires the previous soundtrack without overlap');
 const beforeRefresh=await page.evaluate(()=>window.navSounds);await page.waitForTimeout(2200);assert.equal(await page.evaluate(()=>window.navSounds),beforeRefresh);
 pass('background status refresh does not replay the navigation sound');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await audio.evaluate(a=>a.paused),true);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'Putar video latar',exact:true}).click();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await audio.evaluate(a=>a.paused),true);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>!document.querySelector('.desktop-backdrop audio').paused);
 pass('reduced motion and hidden-page handling pause audio together with the video');
 await video.evaluate(v=>v.dispatchEvent(new Event('error')));assert.equal(await audio.evaluate(a=>a.paused),true);
 pass('a failed video cannot leave its soundtrack playing');
 assert.deepEqual(errors,[]);pass('no browser JavaScript errors');
 await fs.writeFile(new URL('../../evidence/audio-browser-checks.json',import.meta.url),JSON.stringify({simulation:true,checks,metrics},null,2)+'\n');
}finally{
 await browser.close();for(const g of games)await api('/game/'+g.id,'DELETE');
}
