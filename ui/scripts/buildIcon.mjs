import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';

// Render every Windows icon size from the same vector used in the app header.
const source=await fs.readFile(new URL('../public/favicon.svg',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({deviceScaleFactor:1});
 const pngs=[];
 for(const size of [16,24,32,48,64,128,256,512]){
  await page.setViewportSize({width:size,height:size});
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${source}`);
  const png=await page.screenshot({omitBackground:true});
  if(size===512)await fs.writeFile(new URL('../public/beestation.png',import.meta.url),png);else pngs.push({size,png});
 }
 const header=Buffer.alloc(6+pngs.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(pngs.length,4);
 let offset=header.length;
 pngs.forEach(({size,png},index)=>{const entry=6+index*16;header[entry]=header[entry+1]=size===256?0:size;header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(png.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=png.length;});
 await fs.writeFile(new URL('../../src/BeeHooks.App/Assets/beestation.ico',import.meta.url),Buffer.concat([header,...pngs.map(p=>p.png)]));
 console.log('BeeStation SVG rendered to PNG 512 and ICO 16/24/32/48/64/128/256.');
}finally{await browser.close();}
