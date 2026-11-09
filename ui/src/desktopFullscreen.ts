import {toast} from './shared';

export function mountDesktopFullscreen(button:HTMLButtonElement){
 type Bridge={postMessage(message:string):void;addEventListener(type:'message',handler:(event:MessageEvent)=>void):void;removeEventListener(type:'message',handler:(event:MessageEvent)=>void):void};
 const bridge=(window as Window&{chrome?:{webview?:Bridge}}).chrome?.webview;
 let active=false;
 const sync=(value:boolean)=>{active=value;const label=active?'Keluar layar penuh':'Layar penuh';button.setAttribute('aria-label',label);button.title=label+' (F11)';button.setAttribute('aria-pressed',String(active));button.innerHTML=active?'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M9 3v6H3m18 0h-6V3M3 15h6v6m6 0v-6h6"/></svg>':'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg>';};
 const change=()=>sync(!!document.fullscreenElement);
 const message=(event:MessageEvent)=>{if(event.data?.type==='desktop-fullscreen'&&typeof event.data.active==='boolean')sync(event.data.active);};
 const toggle=async()=>{try{if(bridge)bridge.postMessage('fullscreen:toggle');else if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();if(!bridge)change();}catch{toast('Layar penuh belum tersedia pada jendela ini.');}};
 const key=(event:KeyboardEvent)=>{if(bridge||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;if(event.key==='F11'){event.preventDefault();if(!event.repeat)void toggle();}else if(event.key==='Escape'&&document.fullscreenElement){event.preventDefault();void document.exitFullscreen().catch(()=>{});}};
 sync(false);button.addEventListener('click',toggle);document.addEventListener('keydown',key);document.addEventListener('fullscreenchange',change);bridge?.addEventListener('message',message);bridge?.postMessage('fullscreen:state');
 window.addEventListener('pagehide',()=>{button.removeEventListener('click',toggle);document.removeEventListener('keydown',key);document.removeEventListener('fullscreenchange',change);bridge?.removeEventListener('message',message);},{once:true});
}
