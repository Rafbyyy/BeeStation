import './style.css';
import './desktop.css';
import QRCode from 'qrcode';
import {mountStudio} from './studio';
import {mountNavigationTabs} from './navigationTabs';
import {mountHalftoneBackground} from './halftoneBackground';
import {mountWordmarkFooter} from './wordmarkFooter';
import {mountDesktopFullscreen} from './desktopFullscreen';
import {esc,request,toast,downloadLayout,readLayout,type Layout} from './shared';
type Game={id:string;name:string;target:string;preset:string;driver:string;cover:string|null;artwork?:string|null;icon?:string|null;poster?:string|null;profile:Layout|null;proof:any;exists:boolean;compatibility:string};
let studio:ReturnType<typeof mountStudio>|undefined;
let gamesView:'gallery'|'detail'='gallery';
let viewAnimation:Animation|undefined;
let cancelGalleryHold=()=>{};
let state:any,selected='',tab='play',chosenAddress='',formOpen=false;
let backdropKey='',videoPaused=matchMedia('(prefers-reduced-motion:reduce)').matches;
let trailerSoundEnabled=true,trailerSoundUnlocked=false,soundContext:AudioContext|undefined;
const root=document.querySelector<HTMLDivElement>('#app')!;
window.addEventListener('pointerup',()=>cancelGalleryHold());window.addEventListener('pointercancel',()=>cancelGalleryHold());window.addEventListener('blur',()=>cancelGalleryHold());document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGalleryHold();});
root.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement&&event.target.closest('.game-card,.desktop-backdrop'))event.target.remove();},true);
root.innerHTML=`<div class="desktop-backdrop" aria-hidden="true"></div><header><a class="brand" href="#"><img class="bee" src="/favicon.svg" alt=""> BeeStation<span class="tag">LOCAL PLAY</span></a><nav aria-label="Navigasi utama"><button data-tab="play" class="active">Games</button><button data-tab="layouts">Controller Studio</button><button data-tab="settings">Pengaturan</button></nav><span id="session-badge" class="pill">○ Sesi belum aktif</span><div class="media-controls"><button id="background-sound" aria-label="Aktifkan suara trailer"></button><button id="background-motion" aria-label="Jeda video latar" hidden></button><button id="desktop-fullscreen" aria-label="Layar penuh" title="Layar penuh (F11)" aria-pressed="false"></button></div></header><main><div id="page"></div></main><footer><span>Satu layar. Banyak teman.</span><span>BeeStation · pratinjau 0.1</span></footer><dialog id="game-dialog"></dialog>`;
root.querySelector('#background-sound')!.addEventListener('click',()=>{if(!trailerSoundEnabled||!trailerSoundUnlocked){trailerSoundEnabled=true;unlockSound();}else trailerSoundEnabled=false;syncBackdropAudio();syncSoundControl();});
root.querySelector('#background-motion')!.addEventListener('click',()=>{const video=root.querySelector<HTMLVideoElement>('.desktop-backdrop video');if(!video)return;unlockSound();videoPaused=!videoPaused;if(videoPaused)video.pause();else video.play().catch(()=>{if(root.querySelector('.desktop-backdrop video')===video){videoPaused=true;syncVideoControl();}});syncVideoControl();});
const syncNavigation=mountNavigationTabs(root.querySelector<HTMLElement>('nav')!);
mountHalftoneBackground(root);mountWordmarkFooter(root);mountDesktopFullscreen(root.querySelector<HTMLButtonElement>('#desktop-fullscreen')!);
syncSoundControl();
matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',event=>{if(event.matches){viewAnimation?.cancel();videoPaused=true;root.querySelector<HTMLVideoElement>('.desktop-backdrop video')?.pause();syncVideoControl();}});
document.addEventListener('visibilitychange',()=>{const video=root.querySelector<HTMLVideoElement>('.desktop-backdrop video');if(!video)return;if(document.hidden)video.pause();else if(!videoPaused)video.play().catch(()=>{});syncBackdropAudio();});
root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>{if(studio&&!studio.canLeave())return;tab=b.dataset.tab!;if(tab==='play')gamesView='gallery';root.querySelectorAll('[data-tab]').forEach(e=>e.classList.toggle('active',e===b));syncNavigation();render();});
async function refresh(){try{state=await request('/api/admin/status');if(!state.games.some((g:Game)=>g.id===selected)){selected=state.games[0]?.id??'';gamesView='gallery';}render();}catch(e){toast(String(e));}}
function game():Game|undefined{return state?.games.find((g:Game)=>g.id===selected);}
function gameInfo(g:Game){return `<p class="eyebrow">RUANG BERMAIN</p><h1>${esc(g.name)}</h1><p class="muted lead">${g.driver==='ds4'?'DualShock 4':'Xbox / XInput'}<span aria-hidden="true"> · </span>Profil ${esc(g.preset)}</p><details class="game-options"><summary>Kelola game</summary><div><button id="edit">${g.exists?'Edit game':'Perbaiki lokasi'}</button><button class="text-button muted" id="remove">Keluarkan dari koleksi</button></div></details><div class="actions session-actions"><button class="primary action-tile" id="start" ${state.session?'disabled':''}><span class="action-symbol" aria-hidden="true">＋</span><strong>${state.session?.gameId===g.id?'Sesi siap':'Siapkan sesi'}</strong><span class="action-caption">${state.session?.gameId===g.id?'Ajak teman lewat QR':'Sambungkan controller pemain'}</span></button><button id="launch" class="action-tile" aria-label="Buka game"><span class="action-symbol" aria-hidden="true">▷</span><strong>Play</strong><span class="action-caption">Buka game di PC</span></button></div>`;}
function bindGameActions(){
 const g=game();if(!g){root.querySelector('#hero-add')?.addEventListener('click',()=>editGame());return;}
 root.querySelector('#edit')!.addEventListener('click',()=>editGame(g));root.querySelector('#start')!.addEventListener('click',async()=>{await act('/session/'+g.id);if(state.session?.gameId===g.id)root.querySelector('#session-workspace')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});});root.querySelector('#launch')!.addEventListener('click',()=>act('/launch/'+g.id));root.querySelector('#remove')!.addEventListener('click',async()=>{if(confirm(`Keluarkan ${g.name} dari BeeStation? Instalasi dan save tidak dihapus.`))await act('/game/'+g.id,'DELETE');});
}
function gameArtwork(g?:Game){const id=g?.target.match(/^steam:\/\/rungameid\/(\d{1,12})$/)?.[1];return g?.cover??g?.artwork??(id?`/covers/steam-${id}.jpg`:null);}
function syncSoundControl(){
 const button=root.querySelector<HTMLButtonElement>('#background-sound')!,active=trailerSoundEnabled&&trailerSoundUnlocked;
 button.setAttribute('aria-label',active?'Matikan suara trailer':'Aktifkan suara trailer');button.title=button.getAttribute('aria-label')!;button.setAttribute('aria-pressed',String(active));
 button.innerHTML=`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4Z"/>${active?'<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>':'<path d="m16 9 5 6m0-6-5 6"/>'}</svg>`;
}
function unlockSound(){
 trailerSoundUnlocked=true;
 try{soundContext??=new AudioContext();if(soundContext.state==='suspended')void soundContext.resume().catch(()=>{});}catch{}
 syncBackdropAudio();syncSoundControl();
}
function selectionSound(direction:number){
 if(!soundContext)return;
 const context=soundContext,oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
 oscillator.type='sine';oscillator.frequency.setValueAtTime(direction>=0?620:820,now);oscillator.frequency.exponentialRampToValueAtTime(direction>=0?820:620,now+.075);
 gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.07,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.11);
 oscillator.connect(gain);gain.connect(context.destination);oscillator.start(now);oscillator.stop(now+.12);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
}
function holdTone(from:number,to:number,duration:number,volume:number){
 if(!soundContext)return()=>{};
 const context=soundContext,oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;let ended=false;
 oscillator.type='sine';oscillator.frequency.setValueAtTime(from,now);oscillator.frequency.exponentialRampToValueAtTime(to,now+duration);
 gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
 oscillator.connect(gain);gain.connect(context.destination);oscillator.start(now);oscillator.stop(now+duration+.02);oscillator.onended=()=>{ended=true;oscillator.disconnect();gain.disconnect();};
 return()=>{if(ended)return;const time=context.currentTime;gain.gain.cancelScheduledValues(time);gain.gain.setTargetAtTime(.0001,time,.01);oscillator.stop(time+.04);};
}
function syncBackdropAudio(force=false){
 const video=root.querySelector<HTMLVideoElement>('.desktop-backdrop video'),audio=root.querySelector<HTMLAudioElement>('.desktop-backdrop audio');if(!video)return;
 const audible=trailerSoundEnabled&&trailerSoundUnlocked&&!document.hidden;
 video.volume=.3;video.muted=!audible||!!audio;
 if(!audio)return;audio.volume=.3;audio.muted=!audible;
 if(!audible||video.paused||video.seeking||video.readyState<3){audio.pause();return;}
 if(audio.readyState>0&&(force||Math.abs(audio.currentTime-video.currentTime)>.3))audio.currentTime=video.currentTime;
 if(audio.paused)void audio.play().catch(error=>{if(error.name==='NotAllowedError'&&root.querySelector('.desktop-backdrop audio')===audio){trailerSoundUnlocked=false;syncSoundControl();}});
}
function syncVideoControl(){
 const button=root.querySelector<HTMLButtonElement>('#background-motion')!;button.setAttribute('aria-label',videoPaused?'Putar video latar':'Jeda video latar');button.title=button.getAttribute('aria-label')!;button.setAttribute('aria-pressed',String(!videoPaused));button.innerHTML=videoPaused?'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m8 5 11 7-11 7Z" fill="currentColor"/></svg>':'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14m8-14v14" stroke="currentColor" stroke-width="3"/></svg>';
}
async function updateBackdrop(){
 const g=game(),cover=gameArtwork(g),key=g?`${g.id}|${cover??''}`:'empty';if(key===backdropKey)return;backdropKey=key;
 const backdrop=root.querySelector('.desktop-backdrop')!,button=root.querySelector<HTMLButtonElement>('#background-motion')!;
 backdrop.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media=>{media.pause();media.removeAttribute('src');media.load();});
 backdrop.innerHTML=cover?`<img src="${esc(cover)}" alt="">`:'';button.hidden=true;if(!g)return;
 let url:string|null=null;
 try{url=(await request('/api/admin/artwork/'+g.id)).video;}catch{const id=g.target.match(/^steam:\/\/rungameid\/(\d{1,12})$/)?.[1];if(id)url=`/covers/steam-${id}-1080.mp4`;}
 if(backdropKey!==key||!url)return;
 const video=document.createElement('video');video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='metadata';if(cover)video.poster=cover;video.src=url;
 video.onerror=()=>{video.pause();video.remove();if(backdropKey===key){backdrop.querySelector('audio')?.pause();button.hidden=true;}};backdrop.append(video);button.hidden=false;syncVideoControl();
 for(const event of ['playing','pause','waiting','seeking','seeked','timeupdate'])video.addEventListener(event,()=>syncBackdropAudio(event==='seeked'));
 syncBackdropAudio();
 if(!videoPaused)video.play().catch(()=>{if(backdropKey===key){videoPaused=true;syncVideoControl();}});
 try{const {audio:url}=await request('/api/admin/artwork/'+g.id+'?audio=true');if(backdropKey!==key||!url||video.error)return;
  const audio=document.createElement('audio');audio.preload='auto';audio.src=url;audio.onerror=()=>{audio.pause();audio.remove();syncBackdropAudio();};audio.addEventListener('loadedmetadata',()=>syncBackdropAudio(true));backdrop.append(audio);syncBackdropAudio(true);
 }catch{}
}
function selectGame(id:string,focus=false){
 cancelGalleryHold();
 const index=state.games.findIndex((g:Game)=>g.id===id);if(index<0)return;
 const previous=state.games.findIndex((g:Game)=>g.id===selected);unlockSound();if(selected!==id)selectionSound(index-previous);selected=id;
 root.querySelectorAll<HTMLButtonElement>('[data-game]').forEach((card,i)=>{const offset=i-index;card.style.setProperty('--offset',String(offset));card.classList.toggle('selected',offset===0);card.setAttribute('aria-pressed',String(offset===0));card.tabIndex=offset===0?0:-1;});
 root.querySelector<HTMLElement>('.hero-copy')!.innerHTML=galleryInfo(game());updateBackdrop();
 root.querySelector<HTMLElement>('.rail-progress')?.style.setProperty('--progress',String((index+1)/state.games.length));
 root.querySelector('#rail-position')!.textContent=`${String(index+1).padStart(2,'0')} / ${String(state.games.length).padStart(2,'0')}`;
 if(focus)root.querySelector<HTMLButtonElement>('[data-game].selected')!.focus({preventScroll:true});
}
function stepGame(direction:number,focus=false){const index=state.games.findIndex((g:Game)=>g.id===selected);selectGame(state.games[Math.max(0,Math.min(state.games.length-1,index+direction))]?.id??'',focus);}
function bindRail(rail:HTMLElement){
 let holdTimer:number|undefined,heldCard:HTMLElement|undefined,stopTone=()=>{};
 const cancelHold=()=>{clearTimeout(holdTimer);holdTimer=undefined;stopTone();stopTone=()=>{};heldCard?.classList.remove('holding');heldCard=undefined;};cancelGalleryHold=cancelHold;
 const startHold=(card:HTMLElement)=>{cancelHold();const id=card.dataset.game!;selectGame(id,true);heldCard=card;card.classList.add('holding');stopTone=holdTone(260,660,.7,.04);holdTimer=window.setTimeout(()=>{const open=card.isConnected&&!document.hidden&&!formOpen;cancelHold();if(open){holdTone(880,1174,.16,.06);changeGamesView('detail',id);}},700);};
 let pointer:{id:number;x:number;y:number;dragging:boolean}|undefined,suppressClick=false,lastDrag=-Infinity,wheelSum=0,wheelTime=0,wheelStep=-Infinity;
 const reset=()=>{cancelHold();pointer=undefined;rail.classList.remove('dragging');rail.style.setProperty('--drag-x','0px');};
 rail.onpointerdown=e=>{if(e.button!==0||!state.games.length)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,dragging:false};suppressClick=false;const card=(e.target as HTMLElement).closest<HTMLElement>('[data-game]');if(card)startHold(card);};
 rail.addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>12)cancelHold();});rail.addEventListener('pointerleave',cancelHold);
 rail.addEventListener('wheel',cancelHold,{passive:true});rail.addEventListener('focusout',e=>{if(!rail.contains(e.relatedTarget as Node))cancelHold();});rail.addEventListener('contextmenu',e=>{if((e.target as HTMLElement).closest('[data-game]'))e.preventDefault();});
 rail.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat){const card=(e.target as HTMLElement).closest<HTMLElement>('[data-game]');if(card)startHold(card);}}});rail.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();cancelHold();}});
 rail.onpointermove=e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(!pointer.dragging){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){reset();return;}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.2)return;pointer.dragging=true;rail.setPointerCapture(e.pointerId);rail.classList.add('dragging');}rail.style.setProperty('--drag-x',Math.max(-100,Math.min(100,dx))+'px');};
 rail.onpointerup=e=>{if(!pointer||pointer.id!==e.pointerId)return;const drag=pointer.dragging,dx=e.clientX-pointer.x;reset();if(drag){suppressClick=true;lastDrag=performance.now();if(Math.abs(dx)>=40)stepGame(dx<0?1:-1);}};
 // Touch starts with implicit capture on the card; transferring it to the rail also emits a child lost-capture event.
 rail.onpointercancel=reset;rail.onlostpointercapture=e=>{if(e.target===rail)reset();};
 rail.addEventListener('click',e=>{if(suppressClick&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}},true);
 rail.addEventListener('dblclick',e=>{if(performance.now()-lastDrag<400){e.preventDefault();e.stopImmediatePropagation();}},true);
 rail.closest<HTMLElement>('.library-scene')!.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey||!state.games.length)return;const delta=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?rail.clientHeight:1),index=state.games.findIndex((g:Game)=>g.id===selected),direction=Math.sign(delta);if(!direction)return;e.preventDefault();if(index===0&&direction<0||index===state.games.length-1&&direction>0)return;const now=performance.now();if(now-wheelStep<300)return;if(now-wheelTime>180||Math.sign(wheelSum)!==direction)wheelSum=0;wheelTime=now;wheelSum+=delta;if(Math.abs(wheelSum)>=40){stepGame(direction);wheelSum=0;wheelStep=now;}},{passive:false});
 rail.onkeydown=e=>{if(!state.games.length||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();stepGame(e.key==='ArrowRight'?1:-1,true);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();selectGame(state.games[e.key==='Home'?0:state.games.length-1].id,true);}};
}
function galleryInfo(g?:Game){return `<h1>${g?esc(g.name):'Koleksi game kamu'}</h1>${g?'':'<p class="muted">Tambahkan game dari PC untuk mulai bermain.</p>'}`;}
function changeGamesView(next:'gallery'|'detail',id=selected){cancelGalleryHold();if(formOpen||!state.games.some((g:Game)=>g.id===id))return;selected=id;gamesView=next;render();scrollTo(0,0);viewAnimation?.cancel();const page=root.querySelector<HTMLElement>('#page')!;if(!matchMedia('(prefers-reduced-motion:reduce)').matches)viewAnimation=page.animate([{opacity:0,transform:`translateY(${next==='detail'?16:-16}px) scale(.985)`},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.22,.75,.2,1)'});const focus=page.querySelector<HTMLElement>(next==='detail'?'#back-games':'[data-game].selected');focus?.focus({preventScroll:true});}
function renderGameDetail(page:HTMLElement){const g=game();if(!g){gamesView='gallery';renderPlay(page);return;}
 const qrActive=!!(state.session?.gameId===g.id&&state.phoneUrls.length);
 const otherSession=state.session&&state.session.gameId!==g.id,activeName=state.games.find((entry:Game)=>entry.id===state.session?.gameId)?.name??'game lain';
 page.innerHTML=`<section class="game-detail"><div class="detail-topline"><button id="back-games" class="text-button">← Games</button><span class="detail-status">${state.session?.gameId===g.id?'<i class="status-dot"></i>Sesi aktif':'Siap untuk bermain bersama'}</span></div><div class="session-board"><div class="session-main"><div class="detail-heading"><div class="detail-poster" aria-hidden="true">${(g.poster??g.cover??g.icon)?`<img src="${esc(g.poster??g.cover??g.icon)}" alt="">`:'<span>◎</span>'}</div><div class="hero"><section class="hero-copy">${gameInfo(g)}</section></div></div>${otherSession?'':`<section class="players-section approved-section"><div class="section-heading"><div><p class="eyebrow">TIM KAMU</p><h2>Pemain siap <span id="player-count" class="count"></span></h2></div>${state.session?`<div class="actions"><button id="pause">${state.session.paused?'Lanjutkan input':'Hentikan semua input'}</button><button id="end" class="danger">Akhiri sesi</button></div>`:''}</div><p class="muted small">Pemain yang sudah disetujui. Sentuh tombol di HP untuk memeriksa input.</p><div class="player-grid" id="players"></div></section>`}</div>${otherSession?`<section class="panel active-session-notice"><h2>Sesi ${esc(activeName)} masih aktif</h2><p class="muted">Buka sesi tersebut untuk mengatur pemain atau mengakhirinya.</p><button id="show-active-session">Buka sesi aktif</button></section>`:`<aside id="session-workspace" class="session-sidebar"><aside class="qr-panel panel"><p class="eyebrow">GABUNG KE SESI</p><h2>Pindai &amp; bergabung.</h2><div id="nova-qr" class="nova-qr">${qrActive?'':`<p id="qr-hint" class="small muted">${state.session?'Alamat LAN belum tersedia':'Siapkan sesi untuk menampilkan QR'}</p>`}<div id="qr-card" class="nova-qr-frame" role="region" aria-label="QR sambungan HP" ${qrActive?'':'hidden'}><div class="nova-qr-card"><div class="qr-space">${qrActive?'<canvas id="qr" aria-label="QR sambungan HP"></canvas>':''}</div><p>Pindai dengan kamera HP<br><span>Satu Wi-Fi dengan PC ini</span></p></div></div></div><div id="addresses"></div><p class="small muted">Pindai QR · satu Wi-Fi · tunggu persetujuan host</p></aside><section class="waiting-section panel"><div class="section-heading"><div><p class="eyebrow">PERSETUJUAN HOST</p><h2>Ruang tunggu <span id="waiting-count" class="count"></span></h2></div></div><div id="waiting-players" class="waiting-list"></div></section></aside>`}</div></section>`;
 page.querySelector('#back-games')!.addEventListener('click',()=>changeGamesView('gallery'));page.querySelector('#show-active-session')?.addEventListener('click',()=>changeGamesView('detail',state.session.gameId));bindGameActions();
 page.querySelector('#pause')?.addEventListener('click',()=>act('/pause','POST',{paused:!state.session.paused}));page.querySelector('#end')?.addEventListener('click',()=>act('/session','DELETE'));
}
function renderPlay(page:HTMLElement){
 const index=state.games.findIndex((g:Game)=>g.id===selected);
 page.innerHTML=`<section class="library-scene" aria-label="Pilih game"><div class="section-heading library-heading"><span class="collection-label">KOLEKSI GAME <span class="count">${state.games.length}</span></span><button id="add-game">＋ Tambah game</button></div>
 <div class="hero"><section class="hero-copy">${galleryInfo(game())}</section></div>
 <div class="filmstrip"><div class="game-rail" role="group" aria-roledescription="carousel" aria-label="Koleksi game">${state.games.map((item:Game,i:number)=>`<button class="game-card ${i===index?'selected':''}" data-game="${item.id}" aria-label="${esc(item.name)}" aria-description="Tahan 0,7 detik untuk membuka ruang sesi" aria-pressed="${i===index}" tabindex="${i===index?0:-1}" style="--offset:${i-index}"><span class="hold-progress" aria-hidden="true"><span></span></span><span class="card-art" aria-hidden="true">${esc(item.name.split(/\s+/).map(w=>w[0]).join('').slice(0,3).toUpperCase())}</span>${(item.cover??item.poster??item.artwork??item.icon)?`<img src="${esc(item.cover??item.poster??item.artwork??item.icon)}" alt="" draggable="false" decoding="async" fetchpriority="${i===index?'high':'auto'}">`:''}</button>`).join('')}${!state.games.length?'<button class="game-card empty-card selected" id="empty-add"><span aria-hidden="true">＋</span><strong>Tambahkan game pertamamu</strong><small>Pilih dari koleksi di PC.</small></button>':''}</div>
 ${state.games.length?`<div class="rail-navigation"><span id="rail-position" aria-live="polite" aria-atomic="true">${String(index+1).padStart(2,'0')} / ${String(state.games.length).padStart(2,'0')}</span><span class="rail-progress" style="--progress:${(index+1)/state.games.length}" aria-hidden="true"><span></span></span></div>`:''}</div>
 </section>
 `;
 page.querySelectorAll<HTMLButtonElement>('[data-game]').forEach(card=>{card.onclick=()=>selectGame(card.dataset.game!,true);});
 bindRail(page.querySelector<HTMLElement>('.game-rail')!);
 ['add-game','empty-add'].forEach(id=>page.querySelector('#'+id)?.addEventListener('click',()=>editGame()));
}
function render(){
 if(!state||formOpen)return;
 cancelGalleryHold();studio?.dispose();studio=undefined;root.classList.toggle('gallery-open',tab==='play'&&gamesView==='gallery');document.body.classList.toggle('gallery-mode',tab==='play'&&gamesView==='gallery');document.body.classList.toggle('detail-mode',tab==='play'&&gamesView==='detail');
 const page=root.querySelector<HTMLDivElement>('#page')!;root.querySelector('#session-badge')!.textContent=state.session?'● Sesi aktif':'○ Sesi belum aktif';updateBackdrop();
 if(tab==='settings'){
 page.innerHTML=`<div class="section-heading"><div><p class="eyebrow">SIAPKAN RUANG BERMAIN</p><h1>Pengaturan</h1></div></div><div class="settings-grid"><section class="panel"><h2>Kesiapan PC</h2><p>Windows x64 · WebView2 · host lokal</p><p><b>${state.xinput.length} controller XInput terdeteksi</b> dari empat slot Windows. Controller fisik ikut dihitung.</p><p>Controller virtual memerlukan ViGEmBus 1.22.0. Persetujuan pemain akan memeriksa driver dan menampilkan masalah bila belum tersedia.</p><p>Maksimal 4 pemain per sesi pada Xbox maupun DS4. Jumlah pemain yang dapat dimainkan tetap mengikuti dukungan game.</p></section><section class="panel"><h2>Jaringan lokal</h2><p>${esc(state.note)}</p><p>Profil Umum/Public tetap bisa dipakai. Jika HP terblokir, tombol ini meminta izin Windows untuk executable BeeStation ini, port TCP host aktif, dan subnet lokal saja. Berlaku pada Public dan Private.</p><button id="allow-lan" class="primary">Izinkan akses HP di Windows</button><p>HTTP/WebSocket LAN ini tidak terenkripsi. Tidak ada cloud atau port forwarding.</p><p>Simpanan ada di %LOCALAPPDATA%\\BeeHooks. Menghapus kartu tidak menghapus game.</p></section></div>`;page.querySelector("#allow-lan")!.addEventListener("click",async()=>{try{const result=await request("/api/admin/firewall","POST",{});toast(result.message);}catch(e){toast(String(e));}});return;}
 if(tab==='layouts'){
 page.innerHTML=`<p class="eyebrow">SESUAI CARA BERMAINMU</p><h1>Controller Studio</h1><div id="studio-root"></div>${game()?`<section class="panel"><h2>Profil ${esc(game()!.name)}</h2><p>Pilihan profil: ${esc(game()!.profile?.name??game()!.preset)}. Duplikasi menyalin profil ini ke game lain dalam koleksi.</p><div class="actions"><button id="duplicate">Duplikasi profil</button><button id="export">Ekspor layout</button><button id="proof">Catat hasil uji</button><label class="button">Impor layout<input type="file" id="import" accept=".json" hidden></label></div></section>`:'<p>Tambahkan dan pilih game untuk menyimpan profil.</p>'}`;
 const g=game();if(g){studio=mountStudio(page.querySelector<HTMLElement>('#studio-root')!,state.games,g.id,id=>{selected=id;render();});page.querySelector('#proof')!.addEventListener('click',()=>{if(!studio||studio.canLeave())recordProof(g);});page.querySelector('#duplicate')!.addEventListener('click',()=>{if(!studio||studio.canLeave())copyProfile(g);});page.querySelector('#export')!.addEventListener('click',async()=>{try{downloadLayout(g.profile??await request('/api/admin/preset/'+g.preset));}catch(e){toast(String(e));}});page.querySelector<HTMLInputElement>('#import')!.onchange=async e=>{if(studio&&!studio.canLeave())return;try{const f=(e.target as HTMLInputElement).files?.[0];if(f){const profile=await readLayout(f);await request('/api/admin/game','POST',{...fields(g),profile});toast('Layout diimpor.');await refresh();}}catch(e){toast(String(e));}};}return;}
 if(gamesView==='detail')renderGameDetail(page);else renderPlay(page);
 renderPlayers();renderAddress();
}
function renderPlayers(){
 const approved=state.players.filter((p:any)=>p.approved),waiting=state.players.filter((p:any)=>!p.approved);
 const counter=root.querySelector('#player-count');if(counter)counter.textContent=`${approved.length}/${state.maxPlayers}`;
 const waitCount=root.querySelector('#waiting-count');if(waitCount)waitCount.textContent=String(waiting.length);
 for(const [id,entries,pending] of [['players',approved,false],['waiting-players',waiting,true]] as const){
  const panel=root.querySelector<HTMLElement>('#'+id);if(!panel)continue;
  const signature=JSON.stringify(entries.map((p:any)=>[p.id,p.name,p.color]));
  if(panel.dataset.members!==signature){panel.dataset.members=signature;panel.innerHTML=entries.length?entries.map((p:any)=>`<article class="player panel ${pending?'pending-player':''}" data-player="${esc(p.id)}" style="--player:${p.color}"><div class="player-top"><span class="avatar">${esc(p.name.slice(0,1))}</span><div><h3>${esc(p.name)}</h3><p class="small muted player-status"></p></div></div>${pending?'':'<p class="input-readout"></p>'}<div class="actions">${pending?`<button class="primary" data-approve="${esc(p.id)}">Setujui</button>`:''}<button data-kick="${esc(p.id)}">${pending?'Tolak':'Keluarkan'}</button></div></article>`).join(''):pending?'<div class="waiting-empty"><span class="waiting-mark" aria-hidden="true">◎</span><p>Belum ada permintaan</p><span class="muted small">Pemain yang memindai QR dan mengisi nama akan muncul di sini.</span></div>':'<div class="empty-players"><span aria-hidden="true">◎</span><div><b>Tempat untuk tim kamu</b><p class="muted small">Setujui pemain dari ruang tunggu. Maksimal '+state.maxPlayers+' pemain dalam satu sesi.</p></div></div>';panel.querySelectorAll('[data-approve]').forEach(el=>el.addEventListener('click',()=>act('/player/'+(el as HTMLElement).dataset.approve+'/approve')));panel.querySelectorAll('[data-kick]').forEach(el=>el.addEventListener('click',()=>act('/player/'+(el as HTMLElement).dataset.kick+'/kick')));}
  panel.querySelectorAll<HTMLElement>('[data-player]').forEach((card,i)=>{const p=entries[i];card.querySelector('.player-status')!.textContent=pending?'Menunggu persetujuan':p.connected?(p.idleMs>500?'Input netral · menunggu':'Terhubung'):'Menyambungkan ulang · reservasi 60 dtk';const input=card.querySelector('.input-readout');if(input)input.innerHTML=`${esc(p.state.buttons.join(' + ')||'Semua tombol lepas')}<br><span class="muted small">Stik ${p.state.lx.toFixed(2)}, ${p.state.ly.toFixed(2)} · ${p.frames} pesan</span>`;});
 }
}
async function renderAddress(){if(!state.session||!state.phoneUrls.length)return;const target=root.querySelector('#addresses');if(!target)return;if(!state.phoneUrls.includes(chosenAddress))chosenAddress=state.phoneUrls[0];target.innerHTML=`<select id="adapter" aria-label="Alamat adaptor LAN">${state.phoneUrls.map((u:string)=>`<option ${u===chosenAddress?'selected':''}>${esc(u)}</option>`).join('')}</select><p class="small">${esc(chosenAddress)}</p>`;target.querySelector('select')!.onchange=e=>{chosenAddress=(e.target as HTMLSelectElement).value;renderAddress();};await QRCode.toCanvas(root.querySelector('#qr'),chosenAddress+'/controller.html#'+state.session.invite,{width:208,margin:4,errorCorrectionLevel:'M',color:{dark:'#121620',light:'#ffffff'}});}
async function act(path:string,method='POST',body:unknown={}){try{await request('/api/admin'+path,method,method==='DELETE'?undefined:body);await refresh();}catch(e){toast(String(e));}}
function fields(g:Game){return{id:g.id,name:g.name,target:g.target,preset:g.preset,driver:g.driver,cover:g.cover,profile:g.profile,proof:g.proof};}
async function editGame(g?:Game,duplicate=false){
 formOpen=true;const dialog=root.querySelector<HTMLDialogElement>('#game-dialog')!;
 dialog.innerHTML=`<form id="game-form"><div class="section-heading"><h2>${g?'Edit game':'Tambah game'}</h2><button type="button" id="cancel" aria-label="Tutup">×</button></div><p class="muted">Pilih game milikmu. Preset tidak menambahkan game otomatis.</p><label>Nama game<input name="name" required maxlength="100" value="${esc(g?.name)}"></label><label>Executable / shortcut / target launcher<div class="input-row"><input name="target" required value="${esc(g?.target)}"><button type="button" id="browse">Pilih…</button></div></label><button type="button" id="discover">Cari instalasi Steam / Epic</button><div id="discovered"></div><div class="two-col"><label>Preset<select name="preset">${['umum','dungeons','brawlhalla','overcooked2'].map(n=>`<option ${n===g?.preset?'selected':''}>${n}</option>`).join('')}</select></label><label>Keluaran controller<select name="driver"><option value="xbox">Xbox / XInput</option><option value="ds4" ${g?.driver==='ds4'?'selected':''}>DualShock 4 · uji kompatibilitas</option></select></label></div><label>Sampul opsional<div class="input-row"><input name="cover" value="${esc(g?.cover)}" readonly><button type="button" id="cover">Pilih…</button><button type="button" id="clear-cover">Hapus</button></div></label>${duplicate?'<label>Nama profil duplikat<input name="profileName" maxlength="80" value="Profil pribadi" required></label><p class="muted small">Layout pribadi dapat disesuaikan tiap HP setelah tersambung.</p>':''}<p class="small muted">Pemetaan preset masih perlu diverifikasi di game.</p><p id="form-error" role="alert"></p><button class="primary" type="submit">Simpan game</button></form>`;
 dialog.showModal();const form=dialog.querySelector<HTMLFormElement>('form')!;const input=(n:string)=>form.elements.namedItem(n) as HTMLInputElement;
 dialog.querySelector('#cancel')!.addEventListener('click',()=>dialog.close());dialog.onclose=()=>{formOpen=false;render();};
 dialog.querySelector('#browse')!.addEventListener('click',async()=>{try{const v=await request('/api/admin/pick','POST',{cover:false});if(v.path)input('target').value=v.path;}catch(e){toast(String(e));}});
 dialog.querySelector('#cover')!.addEventListener('click',async()=>{try{const v=await request('/api/admin/pick','POST',{cover:true});if(v.path)input('cover').value=v.path;}catch(e){toast(String(e));}});dialog.querySelector('#clear-cover')!.addEventListener('click',()=>input('cover').value='');
 dialog.querySelector('#discover')!.addEventListener('click',async()=>{try{const found=await request('/api/admin/discover');const list=dialog.querySelector('#discovered')!;list.innerHTML=found.map((item:any,i:number)=>`<button type="button" data-found="${i}">${esc(item.name)} <small>${esc(item.platform)}</small></button>`).join('')||'<p>Tidak ada instalasi ditemukan. Gunakan Pilih…</p>';list.querySelectorAll('[data-found]').forEach(el=>el.addEventListener('click',()=>{const item=found[Number((el as HTMLElement).dataset.found)];input('name').value=item.name;input('target').value=item.target;input('preset').value=/Dungeons/i.test(item.name)?'dungeons':/Brawlhalla/i.test(item.name)?'brawlhalla':/Overcooked/i.test(item.name)?'overcooked2':'umum';list.innerHTML='';}));}catch(e){toast(String(e));}});
 form.onsubmit=async e=>{e.preventDefault();try{let profile=g?.profile??null;if(duplicate){const preset=await request('/api/admin/preset/'+input('preset').value);profile={...preset,name:input('profileName').value};}else if(g?.preset!==input('preset').value)profile=null;const value=await request('/api/admin/game','POST',{id:g?.id??'',name:input('name').value,target:input('target').value,preset:input('preset').value,driver:input('driver').value,cover:input('cover').value||null,profile,proof:g?.proof??null});if(value.duplicate){selected=value.duplicate;toast('Game sudah ada; entri tersebut dipilih.');}else selected=value.id;dialog.close();await refresh();}catch(e){dialog.querySelector('#form-error')!.textContent=String(e);}};
}
async function copyProfile(source:Game){
 const destinations:Game[]=state.games.filter((g:Game)=>g.id!==source.id);
 if(!destinations.length){toast('Tambahkan game tujuan dahulu untuk menyalin profil.');return;}
 const dialog=root.querySelector<HTMLDialogElement>('#game-dialog')!;formOpen=true;
 dialog.innerHTML=`<form><h2>Duplikasi profil</h2><label>Game tujuan<select name="destination">${destinations.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></label><label>Nama profil<input name="name" required maxlength="80" value="${esc(source.profile?.name??source.preset)} · salinan"></label><p class="small muted">Profil asal dipertahankan. Profil bersama game tujuan diganti; layout pribadi HP tetap terpisah.</p><div class="actions"><button class="primary">Simpan salinan</button><button type="button" id="cancel">Batal</button></div><p role="alert" id="form-error"></p></form>`;
 dialog.onclose=()=>{formOpen=false;render();};dialog.showModal();dialog.querySelector('#cancel')!.addEventListener('click',()=>dialog.close());
 dialog.querySelector('form')!.onsubmit=async e=>{e.preventDefault();try{const data=new FormData(e.target as HTMLFormElement);const target=destinations.find(g=>g.id===data.get('destination'))!;const profile={...structuredClone(source.profile??await request('/api/admin/preset/'+source.preset)),name:data.get('name')};await request('/api/admin/game','POST',{...fields(target),profile});dialog.close();await refresh();toast('Profil disalin ke '+target.name);}catch(e){dialog.querySelector('#form-error')!.textContent=String(e);}};
}
function recordProof(g:Game){
 const dialog=root.querySelector<HTMLDialogElement>('#game-dialog')!;formOpen=true;const proof=g.proof;
 dialog.innerHTML=`<form><h2>Catat hasil uji nyata</h2><p class="muted">Isi setelah bermain langsung. Jumlah koneksi HP atau perangkat Windows saja belum membuktikan jumlah pemain.</p><label>Hasil<select name="status"><option value="settings">Perlu pengaturan tambahan</option><option value="verified">Pemain terverifikasi lewat uji nyata</option><option value="untested">Belum diuji</option></select></label><label>Jumlah pemain yang berhasil<input name="players" type="number" min="0" max="${Math.max(state.maxPlayers,proof?.players??0)}" value="${proof?.players??0}" required></label><label>Tanggal<input name="date" type="date" required value="${esc(proof?.date??new Date().toLocaleDateString('en-CA'))}"></label><label>Versi/build game<input name="gameVersion" maxlength="100" required value="${esc(proof?.gameVersion)}"></label><label>Pengaturan Steam Input per game<input name="steamInput" maxlength="200" value="${esc(proof?.steamInput)}"></label><label>Bukti dan catatan<input name="notes" maxlength="1500" required value="${esc(proof?.notes)}"></label><div class="actions"><button class="primary">Simpan laporan pengguna</button><button id="cancel" type="button">Batal</button></div><p role="alert" id="form-error"></p></form>`;
 dialog.onclose=()=>{formOpen=false;render();};dialog.showModal();dialog.querySelector('#cancel')!.addEventListener('click',()=>dialog.close());
 dialog.querySelector('form')!.onsubmit=async e=>{e.preventDefault();try{const d=new FormData(e.target as HTMLFormElement);const proof=Object.fromEntries(d);await request('/api/admin/game','POST',{...fields(g),proof:{...proof,players:Number(d.get('players'))}});dialog.close();await refresh();}catch(e){dialog.querySelector('#form-error')!.textContent=String(e);}};
}
await refresh();setInterval(async()=>{try{state=await request('/api/admin/status');if(!formOpen&&tab==='play'){renderPlayers();}}catch{}},500);


