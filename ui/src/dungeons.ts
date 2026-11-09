import type {Control,Layout} from './shared';
import preset from '../../src/BeeHooks.Core/Presets/dungeons.json';

export const controllerLabels:Record<string,string>={a:'A',b:'B',x:'X',y:'Y',lb:'LB',rb:'RB',lt:'LT',rt:'RT',ls:'LS',rs:'RS',start:'Menu',back:'View',up:'↑',down:'↓',left:'←',right:'→',leftStick:'Analog kiri',rightStick:'Roll arah'};
export const dungeonsFunctions:Record<string,string>={
 a:'Serang jarak dekat / interaksi. Pilih atau konfirmasi di inventory dan menu.',
 b:'Artefak 3 saat bermain; kembali atau tutup di inventory dan menu.',
 x:'Artefak 1 saat bermain. Di inventory/menu, ikuti petunjuk X pada layar game.',
 y:'Artefak 2 saat bermain; Hero Settings / Change Skin di pemilihan karakter.',
 lb:'Heal saat bermain; tab atau karakter sebelumnya di inventory/menu.',
 rb:'Forward roll (roll biasa) saat bermain; tab atau karakter berikutnya di inventory/menu.',
 lt:'Chat wheel saat bermain.',rt:'Serangan jarak jauh. Di inventory, ikuti petunjuk RT pada layar game.',
 ls:'Klik analog kiri; bergabung sebagai pemain pada layar pemilihan karakter.',
 rs:'Klik analog kanan: teleport saat bermain.',start:'Buka / tutup pause menu.',
 up:'Buka inventory; arah atas untuk navigasi.',down:'Full map saat bermain; arah bawah untuk navigasi.',
 left:'Arah kiri untuk navigasi.',right:'Emote saat bermain; arah kanan untuk navigasi.',
 leftStick:'Gerak / bidik saat bermain; navigasi di inventory/menu.',
 rightStick:'Directional roll: geser analog kecil ke arah roll. Terpisah dari tombol RS (teleport) dan RB (roll biasa). Matikan Kontrol aktif bila tidak dibutuhkan.'
};

export function prepareDungeonsLayout(layout:Layout){
 const hasUp=layout.controls.some(c=>c.id==='dpad-up'),hasDown=layout.controls.some(c=>c.id==='dpad-down');
 layout.controls=layout.controls.filter(c=>!['back','join'].includes(c.id)&&!(hasUp&&c.id==='inventory')&&!(hasDown&&c.id==='map'));
 if(!layout.controls.length)throw Error('Layout perlu kontrol permainan.');
 for(const control of preset.controls.filter(c=>['ls','rs','lt','roll'].includes(c.id))){
  if(layout.controls.length<32&&!layout.controls.some(c=>c.id===control.id||c.mapping===control.mapping))layout.controls.push(structuredClone(control) as Control);
 }
 for(const c of layout.controls)c.label=controllerLabels[c.mapping]??c.label;
 delete layout.modes;
 return layout;
}
