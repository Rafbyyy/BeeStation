export type Control = {id:string;label:string;mapping:string;x:number;y:number;size:number;type:'button'|'stick';enabled?:boolean|null;stickMode?:'analog'|'eightWay'|null};
export type Layout = {version:number;name:string;controls:Control[];deadZone:number;sensitivity:number;opacity:number;leftHanded:boolean;floatingStick:boolean;modes?:Partial<Record<'menu'|'inventory',Control[]>>;dpadStyle?:'joined'|'split';cameraSwipe?:boolean|null};
export const cameraSwipeEnabled=(layout:Layout,preset:string)=>layout.cameraSwipe??(preset==='umum');
export const mappings = ['a','b','x','y','up','down','left','right','lb','rb','ls','rs','lt','rt','start','back','leftStick','rightStick'];
export const esc = (value:unknown) => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function toast(message:string){const el=document.querySelector<HTMLDivElement>('#toast')!;el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),6000);}
export async function request(path:string,method='GET',body?:unknown,token?:string){
 const response=await fetch(path,{method,headers:{'Content-Type':'application/json',...(path.startsWith('/api/admin')?{'X-BeeHooks':'local'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('Respons host tidak terbaca.');}if(!response.ok)throw Error(data?.error??'Sambungan tidak diizinkan.');return data;
}
export function downloadLayout(layout:Layout){const link=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(layout,null,2)],{type:'application/json'}));link.href=url;link.download='BeeStation-layout.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function readLayout(file:File):Promise<Layout>{if(file.size>32768)throw Error('Layout maksimal 32 KB.');const l=JSON.parse(await file.text());if(l.version!==1||!Array.isArray(l.controls)||l.controls.length<1||l.controls.length>32)throw Error('Format layout tidak didukung.');return l;}
