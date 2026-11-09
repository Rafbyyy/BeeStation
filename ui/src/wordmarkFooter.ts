// Canvas adaptation of the Halftone Wordmark Footer supplied by the user.
export function mountWordmarkFooter(host:HTMLElement){
 const footer=document.createElement('footer');footer.className='gallery-wordmark';footer.setAttribute('aria-label','BeeStation');
 footer.innerHTML='<div class="wordmark-meta"><span>Satu layar. Banyak teman.</span><span>LOCAL PLAY · HINGGA 4 PEMAIN</span></div><canvas aria-hidden="true"></canvas><span class="wordmark-sr">BeeStation</span>';host.append(footer);
 const canvas=footer.querySelector('canvas')!,ctx=canvas.getContext('2d');if(!ctx){footer.classList.add('wordmark-fallback');return;}
 const reduced=matchMedia('(prefers-reduced-motion:reduce)'),gap=6;
 let width=0,height=0,dots=new Float32Array(0),frame=0,visible=false,alive=true,last=0,pointer={x:-1e5,y:-1e5},ring={x:0,y:0,time:-1e5};
 const wake=()=>{if(!frame&&visible&&!document.hidden&&alive)frame=requestAnimationFrame(draw);};
 function layout(){const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;width=Math.round(rect.width);height=Math.round(rect.height);const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);
  const mask=document.createElement('canvas');mask.width=width;mask.height=height;const m=mask.getContext('2d',{willReadFrequently:true});if(!m)return;
  m.font='800 100px "Segoe UI",Arial,sans-serif';let box=m.measureText('BeeStation');
  const size=100*Math.min(Math.max(1,width-16)/(box.actualBoundingBoxLeft+box.actualBoundingBoxRight),Math.max(1,height-16)/(box.actualBoundingBoxAscent+box.actualBoundingBoxDescent));
  m.font=`800 ${size}px "Segoe UI",Arial,sans-serif`;box=m.measureText('BeeStation');
  m.fillText('BeeStation',(width-box.actualBoundingBoxLeft-box.actualBoundingBoxRight)/2+box.actualBoundingBoxLeft,(height-box.actualBoundingBoxAscent-box.actualBoundingBoxDescent)/2+box.actualBoundingBoxAscent);
  const pixels=m.getImageData(0,0,width,height).data,values:number[]=[];
  for(let y=0;y<height;y+=gap)for(let x=0;x<width;x+=gap){let alpha=0;for(let sy=0;sy<3;sy++)for(let sx=0;sx<3;sx++){const px=Math.min(width-1,Math.floor(x+(sx+.5)*gap/3)),py=Math.min(height-1,Math.floor(y+(sy+.5)*gap/3));alpha+=pixels[(py*width+px)*4+3];}const coverage=alpha/(9*255);if(coverage>=.06)values.push(x+gap/2,y+gap/2,0,0,x+gap/2,y+gap/2,Math.sqrt(coverage)*gap*.47);}
  dots=new Float32Array(values);last=0;pointer={x:-1e5,y:-1e5};ring.time=-1e5;wake();
 }
 function draw(now:number){frame=0;const step=Math.min(2,(now-last||16.67)/16.67);last=now;ctx!.clearRect(0,0,width,height);let moving=false;const age=now-ring.time,ringRadius=age*.9;
  for(let i=0;i<dots.length;i+=7){let x=dots[i],y=dots[i+1],vx=dots[i+2],vy=dots[i+3];const hx=dots[i+4],hy=dots[i+5];if(!reduced.matches){let dx=x-pointer.x,dy=y-pointer.y,d=Math.hypot(dx,dy)+.001;if(d<80){const force=(1-d/80)*2.6*step;vx+=dx/d*force;vy+=dy/d*force;}if(age<900){dx=hx-ring.x;dy=hy-ring.y;d=Math.hypot(dx,dy)+.001;const band=1-Math.min(1,Math.abs(d-ringRadius)/26),force=band*3.2*(1-age/900)*step;vx+=dx/d*force;vy+=dy/d*force;}vx=(vx+(hx-x)*.05*step)*Math.pow(.84,step);vy=(vy+(hy-y)*.05*step)*Math.pow(.84,step);x+=vx*step;y+=vy*step;if(Math.abs(vx)+Math.abs(vy)>.02||Math.abs(x-hx)+Math.abs(y-hy)>.05)moving=true;else{x=hx;y=hy;vx=vy=0;}}else{x=hx;y=hy;vx=vy=0;}dots[i]=x;dots[i+1]=y;dots[i+2]=vx;dots[i+3]=vy;const warm=Math.min(1,Math.hypot(x-hx,y-hy)/28);ctx!.fillStyle=`rgb(${Math.round(233+12*warm)},${Math.round(228-32*warm)},${Math.round(218-137*warm)})`;ctx!.beginPath();ctx!.arc(x,y,dots[i+6],0,Math.PI*2);ctx!.fill();}
  if(!reduced.matches&&(moving||age<900))wake();else last=0;
 }
 const local=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
 const move=(e:PointerEvent)=>{if(reduced.matches||e.pointerType==='touch')return;pointer=local(e);wake();};
 const leave=()=>{pointer={x:-1e5,y:-1e5};wake();};
 const down=(e:PointerEvent)=>{if(reduced.matches||e.button!==0||e.pointerType==='touch')return;ring={...local(e),time:performance.now()};wake();};
 const reset=()=>{cancelAnimationFrame(frame);frame=0;last=0;pointer={x:-1e5,y:-1e5};ring.time=-1e5;for(let i=0;i<dots.length;i+=7){dots[i]=dots[i+4];dots[i+1]=dots[i+5];dots[i+2]=dots[i+3]=0;}wake();};
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;}else reset();};
 const wheel=(e:WheelEvent)=>{const scene=host.querySelector('.library-scene');if(!scene)return;const forwarded=new WheelEvent('wheel',{deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode,ctrlKey:e.ctrlKey,metaKey:e.metaKey,cancelable:true});scene.dispatchEvent(forwarded);if(forwarded.defaultPrevented)e.preventDefault();};
 const resize=new ResizeObserver(layout),intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;if(visible)reset();else{cancelAnimationFrame(frame);frame=0;last=0;}});resize.observe(canvas);intersection.observe(footer);
 footer.addEventListener('pointermove',move);footer.addEventListener('pointerleave',leave);footer.addEventListener('pointerdown',down);footer.addEventListener('wheel',wheel,{passive:false});reduced.addEventListener('change',reset);document.addEventListener('visibilitychange',visibility);document.fonts.ready.then(()=>{if(alive)layout();});
 window.addEventListener('pagehide',()=>{alive=false;cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();footer.removeEventListener('pointermove',move);footer.removeEventListener('pointerleave',leave);footer.removeEventListener('pointerdown',down);footer.removeEventListener('wheel',wheel);reduced.removeEventListener('change',reset);document.removeEventListener('visibilitychange',visibility);},{once:true});
}
