// Halftone Trail restored with the original dot spacing, opacity and fast fade.
export function mountHalftoneBackground(host:HTMLElement){
 const canvas=document.createElement('canvas');canvas.className='halftone-background';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
 const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return;}
 const reduced=matchMedia('(prefers-reduced-motion:reduce)'),cell=10;
 let width=0,height=0,cols=0,rows=0,heat=new Float32Array(0),frame=0,last=0,pressed=false,previous:{x:number;y:number}|undefined;
 const schedule=()=>{if(!frame&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(draw);};
 function draw(now:number){frame=0;const decay=Math.pow(.925,Math.min(100,now-last||16.67)/16.67);last=now;ctx!.clearRect(0,0,width,height);ctx!.fillStyle='rgba(244,243,239,.55)';let active=false;
  for(let i=0;i<heat.length;i++){const value=heat[i]*decay;heat[i]=value<.015?0:value;if(!heat[i])continue;active=true;ctx!.beginPath();ctx!.arc((i%cols+.5)*cell,(Math.floor(i/cols)+.5)*cell,cell*.44*Math.sqrt(value),0,Math.PI*2);ctx!.fill();}
  if(active)schedule();else last=0;
 }
 function stamp(x:number,y:number,radius:number,strength:number){for(let row=Math.max(0,Math.floor((y-radius)/cell));row<Math.min(rows,Math.ceil((y+radius)/cell));row++)for(let col=Math.max(0,Math.floor((x-radius)/cell));col<Math.min(cols,Math.ceil((x+radius)/cell));col++){const d=Math.hypot((col+.5)*cell-x,(row+.5)*cell-y);if(d<radius){const index=row*cols+col;heat[index]=Math.max(heat[index],(1-d/radius)*strength);}}}
 const leave=()=>{previous=undefined;pressed=false;};
 const move=(e:PointerEvent)=>{if((e.target as Element).closest('footer')){leave();return;}if(reduced.matches||document.hidden||e.pointerType==='touch')return;const start=previous??{x:e.clientX,y:e.clientY},distance=Math.hypot(e.clientX-start.x,e.clientY-start.y),steps=Math.min(80,Math.max(1,Math.ceil(distance/6))),radius=(pressed?64:24+Math.min(20,distance/5))*1.1;for(let i=1;i<=steps;i++)stamp(start.x+(e.clientX-start.x)*i/steps,start.y+(e.clientY-start.y)*i/steps,radius,pressed?1:.45);previous={x:e.clientX,y:e.clientY};schedule();};
 const down=(e:PointerEvent)=>{if(reduced.matches||document.hidden||e.pointerType==='touch'||(e.target as Element).closest('footer'))return;pressed=true;previous={x:e.clientX,y:e.clientY};stamp(e.clientX,e.clientY,64*1.1,1);schedule();};
 const up=()=>{pressed=false;};
 const clear=()=>{cancelAnimationFrame(frame);frame=0;last=0;heat.fill(0);leave();ctx.clearRect(0,0,width,height);};
 const resize=()=>{width=innerWidth;height=innerHeight;cols=Math.ceil(width/cell);rows=Math.ceil(height/cell);heat=new Float32Array(cols*rows);const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);clear();};
 const visibility=()=>{if(document.hidden)clear();};
 resize();window.addEventListener('resize',resize);host.addEventListener('pointermove',move);host.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);host.addEventListener('pointerleave',leave);reduced.addEventListener('change',clear);document.addEventListener('visibilitychange',visibility);
 window.addEventListener('pagehide',()=>{clear();window.removeEventListener('resize',resize);host.removeEventListener('pointermove',move);host.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);host.removeEventListener('pointerleave',leave);reduced.removeEventListener('change',clear);document.removeEventListener('visibilitychange',visibility);},{once:true});
}
