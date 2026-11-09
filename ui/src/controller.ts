import './style.css';
import './controller.css';
import {esc,request,toast,mappings,cameraSwipeEnabled,downloadLayout,readLayout,type Layout,type Control} from './shared';
import {prepareDungeonsLayout,controllerLabels,dungeonsFunctions} from './dungeons';
const root=document.querySelector<HTMLDivElement>('#app')!;
const studioMode=window.parent!==window&&new URLSearchParams(location.search).has('studio');let studioContext=0,studioRevision=0;document.body.classList.toggle('studio-preview',studioMode);
function notifyStudio(){if(!studioMode)return;const stage=root.querySelector<HTMLElement>('#stage')!,chosen=[...stage.querySelectorAll<HTMLElement>('[data-control]')].find(el=>el.dataset.control===selected);parent.postMessage({type:'studio-state',context:studioContext,revision:studioRevision,layout,selected,stageWidth:stage.clientWidth,stageHeight:stage.clientHeight,xPx:chosen?.offsetLeft,yPx:chosen?.offsetTop,controlWidth:chosen?.offsetWidth},location.origin);}
let invite=location.hash.slice(1),token='',info:any,layout:Layout,original:Layout,editing=false,selected='',socket:WebSocket|undefined,sequence=0,lastSent=0,lastAck=0,rtt=0,processingMs=0,dirty=false,connecting=false,stopped=false;
const pointers=new Map<number,{control:Control;el:HTMLElement;x:number;y:number;cx:number;cy:number;radius:number;dragX:number;dragY:number;direction?:Control|null}>();
let cameraTouch:{id:number;x:number;y:number;at:number;rx:number;ry:number}|undefined,cameraStop:ReturnType<typeof setTimeout>|undefined;
const dpadOffsets:Record<string,[number,number]>={'dpad-up':[0,-1],'dpad-down':[0,1],'dpad-left':[-1,0],'dpad-right':[1,0]};
const pendingStates:ReturnType<typeof snapshot>[]=[];
const storageKey='beehooks-device';let deviceKey=localStorage.getItem(storageKey);
if(!deviceKey){deviceKey=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(storageKey,deviceKey);}
function joinForm(message=''){
 root.innerHTML=`<main class="join-page"><a class="brand"><img class="bee" src="/favicon.svg" alt=""> BeeStation</a><section class="panel"><p class="eyebrow">SATU LAYAR. BANYAK TEMAN.</p><h1>Ikut bermain.</h1><p class="muted">Gunakan Wi-Fi yang sama dengan PC.</p><form id="join"><label>Nama pemain<input name="name" maxlength="32" required autocomplete="nickname" value="${esc(localStorage.getItem('beehooks-name')??'')}"></label>${!invite?'<label> kode dari QR tidak ditemukan. Pindai QR sesi dari PC.</label>':''}<button class="primary" ${invite?'':'disabled'}>Minta bergabung</button></form><p role="alert" id="join-error">${esc(message)}</p></section><p class="small muted">HP hanya mengirim input. Game tetap berjalan di PC.</p></main>`;
 root.querySelector<HTMLFormElement>('#join')!.onsubmit=async e=>{e.preventDefault();try{const name=(new FormData(e.target as HTMLFormElement).get('name') as string).trim();const joined=await request('/api/join','POST',{invite,name,deviceKey});token=joined.token;sessionStorage.setItem('beehooks-session',JSON.stringify({invite,token}));localStorage.setItem('beehooks-name',name);stopped=false;await waitApproval();}catch(e){root.querySelector('#join-error')!.textContent=String(e);}};
}
async function waitApproval(){
 try{info=await request('/api/player','GET',undefined,token);if(!info.approved){root.innerHTML=`<main class="join-page"><div class="brand"><img class="bee" src="/favicon.svg" alt=""> BeeStation</div><section class="panel"><p class="eyebrow">PERMINTAAN TERKIRIM</p><h1>Halo, ${esc(info.name)}.</h1><p class="muted">Menunggu persetujuan host di PC untuk ${esc(info.game)}.</p><div class="waiting">◎</div><p class="small muted">Controller baru dibuat setelah host menyetujui.</p></section></main>`;setTimeout(waitApproval,1500);return;}
 setLayout(info.layout);draw();connect();}catch(e){joinForm(String(e));}
}
function setLayout(next:Layout){
 const copy=structuredClone(next);layout=info.preset==='dungeons'?prepareDungeonsLayout(copy):copy;
}
function editableControls(){return layout.controls;}
function controlLabel(c:Control){return ['a','b','x','y'].includes(c.mapping)?c.mapping.toUpperCase():c.label;}
function draw(){
 root.innerHTML=`<div class="controller-shell" style="--player:${esc(info.color)}"><div class="controller-top"><div class="controller-player"><b>${esc(info.name)}</b><span class="muted"> / ${esc(info.game)}</span></div><div class="controller-status"><span id="connection" role="status">${studioMode?'Preview layout':'Menyambungkan ulang'}</span><span id="metrics">${studioMode?'Input game dinonaktifkan':'RTT jaringan — · proses host —'}</span></div><button id="edit" aria-label="Edit layout" title="Edit layout"><span>✎</span></button><button id="fullscreen" aria-label="Layar penuh"><span>⛶</span></button></div><div id="controller-content" class="controller-content"><div class="controller-stage" id="stage" aria-label="Area controller"></div><section id="editor" class="editor panel" hidden></section></div></div>`;
 const content=root.querySelector<HTMLElement>('#controller-content')!;let scrollTouch:{id:number;x:number;scrolling:boolean}|undefined;
 // Chrome does not reliably pan a rotated scroller; follow the controller's vertical axis.
 content.ontouchstart=e=>{const touch=e.touches[0];scrollTouch=editing&&matchMedia('(orientation:portrait)').matches&&e.touches.length===1&&e.target instanceof Element&&!e.target.closest('[data-control],button,input,select,a')?{id:touch.identifier,x:touch.clientX,scrolling:false}:undefined;};
 content.addEventListener('touchmove',e=>{
  const touch=[...e.touches].find(t=>t.identifier===scrollTouch?.id);if(!touch||!scrollTouch||!editing)return;
  const delta=touch.clientX-scrollTouch.x;if(!scrollTouch.scrolling&&Math.abs(delta)<6)return;
  scrollTouch.scrolling=true;content.scrollTop+=delta;scrollTouch.x=touch.clientX;e.preventDefault();
 },{passive:false});
 content.ontouchend=content.ontouchcancel=()=>{scrollTouch=undefined;};
 root.querySelector('#edit')!.addEventListener('click',()=>{if(editing)return;clearInput();editing=true;original=structuredClone(layout);selected=editableControls()[0].id;renderControls();renderEditor();});
 root.querySelector('#fullscreen')!.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();else await document.exitFullscreen?.();}catch{toast('Layar penuh tidak tersedia; controller tetap dapat dipakai.');}});
 renderControls();
}
function joinedDpad(stage:HTMLElement){
 if(layout.dpadStyle!=='joined'||!stage.clientWidth||!stage.clientHeight)return;
 const controls=layout.controls.filter(c=>Object.hasOwn(dpadOffsets,c.id)&&c.type==='button');if(controls.length!==4)return;
 const unit=Math.min(stage.clientWidth,stage.clientHeight*1.5),cell=Math.max(44,Math.min(controls.reduce((n,c)=>n+c.size,0)/4*unit,stage.clientWidth/3,stage.clientHeight/3));
 const x=controls.reduce((n,c)=>n+c.x,0)/4,y=controls.reduce((n,c)=>n+c.y,0)/4;
 return {controls,cell,x:Math.max(cell*1.5,Math.min(stage.clientWidth-cell*1.5,(layout.leftHanded?1-x:x)*stage.clientWidth)),y:Math.max(cell*1.5,Math.min(stage.clientHeight-cell*1.5,y*stage.clientHeight))};
}
function renderControls(){
 const controls=editing?layout.controls:layout.controls.filter(c=>c.enabled!==false);
 root.querySelector<HTMLElement>('#editor')!.hidden=!editing;root.querySelector<HTMLElement>('#edit')!.hidden=editing;
 const content=root.querySelector<HTMLElement>('#controller-content')!;content.classList.toggle('editing',editing);if(!editing)content.scrollTop=0;
 const stage=root.querySelector<HTMLDivElement>('#stage')!;stage.classList.toggle('editing',editing);stage.style.setProperty('--control-unit',Math.min(stage.clientWidth,stage.clientHeight*1.5)+'px');
 const joined=joinedDpad(stage),showCenter=joined&&controls.some(c=>Object.hasOwn(dpadOffsets,c.id));
 stage.innerHTML=(showCenter?`<div class="joined-dpad-center" aria-hidden="true" style="left:${joined.x}px;top:${joined.y}px;width:${joined.cell}px;height:${joined.cell}px;opacity:${layout.opacity}"></div>`:'')+controls.map(c=>{
  const offset=joined&&Object.hasOwn(dpadOffsets,c.id)&&dpadOffsets[c.id],position=offset?`left:${joined.x+offset[0]*joined.cell}px;top:${joined.y+offset[1]*joined.cell}px;width:${joined.cell}px;height:${joined.cell}px;`:`left:var(--float-x,${(layout.leftHanded?1-c.x:c.x)*100}%);top:var(--float-y,${c.y*100}%);`;
  return `<button class="touch-control ${c.id.startsWith('dpad-')?'dpad-control':''} ${offset?'dpad-joined':''} ${c.type==='stick'?'stick':''} ${c.stickMode==='eightWay'?'stick-eightway':''} ${editing&&c.id===selected?'chosen':''} ${c.enabled===false?'inactive':''}" data-control="${esc(c.id)}" data-mapping="${esc(c.mapping)}" aria-label="${esc(controlLabel(c))}" style="${position}--size:${c.size};opacity:${layout.opacity}">${c.type==='stick'?`${c.stickMode==='eightWay'?'<svg class="stick-directions" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5v10m0 70v10M5 50h10m70 0h10M18 18l7 7m50 50 7 7M18 82l7-7m50-50 7-7"/></svg>':''}<span class="stick-knob">${info.preset==='dungeons'&&c.mapping==='rightStick'?'Roll':''}</span>`:esc(controlLabel(c))}${editing&&c.enabled===false?'<small class="off-badge">OFF</small>':''}</button>`;
 }).join('');
 stage.querySelectorAll<HTMLElement>('[data-control]').forEach(el=>{
  const c=controls.find(c=>c.id===el.dataset.control)!;
  el.oncontextmenu=e=>e.preventDefault();
  el.onpointerdown=e=>{e.preventDefault();if(pointers.has(e.pointerId)||(!editing&&c.mapping==='rightStick'&&cameraTouch)||(c.type==='stick'&&[...pointers.values()].some(p=>p.el===el)))return;if(editing){selected=c.id;stage.querySelectorAll('.chosen').forEach(n=>n.classList.remove('chosen'));el.classList.add('chosen');if(studioMode)notifyStudio();else renderEditor();}else if(!socket||socket.readyState!==WebSocket.OPEN||connecting)return;
   const floating=layout.floatingStick&&c.type==='stick'&&(info.preset!=='dungeons'||c.mapping==='leftStick');
   if(!editing&&floating){const origin=localPoint(stage,e);el.style.setProperty('--float-x',origin.x+'px');el.style.setProperty('--float-y',origin.y+'px');}
   el.setPointerCapture(e.pointerId);const point=localPoint(el,e),drag=localPoint(stage,e),radius=parseFloat(getComputedStyle(el).width)/2,dpad=!editing&&c.type==='button'&&Object.hasOwn(dpadOffsets,c.id);pointers.set(e.pointerId,{control:c,el,x:point.x,y:point.y,cx:floating?point.x:radius,cy:floating?point.y:radius,radius,dragX:drag.x,dragY:drag.y,direction:dpad?null:undefined});if(!dpad)el.classList.add('pressed');if(!editing){move(e);if(c.type==='button'&&!dpad)queueState();}};
  el.onpointermove=move;
  const release=(e:PointerEvent)=>{const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);if(![...pointers.values()].some(p=>p.el===el))resetControl(el);if(p.direction!==undefined)updateDpadHighlights();if(!editing)queueState();};
  el.onpointerup=release;el.onpointercancel=release;el.onlostpointercapture=release;
 });
 const center=stage.querySelector<HTMLElement>('.joined-dpad-center');if(center&&!editing)center.onpointerdown=e=>stage.querySelector<HTMLElement>('.dpad-joined')?.onpointerdown?.(e);notifyStudio();
}
function updateDpadHighlights(){
 root.querySelectorAll<HTMLElement>('.dpad-control:not(.stick)').forEach(el=>{if(Object.hasOwn(dpadOffsets,el.dataset.control!))el.classList.toggle('pressed',[...pointers.values()].some(p=>p.direction?.id===el.dataset.control));});
}
function resetControl(el:HTMLElement){el.classList.remove('pressed');el.style.removeProperty('--float-x');el.style.removeProperty('--float-y');el.querySelector<HTMLElement>('.stick-knob')?.style.setProperty('transform','translate(0,0)');}
// Rotated touches can be delivered outside the stage; resolve their visible control before capture.
document.addEventListener('pointerdown',e=>{
 if(e.target instanceof Element&&e.target.closest('[data-control],.joined-dpad-center,#editor,.controller-top'))return;
 const stage=root.querySelector<HTMLElement>('#stage');if(!stage)return;
 const hit=[...stage.querySelectorAll<HTMLElement>('[data-control],.joined-dpad-center')].reverse().find(el=>{const r=el.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});
 if(hit){hit.onpointerdown?.(e);return;}
 if(editing||studioMode||!layout)return;const point=localPoint(stage,e);if(point.x<0||point.y<0||point.x>stage.clientWidth||point.y>stage.clientHeight)return;
 const controls=layout.controls.filter(c=>c.enabled!==false),right=point.x>=stage.clientWidth/2;
 if(right&&cameraSwipeEnabled(layout,info.preset)){e.preventDefault();if(cameraTouch||[...pointers.values()].some(p=>p.control.mapping==='rightStick')||socket?.readyState!==WebSocket.OPEN||connecting)return;stage.setPointerCapture(e.pointerId);cameraTouch={id:e.pointerId,x:point.x,y:point.y,at:performance.now(),rx:0,ry:0};return;}
 if(!layout.floatingStick)return;
 const stick=[...stage.querySelectorAll<HTMLElement>('.stick')].find(el=>{const c=controls.find(c=>c.id===el.dataset.control)!;return (info.preset!=='dungeons'||c.mapping==='leftStick')&&((layout.leftHanded?1-c.x:c.x)>=.5)===right;});stick?.onpointerdown?.(e);
},true);
function moveCamera(e:PointerEvent){
 const camera=cameraTouch;if(!camera||camera.id!==e.pointerId||editing)return;const stage=root.querySelector<HTMLElement>('#stage');if(!stage)return;e.preventDefault();
 const point=localPoint(stage,e),now=performance.now(),dt=Math.max(8,Math.min(50,now-camera.at)),dx=point.x-camera.x,dy=point.y-camera.y;camera.x=point.x;camera.y=point.y;camera.at=now;if(Math.hypot(dx,dy)<.5)return;
 const speed=Math.max(1,Math.min(stage.clientWidth,stage.clientHeight)*2.4),x=dx/dt*1000/speed*layout.sensitivity,y=dy/dt*1000/speed*layout.sensitivity,length=Math.max(1,Math.hypot(x,y)),wasNeutral=camera.rx===0&&camera.ry===0;camera.rx=x/length;camera.ry=y/length;
 clearTimeout(cameraStop);cameraStop=setTimeout(()=>{if(cameraTouch!==camera)return;camera.rx=camera.ry=0;queueState();},90);
 if(wasNeutral)queueState();else{dirty=true;send();}
}
function releaseCamera(e:PointerEvent){if(cameraTouch?.id!==e.pointerId)return;cameraTouch=undefined;clearTimeout(cameraStop);queueState();}
function clearCamera(){const id=cameraTouch?.id;cameraTouch=undefined;clearTimeout(cameraStop);const stage=root.querySelector<HTMLElement>('#stage');if(id!==undefined&&stage?.hasPointerCapture(id))stage.releasePointerCapture(id);}
document.addEventListener('pointermove',moveCamera,{passive:false});
for(const event of ['pointerup','pointercancel','lostpointercapture'] as const)document.addEventListener(event,releaseCamera,true);
function localPoint(element:HTMLElement,event:PointerEvent){
 const rect=element.getBoundingClientRect();
 return matchMedia('(orientation: portrait)').matches?{x:event.clientY-rect.top,y:rect.right-event.clientX}:{x:event.clientX-rect.left,y:event.clientY-rect.top};
}
function move(e:PointerEvent){const p=pointers.get(e.pointerId);if(!p)return;e.preventDefault();if(editing){const stage=root.querySelector<HTMLElement>('#stage')!;const point=localPoint(stage,e),joined=p.el.classList.contains('dpad-joined')?joinedDpad(stage):undefined;
 if(joined){const sign=layout.leftHanded?-1:1,xs=joined.controls.map(c=>layout.leftHanded?1-c.x:c.x),ys=joined.controls.map(c=>c.y),dx=Math.max(-Math.min(...xs)*stage.clientWidth,joined.cell*1.5-joined.x,Math.min((1-Math.max(...xs))*stage.clientWidth,stage.clientWidth-joined.cell*1.5-joined.x,point.x-p.dragX)),dy=Math.max(-Math.min(...ys)*stage.clientHeight,joined.cell*1.5-joined.y,Math.min((1-Math.max(...ys))*stage.clientHeight,stage.clientHeight-joined.cell*1.5-joined.y,point.y-p.dragY));for(const c of joined.controls){c.x+=sign*dx/stage.clientWidth;c.y+=dy/stage.clientHeight;}stage.querySelectorAll<HTMLElement>('.dpad-joined,.joined-dpad-center').forEach(el=>{el.style.left=parseFloat(el.style.left)+dx+'px';el.style.top=parseFloat(el.style.top)+dy+'px';});p.dragX=point.x;p.dragY=point.y;notifyStudio();return;}
 p.control.x=Math.max(.03,Math.min(.97,point.x/stage.clientWidth));if(layout.leftHanded)p.control.x=1-p.control.x;p.control.y=Math.max(.03,Math.min(.97,point.y/stage.clientHeight));p.el.style.left=(layout.leftHanded?1-p.control.x:p.control.x)*100+'%';p.el.style.top=p.control.y*100+'%';notifyStudio();return;}
 if(p.direction!==undefined){
  const hit=[...root.querySelectorAll<HTMLElement>('.dpad-control:not(.stick)')].find(el=>{if(!Object.hasOwn(dpadOffsets,el.dataset.control!))return false;const r=el.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});
  const next=hit?layout.controls.find(c=>c.id===hit.dataset.control)!:null;
  if(next!==p.direction){p.direction=next;updateDpadHighlights();queueState();}return;
 }
 const point=localPoint(p.el,e);p.x=point.x;p.y=point.y;if(p.control.type==='stick'){const [x,y]=stickValue(p);const knob=p.el.querySelector<HTMLElement>('.stick-knob')!;knob.style.transform=`translate(${x*p.radius*.45}px,${y*p.radius*.45}px)`;}dirty=true;
}
function stickValue(p:{x:number;y:number;cx:number;cy:number;radius:number;control:Control}){
 const x=(p.x-p.cx)/p.radius,y=(p.y-p.cy)/p.radius,length=Math.hypot(x,y);if(length<=layout.deadZone)return [0,0];
 const magnitude=Math.min(1,(Math.min(1,length)-layout.deadZone)/(1-layout.deadZone)*layout.sensitivity);
 if(p.control.stickMode==='eightWay'){const angle=Math.round(Math.atan2(y,x)/(Math.PI/4))*Math.PI/4;return [Math.cos(angle)*magnitude,Math.sin(angle)*magnitude].map(v=>Math.abs(v)<1e-8?0:v);}
 return [x/length*magnitude,y/length*magnitude];
}
function snapshot(){const state={seq:0,buttons:[] as string[],lx:0,ly:0,rx:0,ry:0,lt:0,rt:0};if(editing||document.hidden)return state;const buttons=new Set<string>();for(const p of pointers.values()){if(p.direction===null)continue;const m=(p.direction??p.control).mapping;if(m==='leftStick'||m==='rightStick'){const [x,y]=stickValue(p);if(m==='leftStick'){state.lx=x;state.ly=y;}else{state.rx=x;state.ry=y;}}else if(m==='lt'||m==='rt')state[m]=1;else buttons.add(m);}if(cameraTouch){state.rx=cameraTouch.rx;state.ry=cameraTouch.ry;}state.buttons=[...buttons];return state;}
function queueState(){
 // Preserve a press and release even when both happen between two send ticks.
 if(pendingStates.length>=12){clearInput();socket?.close();return;}
 pendingStates.push(snapshot());dirty=true;send();
}
function send(){if(socket?.readyState!==WebSocket.OPEN||connecting||document.hidden||performance.now()-lastSent<17)return;if(socket.bufferedAmount>4096){clearInput();socket.close();return;}const state=pendingStates.shift()??snapshot();state.seq=sequence++;socket.send(JSON.stringify(state));lastSent=performance.now();dirty=pendingStates.length>0;}
function clearInput(){clearCamera();pendingStates.length=0;pointers.clear();root.querySelectorAll<HTMLElement>('.touch-control').forEach(resetControl);dirty=true;if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({seq:sequence++,buttons:[],lx:0,ly:0,rx:0,ry:0,lt:0,rt:0}));lastSent=performance.now();}}
function connect(){if(connecting||stopped||document.hidden)return;connecting=true;const current=new WebSocket(location.origin.replace('http','ws')+'/ws');socket=current;
 current.onopen=()=>current.send(JSON.stringify({token}));
 current.onmessage=e=>{if(socket!==current)return;const msg=JSON.parse(e.data);if(msg.type==='ready'){sequence=0;lastAck=performance.now();dirty=true;connecting=false;}else if(msg.type==='ack'){lastAck=performance.now();processingMs=msg.processingMs;}else if(msg.type==='pong'){rtt=performance.now()-msg.at;}};
 current.onclose=()=>{if(socket!==current)return;clearInput();connecting=false;setTimeout(async()=>{if(stopped||document.hidden)return;try{const next=await request('/api/player','GET',undefined,token);if(next.approved)connect();else{stopped=true;joinForm('Reservasi berakhir; minta persetujuan lagi.');}}catch{stopped=true;sessionStorage.removeItem('beehooks-session');joinForm('Sesi berakhir atau pemain dikeluarkan. Pindai QR aktif untuk bergabung kembali.');}},1000);};
 current.onerror=()=>current.close();
}
setInterval(()=>{if(info&&layout&&(dirty||performance.now()-lastSent>=100))send();},4);
setInterval(()=>{if(studioMode||!info||!layout)return;const now=performance.now();const status=root.querySelector('#connection');if(status)status.textContent=socket?.readyState!==WebSocket.OPEN||connecting?'Menyambungkan ulang':now-lastAck>500?'Koneksi lambat':'Terhubung';const metrics=root.querySelector('#metrics');if(metrics)metrics.textContent=`RTT jaringan ${rtt?rtt.toFixed(0)+' ms':'—'} · proses host ${processingMs.toFixed(2)} ms`;},250);
setInterval(()=>{if(socket?.readyState===WebSocket.OPEN&&!connecting&&!document.hidden)socket.send(JSON.stringify({type:'ping',at:performance.now()}));},1000);
document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden)socket?.close();else if(info?.approved)connect();});
window.addEventListener('pagehide',()=>{clearInput();socket?.close();});window.addEventListener('blur',clearInput);window.addEventListener('resize',()=>{clearInput();if(layout)renderControls();});
function renderEditor(){
 const editor=root.querySelector<HTMLElement>('#editor')!;const controls=editableControls(),c=controls.find(c=>c.id===selected)!;
 editor.innerHTML=`<div class="editor-title"><b>Pengaturan kontrol</b><span class="small muted">Geser tombol pada controller di atas. Pilih kontrol di sini untuk mengatur ukuran dan fungsinya. Input game dinetralkan selama mengedit.</span></div><div class="editor-fields"><label>Kontrol<select id="control">${controls.map(n=>`<option value="${esc(n.id)}" ${n.id===c.id?'selected':''}>${esc(controlLabel(n))}${n.enabled===false?" (nonaktif)":""}</option>`).join('')}</select></label><label>Fungsi<select id="mapping" aria-describedby="control-help">${mappings.filter(m=>(c.type==='stick'?m.endsWith('Stick'):!m.endsWith('Stick'))).map(m=>`<option ${m===c.mapping?'selected':''}>${m}</option>`).join('')}</select><span id="control-help" class="muted">${esc(info.preset==='dungeons'?dungeonsFunctions[c.mapping]:'Pemetaan tombol controller.')}</span></label><label><input id="enabled" type="checkbox" ${c.enabled!==false?"checked":""}>Kontrol aktif</label><label>Ukuran<input id="size" type="range" min=".04" max=".35" step=".01" value="${c.size}"></label><label>Dead zone<input id="deadZone" type="range" min="0" max=".5" step=".01" value="${layout.deadZone}"></label><label>Sensitivitas<input id="sensitivity" type="range" min=".2" max="2" step=".1" value="${layout.sensitivity}"></label><label>Transparansi<input id="opacity" type="range" min=".25" max="1" step=".05" value="${layout.opacity}"></label><label><input id="leftHanded" type="checkbox" ${layout.leftHanded?'checked':''}>Mode kidal</label><label><input id="floatingStick" type="checkbox" ${layout.floatingStick?'checked':''}>Stik mengikuti sentuhan</label><label><input id="cameraSwipe" type="checkbox" ${cameraSwipeEnabled(layout,info.preset)?'checked':''}>Geser kanan untuk kamera<span class="muted">Area kosong di kanan menggerakkan kamera. Aktifkan untuk game dengan kamera bebas.</span></label></div><div class="actions"><button id="reset">Gunakan default game</button><button id="duplicate">Duplikasi profil</button><button id="export">Ekspor layout</button><label class="button">Impor layout<input id="import" type="file" accept=".json" hidden></label></div><div class="actions editor-save"><button id="save" class="primary">Simpan</button><button id="cancel">Batal</button></div>`;
 editor.querySelector<HTMLSelectElement>('#control')!.onchange=e=>{selected=(e.target as HTMLSelectElement).value;renderControls();renderEditor();};
 editor.querySelector<HTMLSelectElement>('#mapping')!.onchange=e=>{clearInput();c.mapping=(e.target as HTMLSelectElement).value;c.label=controllerLabels[c.mapping]??c.mapping;renderControls();renderEditor();};
 editor.querySelector<HTMLInputElement>('#enabled')!.onchange=e=>{clearInput();c.enabled=(e.target as HTMLInputElement).checked;renderControls();editor.querySelector<HTMLSelectElement>('#control')!.selectedOptions[0].textContent=controlLabel(c)+(c.enabled===false?' (nonaktif)':'');};
 if(Object.keys(dpadOffsets).every(id=>layout.controls.some(c=>c.id===id))){const label=document.createElement('label');label.innerHTML='Tampilan D-pad<select id="dpad-style"><option value="joined">Menyatu</option><option value="split">Terpisah</option></select>';editor.querySelector('.editor-fields')!.append(label);const select=label.querySelector('select')!;select.value=layout.dpadStyle??'split';select.onchange=()=>{clearInput();layout.dpadStyle=select.value as Layout['dpadStyle'];renderControls();};}
 if(c.type==='stick'){const label=document.createElement('label');label.innerHTML='Model analog<select id="stick-mode"><option value="analog">Analog biasa · bebas</option><option value="eightWay">Analog 8 arah</option></select>';editor.querySelector('.editor-fields')!.append(label);const select=label.querySelector('select')!;select.value=c.stickMode??'analog';select.onchange=()=>{clearInput();c.stickMode=select.value as Control['stickMode'];renderControls();};}
 editor.querySelector<HTMLInputElement>('#size')!.oninput=e=>{const size=Number((e.target as HTMLInputElement).value);if(layout.dpadStyle==='joined'&&Object.hasOwn(dpadOffsets,c.id))for(const n of layout.controls.filter(n=>Object.hasOwn(dpadOffsets,n.id)))n.size=size;else c.size=size;renderControls();};
 for(const key of ['deadZone','sensitivity','opacity'] as const)editor.querySelector<HTMLInputElement>('#'+key)!.oninput=e=>{layout[key]=Number((e.target as HTMLInputElement).value);renderControls();};
 for(const key of ['leftHanded','floatingStick','cameraSwipe'] as const)editor.querySelector<HTMLInputElement>('#'+key)!.onchange=e=>{clearInput();layout[key]=(e.target as HTMLInputElement).checked;renderControls();};
 // Native range dragging fails on the visually rotated controller; use the same local coordinates as the sticks.
 editor.querySelectorAll<HTMLInputElement>('input[type=range]').forEach(input=>{
  const update=(e:PointerEvent)=>{e.preventDefault();const ratio=Math.max(0,Math.min(1,localPoint(input,e).x/input.clientWidth));input.valueAsNumber=Number(input.min)+ratio*(Number(input.max)-Number(input.min));input.dispatchEvent(new Event('input',{bubbles:true}));};
  input.onpointerdown=e=>{input.focus({preventScroll:true});input.setPointerCapture(e.pointerId);update(e);};
  input.onpointermove=e=>{if(input.hasPointerCapture(e.pointerId))update(e);};
  input.onpointerup=e=>{if(input.hasPointerCapture(e.pointerId)){update(e);input.releasePointerCapture(e.pointerId);input.dispatchEvent(new Event('change',{bubbles:true}));}};
  input.onpointercancel=e=>{if(input.hasPointerCapture(e.pointerId))input.releasePointerCapture(e.pointerId);};
 });
 root.querySelector<HTMLButtonElement>('#save')!.onclick=async()=>{try{clearInput();await request('/api/player/layout','POST',layout,token);editing=false;editor.hidden=true;renderControls();toast('Layout pribadi tersimpan di PC.');}catch(e){toast(String(e));}};
 root.querySelector<HTMLButtonElement>('#cancel')!.onclick=()=>{clearInput();setLayout(original);editing=false;editor.hidden=true;renderControls();};
 editor.querySelector('#reset')!.addEventListener('click',async()=>{try{setLayout(await request('/api/player/preset','GET',undefined,token));selected=editableControls()[0].id;renderControls();renderEditor();}catch(e){toast(String(e));}});
 editor.querySelector('#duplicate')!.addEventListener('click',async()=>{const name=prompt('Nama profil salinan',layout.name+' · salinan');if(name){try{const copy={...structuredClone(layout),name:name.slice(0,80)};await request('/api/player/layout/copy','POST',copy,token);layout=copy;renderEditor();toast('Salinan tersimpan. Simpan untuk mengaktifkannya.');}catch(e){toast(String(e));}}});
 const saved=document.createElement('select');saved.setAttribute('aria-label','Profil pribadi tersimpan');saved.innerHTML='<option value="">Pilih profil tersimpan…</option>';editor.querySelector('.editor-save')!.before(saved);request('/api/player/profiles','GET',undefined,token).then(profiles=>{saved.innerHTML='<option value="">Pilih profil tersimpan…</option>'+profiles.map((p:any,i:number)=>'<option value="'+i+'">'+esc(p.layout.name)+'</option>').join('');saved.onchange=()=>{if(saved.value==='')return;try{setLayout(profiles[Number(saved.value)].layout);selected=editableControls()[0].id;renderControls();renderEditor();}catch(e){toast(String(e));}};}).catch(e=>toast(String(e)));
 editor.querySelector('#export')!.addEventListener('click',()=>downloadLayout(layout));editor.querySelector<HTMLInputElement>('#import')!.onchange=async e=>{try{const f=(e.target as HTMLInputElement).files?.[0];if(f){const candidate=await readLayout(f);await request('/api/player/layout/validate','POST',candidate,token);setLayout(candidate);selected=editableControls()[0].id;renderControls();renderEditor();}}catch(e){toast(String(e));}};
}
if(studioMode){
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='studio-layout')return;
  try{studioContext=event.data.context;studioRevision=event.data.revision;const first=!info;info={name:'Preview',game:event.data.game,preset:event.data.preset,color:'#F5C451'};clearInput();setLayout(event.data.layout);editing=true;selected=layout.controls.some(c=>c.id===event.data.selected)?event.data.selected:layout.controls[0].id;if(first)draw();else renderControls();}catch(e){parent.postMessage({type:'studio-error',message:String(e)},location.origin);}
 });
 parent.postMessage({type:'studio-ready'},location.origin);
}else{
try{const saved=JSON.parse(sessionStorage.getItem('beehooks-session')??'null');if(saved&&saved.invite===invite){token=saved.token;await waitApproval();}else joinForm();}catch{joinForm();}






}
