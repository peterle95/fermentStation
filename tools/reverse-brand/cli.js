#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { capture } from './capture.js';
import { publicUrl } from './browser.js';
import { analyse } from './analysis.js';
import { makeTokens } from './tokens.js';
import { makePrompts, importImages, embeddedImages } from './images.js';
import { guide } from './guide.js';
import { exportSlides, exportVideo } from './media.js';
import { verify } from './verify.js';
import { devtoolsSnippet } from './extractor.js';

const {positionals,values:args}=parseArgs({allowPositionals:true,options:{
  out:{type:'string'},images:{type:'string',default:'none'},profile:{type:'string'},snapshot:{type:'string'},headed:{type:'boolean',default:false},
  import:{type:'boolean',default:false},video:{type:'boolean',default:false},stills:{type:'boolean',default:false},verify:{type:'boolean',default:false},
  'verify-only':{type:'boolean',default:false},help:{type:'boolean',short:'h'},'print-prompts':{type:'boolean',default:false},
}});

async function main() {
  if(args.help){console.log(`reverse-brand <public-url> [--out directory] [--images none|manual]
  --profile file.json       Evidence-backed overrides for embedded artwork
  --snapshot snapshot.json Reuse a capture or DevTools fallback (no crawling)
  --headed                 User completes any browser challenge; never bypassed
  --import                 Import manually generated images/<slot>.png|jpg|webp
  --video                  Render all 2700 frames at 1920×1080, 60fps, 45 seconds
  --stills                 Write 11 review stills (also written with --video)
  --verify                 Run offline checks and screenshot all guide sections
  --verify-only            Verify an existing --out without rebuilding
  --print-prompts           Print manual image prompts
Requires installed Chrome (CHROME_PATH optional); ffmpeg only for --video.
No API image providers are called. Manual input costs cannot be inferred.`);return;}
  const target=publicUrl(positionals[0]||'');
  if(!['none','manual'].includes(args.images))throw new Error('This build supports --images none or manual. API mode is not configured; no paid requests are made.');
  const out=resolve(args.out||`out/${target.hostname}`);
  if(args['verify-only']){await verify(out);return;}
  await mkdir(out,{recursive:true});await mkdir(resolve(out,'images'),{recursive:true});
  await writeFile(resolve(out,'devtools-extractor.js'),devtoolsSnippet());
  const timings={},started=new Date();
  async function phase(name,fn){const t=performance.now();try{return await fn();}finally{timings[name]=Math.round(performance.now()-t);}}
  const snapshot=await phase('capture',async()=>args.snapshot?JSON.parse(await readFile(resolve(args.snapshot),'utf8')):capture(target.href,out,{headed:args.headed}));
  if(snapshot.target!==target.href)throw new Error('Snapshot target differs from requested URL.');
  const profile=args.profile?JSON.parse(await readFile(resolve(args.profile),'utf8')):null;
  const model=await phase('analyse',async()=>analyse(snapshot,profile));
  await writeFile(resolve(out,'snapshot.json'),JSON.stringify(snapshot,null,2));
  if(profile?.rasterEvidence) {
    // Raster evidence is sampled only from a rendered source screenshot, never reused as guide media.
    try {
      const desktops=snapshot.pages.filter(p=>p.viewport.width===1440);
      const targetIndex=desktops.findIndex(p=>p.url===target.href);
      const media=desktops[targetIndex]?.media.find(m=>m.alt===profile.rasterBoardMediaAlt);
      if(media){
        const source=resolve(out,`screenshots/source/${targetIndex===0?'home-desktop':`page-${targetIndex}`}.png`);
        await sharp(source).extract({left:Math.round(media.rect.x),top:Math.round(media.rect.y),width:Math.floor(media.rect.width),height:Math.floor(media.rect.height)}).toFile(resolve(out,'screenshots/source/type-board.png'));
      }
      const image=sharp(resolve(out,'screenshots/source/type-board.png'));const {data,info}=await image.removeAlpha().raw().toBuffer({resolveWithObject:true});
      const palette=[...new Set(Object.values(model.colourRoles))],counts=palette.map(()=>0);
      const colours=palette.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
      for(let i=0;i<data.length;i+=info.channels){let nearest=-1,best=16;for(let c=0;c<colours.length;c++){const distance=Math.max(...colours[c].map((v,j)=>Math.abs(v-data[i+j])));if(distance<best){best=distance;nearest=c}}if(nearest>=0)counts[nearest]++;}
      const total=counts.reduce((a,b)=>a+b,0);model.rasterShares=palette.map((hex,i)=>({hex,matchedPixels:counts[i],share:Math.round(counts[i]/total*10000)/100}));
      model.assumptions.push('Palette bar proportions count nearest pixels within RGB distance 15 in screenshots/source/type-board.png; unmatched photographic pixels are excluded. This is not app-wide usage.');
    }catch(error){model.assumptions.push(`Raster pixel-share sampling unavailable: ${error.message}. Palette usage shares remain unknown.`);}
  }
  const tokens=await phase('tokens',async()=>makeTokens(model));
  const prompts=makePrompts(model);
  await writeFile(resolve(out,'prompts.json'),JSON.stringify(prompts,null,2));
  if(args['print-prompts'])for(const p of prompts.slots)console.log(`\n${p.slot} (${p.aspectRatio}, ${p.resolution}px) → ${p.file}\n${p.prompt}`);
  let manifest=[];
  if(args.images==='manual'&&args.import)manifest=await phase('images',()=>importImages(out,prompts));
  else if(args.images==='manual'){try{manifest=JSON.parse(await readFile(resolve(out,'images/manifest.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}}
  await writeFile(resolve(out,'images/manifest.json'),JSON.stringify(manifest,null,2));
  const images=await embeddedImages(out,manifest);
  await phase('guide',async()=>{
    await writeFile(resolve(out,'tokens.css'),tokens.css);await writeFile(resolve(out,'tokens.json'),JSON.stringify(tokens.json,null,2));
    await writeFile(resolve(out,'analysis.json'),JSON.stringify(model,null,2));
    await writeFile(resolve(out,'brand-guide.html'),guide(model,tokens,{},prompts));
    await writeFile(resolve(out,'brand-guide-hero.html'),guide(model,tokens,images,prompts));
  });
  await phase('slides',()=>exportSlides(out,model,tokens,images));
  const video=await phase('video',()=>exportVideo(out,model,tokens,images,{stills:args.stills||args.video,render:args.video}));
  let validation,validationError;
  try{if(args.verify)validation=await phase('verification',()=>verify(out));}catch(error){validationError=error;}
  const sizes=[];for(const name of ['brand-guide.html','brand-guide-hero.html','tokens.css','tokens.json','snapshot.json','analysis.json'])sizes.push([name,(await stat(resolve(out,name))).size]);
  const log=`# Unofficial analysis: ${model.brand}\n\nNot affiliated with or endorsed by ${model.brand}. Trademarks belong to their owners.\n\nStarted: ${started.toISOString()}\nFinished: ${new Date().toISOString()}\n\n## Phase timings\n\n| Phase | Milliseconds |\n|---|---:|\n${Object.entries(timings).map(([n,t])=>`| ${n} | ${t} |`).join('\n')}\n\n${args.snapshot?'Capture reused from snapshot; capture phase is file-read time, not original browser time.':''}\nOriginal capture duration: ${snapshot.durationMs??'unknown'}ms.\n\n## Capture\n\n${model.pages.map(p=>`- ${p.url}: ${p.elements} elements`).join('\n')}\n\nDesktop: 1440×900. Mobile: 390×844 (home and target). ${model.removedChrome} identical repeated chrome elements deduplicated. ${model.elements} retained.\n\nPage picks: scored navigation and product/pricing/company links, one per top-level path, with the supplied case study pinned. Candidates and failures are in snapshot.json.\n\n## Files\n\n| File | Bytes |\n|---|---:|\n${sizes.map(([n,b])=>`| ${n} | ${b} |`).join('\n')}\n\n## Images and cost\n\nMode: ${args.images}. ${manifest.length} imported images. Provider requests: 0. Known image-generation spend: $0. Manual generations, if any, have unknown external costs.\n\n${prompts.slots.map(p=>`- ${p.slot}: ${manifest.some(m=>m.slot===p.slot)?'imported; manual cost unknown':'not supplied; gradient fallback; $0 provider spend'}`).join('\n')}\n\nLLM token usage and cost: not exposed by harness; unknown, not reported as zero.\n\n## Video\n\n${video.status}. Frames: ${video.frames}. ${args.video?'45 seconds, real 60fps, 1920×1080; individual screenshots sought via document.getAnimations(), piped to ffmpeg. libx264, CRF 14, yuv420p, TV range, BT.709, faststart.':'Use --video to render the final MP4.'}\n\n## Verification\n\n${validation?`PASS: ${validation.checks.length} checks.`:validationError?`FAIL: ${validationError.message}`:'Not requested.'}\n\n## Assumptions and boundaries\n\n${model.assumptions.map(a=>`- ${a}`).join('\n')}\n\n## Visual review\n\nGenerated screenshots are under screenshots/, slides/, and video/stills/. Automated verification does not establish aesthetic quality. Record visual review findings here after inspection.\n`;
  await writeFile(resolve(out,'run-log.md'),log);
  await writeFile(resolve(out,'run.json'),JSON.stringify({target:target.href,brand:model.brand,mode:args.images,timings,sizes,video,validation:validation?.passed??false,imageProviderSpend:0,llmCost:null},null,2));
  console.log(`Built ${out}\n${model.pages.length} desktop pages; ${model.elements} retained elements. Image provider spend: $0.`);
  if(validationError)throw validationError;
}
main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
