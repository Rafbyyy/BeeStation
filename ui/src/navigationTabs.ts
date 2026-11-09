export function mountNavigationTabs(nav:HTMLElement){
 const buttons=[...nav.querySelectorAll<HTMLButtonElement>('[data-tab]')];
 const indicator=document.createElement('span'),hover=document.createElement('span');
 indicator.className='nav-indicator';hover.className='nav-hover';
 for(const item of [hover,indicator]){item.setAttribute('aria-hidden','true');nav.append(item);}
 let highlighted:HTMLButtonElement|undefined;
 function position(element:HTMLElement,button:HTMLButtonElement){element.style.width=button.offsetWidth+'px';element.style.transform=`translateX(${button.offsetLeft}px)`;}
 function update(){const active=buttons.find(b=>b.classList.contains('active'));if(active)position(indicator,active);for(const b of buttons){if(b===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}if(highlighted)position(hover,highlighted);}
 function highlight(button?:HTMLButtonElement){highlighted=button;hover.classList.toggle('visible',!!button);if(button)position(hover,button);}
 const enter=(e:PointerEvent)=>{const button=(e.target as Element).closest<HTMLButtonElement>('[data-tab]');if(button&&e.pointerType!=='touch')highlight(button);};
 const leave=()=>highlight();
 const focus=(e:FocusEvent)=>{const button=e.target as HTMLButtonElement;if(button.matches('[data-tab]:focus-visible'))highlight(button);};
 const blur=(e:FocusEvent)=>{if(!nav.contains(e.relatedTarget as Node|null))highlight();};
 const keys=(e:KeyboardEvent)=>{if(e.altKey||e.ctrlKey||e.metaKey)return;const at=buttons.indexOf(document.activeElement as HTMLButtonElement);if(at<0)return;let next=at;if(e.key==='ArrowRight')next=(at+1)%buttons.length;else if(e.key==='ArrowLeft')next=(at-1+buttons.length)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();buttons[next].focus();};
 nav.addEventListener('pointerover',enter);nav.addEventListener('pointerleave',leave);nav.addEventListener('focusin',focus);nav.addEventListener('focusout',blur);nav.addEventListener('keydown',keys);
 const observer=new ResizeObserver(update);observer.observe(nav);for(const b of buttons)observer.observe(b);update();void document.fonts.ready.then(update);
 const initialFrame=requestAnimationFrame(()=>nav.classList.add('tabs-ready'));
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(initialFrame);observer.disconnect();nav.removeEventListener('pointerover',enter);nav.removeEventListener('pointerleave',leave);nav.removeEventListener('focusin',focus);nav.removeEventListener('focusout',blur);nav.removeEventListener('keydown',keys);},{once:true});
 return update;
}
