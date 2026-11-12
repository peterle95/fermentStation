import { mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

export const slots = ['hero','horizon','object','street','sky','glass','grid','tokens','fruit'];
export function makePrompts(model) {
  const subjects = {
    hero:'Wide still life of a grapefruit soda in an unbranded clear tumbler with lime slices on a lemon-yellow studio sweep; leave the upper left calm and open',
    horizon:'Low horizon of softly lit mint-green and pale-blue studio planes, one tiny chilled pear soda at the far right; generous empty foreground',
    object:'Single polished chrome sphere beside a translucent ice-blue acrylic cylinder on a lime-green seamless studio surface, orderly reflections',
    street:'Candid daylight crop of adult friends holding unbranded citrus sodas outside an outdoor music event; no identifiable venue or signage',
    sky:'Clean pale-blue summer sky above a narrow band of chartreuse-green grass, crisp horizon, soft natural light',
    glass:'Orderly row of three clear glass cylinders with condensation and one sliced kiwi on a pastel lilac studio surface, frontal material study',
    grid:'Top-down still life of neatly aligned unbranded glass tumblers and lime halves in a regular twelve-column-inspired arrangement on a pale yellow surface',
    tokens:'Small blank lime-green ceramic discs in a precise staggered stack beside a translucent blue cube on a clean black studio surface',
    fruit:'Macro close-up of freshly cut pink grapefruit, pear and kiwi with small clear ice cubes on a pale-blue studio sweep, tactile and sharply focused',
  };
  return { mode:'manual', source:model.source, reference:'Text description only; never use source photographs as image inputs.', cost:0,
    style:model.photography||'Use the observed source-page photographic style, with new subjects and no source images as inputs.',
    slots:slots.map(slot=>({slot,aspectRatio:['hero','horizon','sky','grid'].includes(slot)?'16:9':'4:5',resolution:['hero','horizon','sky','grid'].includes(slot)?2000:1400,
      prompt:`${subjects[slot]}. ${model.photography||'Bright clean studio photography with the analysed palette.'} New composition and new subjects, photorealistic, no text, letters, logos, brand marks, cards or app screens`,
      file:`images/${slot}.png`,status:'awaiting manual generation',cost:null})) };
}

export async function importImages(out, prompts) {
  const directory=resolve(out,'images');
  await mkdir(directory,{recursive:true});
  const files=await readdir(directory), manifest=[];
  for (const item of prompts.slots) {
    const filename=files.find(f=>new RegExp(`^${item.slot}\\.(png|jpe?g|webp)$`,'i').test(f));
    if (!filename) continue;
    const input=await readFile(resolve(directory,filename));
    // Retain user originals. Pixel limits avoid accidental decompression bombs.
    const image=sharp(input,{limitInputPixels:60000000}).rotate();
    const metadata=await image.metadata();
    const buffer=await image.resize({width:item.resolution,withoutEnlargement:true}).webp({quality:72,effort:6}).toBuffer();
    await writeFile(resolve(directory,`${item.slot}.webp`),buffer);
    manifest.push({slot:item.slot,path:`images/${item.slot}.webp`,bytes:buffer.length,width:Math.min(metadata.width,item.resolution),
      credit:'AI-generated image',provenance:'User-supplied manual generation; no source photograph input authorised.',cost:null,status:'imported; requires visual review'});
  }
  // Base64 costs 4/3. Reserve ~200KB for the guide and make oversize imports actionable.
  if (manifest.reduce((n,m)=>n+Math.ceil(m.bytes*4/3),0)>3700000) throw new Error('Imported images exceed the 4MB hero budget. Reduce input complexity or WebP quality before building.');
  await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2));
  return manifest;
}

export async function embeddedImages(out, manifest) {
  const data={};
  for (const item of manifest) {
    if (!slots.includes(item.slot) || item.path!==`images/${item.slot}.webp`) throw new Error('Invalid image manifest entry.');
    data[item.slot]=`data:image/webp;base64,${(await readFile(resolve(out,item.path))).toString('base64')}`;
  }
  return data;
}
