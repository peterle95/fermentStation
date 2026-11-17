import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import sharp from 'sharp';
import { escape } from './guide.js';

export async function sheets(out) {
  const folders=['screenshots/brand-guide/desktop','screenshots/brand-guide/mobile','screenshots/brand-guide/tablet','screenshots/brand-guide/tablet-wide','slides/instagram','slides/x','video/stills'];
  const directory=resolve(out,'screenshots/review');await mkdir(directory,{recursive:true});
  for(const folder of folders) {
    const files=(await readdir(resolve(out,folder))).filter(f=>f.endsWith('.png')).sort();
    const cellW=400,cellH=520,cols=folder.includes('mobile')?4:3,rows=Math.ceil(files.length/cols);
    const composite=[];
    for(const [i,f]of files.entries()) {
      const input=await sharp(resolve(out,folder,f)).resize({width:cellW-16,height:cellH-40,fit:'contain',background:'#dddddd'}).png().toBuffer();
      const label=Buffer.from(`<svg width="400" height="32"><rect width="400" height="32" fill="white"/><text x="8" y="22" font-family="Arial" font-size="16">${escape(f)}</text></svg>`);
      composite.push({input,left:i%cols*cellW+8,top:Math.floor(i/cols)*cellH+32},{input:label,left:i%cols*cellW,top:Math.floor(i/cols)*cellH});
    }
    await sharp({create:{width:cols*cellW,height:rows*cellH,channels:3,background:'#dddddd'}}).composite(composite).jpeg({quality:88}).toFile(resolve(directory,`${folder.replaceAll('/','-')}.jpg`));
  }
}
if(process.argv[1]&&basename(process.argv[1])==='review-sheets.js')await sheets(resolve(process.argv[2]));
