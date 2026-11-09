import type {Control,Layout} from './shared';
import preset from '../../src/BeeHooks.Core/Presets/dungeons.json';

const directions=['up','down','left','right'];
export function isDpad(c:Control){return c.type==='button'&&directions.some(d=>c.id==='dpad-'+d||c.id===d&&c.mapping===d);}
export function setDpadModel(layout:Layout,model:'none'|'joined'|'split'){
 const controls=layout.controls.filter(isDpad);
 if(model==='none'){for(const c of controls)c.enabled=false;return;}
 const chosen=directions.map(d=>layout.controls.find(c=>c.id==='dpad-'+d)??controls.find(c=>c.id===d));
 if(chosen.some(c=>c&&c.type!=='button'))throw Error('ID D-pad sudah dipakai kontrol lain.');
 if(layout.controls.length+chosen.filter(c=>!c).length>32)throw Error('Layout maksimal 32 kontrol. Nonaktifkan tidak menghapus kontrol yang tersimpan.');
 for(let i=0;i<directions.length;i++){
  let c=chosen[i];const id='dpad-'+directions[i];
  if(!c){c=structuredClone(preset.controls.find(c=>c.id===id)!) as Control;layout.controls.push(c);}else c.id=id;
  c.enabled=true;
 }
 for(const c of controls)if(!directions.some(d=>c.id==='dpad-'+d))c.enabled=false;
 layout.dpadStyle=model;
}
export function setStickModel(layout:Layout,mapping:'leftStick'|'rightStick',model:'none'|'analog'|'eightWay'){
 const controls=layout.controls.filter(c=>c.type==='stick'&&c.mapping===mapping);
 if(model==='none'){for(const c of controls)c.enabled=false;return;}
 if(!controls.length){
  if(layout.controls.length>=32)throw Error('Layout maksimal 32 kontrol.');
  const c=structuredClone(preset.controls.find(c=>c.mapping===mapping)!) as Control;
  if(layout.controls.some(n=>n.id===c.id))c.id=crypto.randomUUID();layout.controls.push(c);controls.push(c);
 }
 for(const c of controls){c.enabled=true;c.stickMode=model;}
}
