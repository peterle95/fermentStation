import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { launch } from './browser.js';
import { escape as e, jsonForHtml } from './guide.js';

export function scenes(model) {
  const colours=[...new Set(Object.values(model.colourRoles))];
  const artwork=model.scope==='embedded-artwork';
  return [
    {title:`${model.brand}\nbrand guidelines`,kicker:'Overview',body:artwork?'Unofficial reconstruction from case-study artwork. Palette declared or sampled; geometry inferred.':'Unofficial website analysis. Computed values are observed; role assignments are inferred.',slot:'hero',kind:'cover'},
    {title:'Typography',kicker:'Typography',body:`${model.families[0].name}\n${artwork?`${model.roles.body.desktop}px body declared in artwork. Other roles and mobile clamps are reconstructed.`:'Heading clusters use 12% size tolerance. Exact mobile text matches define responsive endpoints.'}`,slot:'horizon',kind:'type'},
    {title:'Fonts',kicker:'Fonts',body:`${model.families[0].weights.join(' / ')}\nLocal fonts only. No font files copied. Arial is used when the named family is unavailable.`,slot:'sky',kind:'font'},
    {title:'Colour',kicker:'Colour',body:artwork?'Four pastel hex values transcribed. Dark pixel-sampled. Roles assigned; app-wide usage is unknown.':'Text weighted by characters. Backgrounds weighted by estimated painted area. Roles assigned.',slot:'object',kind:'colour',colours},
    {title:'Layout and\nspacing',kicker:'Layout and spacing',body:`${model.spacing.base}px base / ${model.layout.columns} columns\n${model.layout.gutter}px gutter / ${model.layout.container}px container\nGuide reconstruction, not original app measurements.`,slot:'grid',kind:'layout'},
    {title:'Components',kicker:'Components',body:'Filled, outline and translucent variants rebuilt from tokens. Missing components are inferred.',slot:'glass',kind:'components'},
    {title:'Imagery',kicker:'Imagery',body:'Clear glass, cut fruit, hard studio light and flat pastel grounds. No source photos reproduced.',slot:'fruit',kind:'image'},
    {title:'Voice and tone',kicker:'Voice and tone',body:`${model.voice.corpusLines} excerpts / ${model.voice.words} words\n${model.voice.exclamations} exclamation marks / ${model.voice.you} you or your / ${model.voice.we} we\nNarrow artwork corpus, not app-wide copy.`,slot:'street',kind:'voice'},
    {title:'Design tokens',kicker:'Design tokens',body:'CSS custom properties + DTCG JSON\nHex and OKLCH together. Every rebuilt specimen uses exported variables.',slot:'tokens',kind:'tokens'},
    {title:'Method',kicker:'Method',body:'Separate observations from reconstruction. Keep source links, assumptions, snapshots and verification results.',slot:'sky',kind:'method'},
    {title:`${model.brand}`,kicker:'Overview',body:'Unofficial analysis\nNot affiliated with or endorsed by the brand.\nMeasured evidence and inferred values stay separate.',slot:'hero',kind:'outro'},
  ];
}

export function presentation(model,tokens,images={}, {width=1920,height=1080,selection=null,animated=false}={}) {
  const all=scenes(model), list=selection?selection.map(i=>all[i]):all;
  const disclaimer=`Not affiliated with or endorsed by ${model.brand}. Trademarks belong to their owners.`;
  const tokenExcerpt=`:root {\n  --colour-action: ${model.colourRoles.action};\n  --radius-card: ${tokens.vars['radius-card']};\n}\n/* geometry inferred */`;
  const visual=scene=>`<div class="media slot-${scene.slot}" ${images[scene.slot]?'data-ai="true"':''}><div class="photo"></div>${images[scene.slot]?'<span class="ai">AI-generated image</span>':''}${scene.kind==='type'?'<p class="specimen">Aa Bb<br>012345</p>':scene.kind==='colour'?`<div class="swatches">${scene.colours.map((c,i)=>`<div class="colour-${i}"><span>${e(c)}</span></div>`).join('')}</div>`:scene.kind==='layout'?`<div class="columns">${Array.from({length:12},(_,i)=>`<i>${i+1}</i>`).join('')}</div>`:scene.kind==='components'?'<div class="sample-card"><span>Token rebuild</span><strong>Drink selection</strong><button>View tokens ↗</button></div>':scene.kind==='tokens'?'<pre>:root {\n  --colour-action:\n    var(--measured-lime);\n  --card-radius: 32px;\n}\n/* geometry inferred */</pre>':scene.kind==='font'?'<p class="specimen">Aa</p>':''}</div>`;
  const body=list.map((scene,i)=>`<section class="scene ${i%3===0?'dark':''}" data-scene="${i}" data-kind="${scene.kind}"><header><span>${e(model.brand)} / ${e(scene.kicker)}</span><span class="unofficial">Unofficial analysis</span></header><div class="content"><div class="words"><p class="index">${String(i+1).padStart(2,'0')} / ${list.length}</p><h1>${e(scene.title).replace(/\n/g,'<br>')}</h1><p class="description">${e(scene.body).replace(/\n/g,'<br>')}</p></div>${visual(scene)}</div><footer>${e(disclaimer)}</footer></section>`).join('');
  const scopedBody=body.replace(':root {\n  --colour-action:\n    var(--measured-lime);\n  --card-radius: 32px;\n}\n/* geometry inferred */',e(tokenExcerpt));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unofficial analysis — ${e(model.brand)}</title><style>${tokens.css}
  *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}body{font-family:var(--font-family);background:var(--colour-background);color:var(--colour-text)}.scene{position:absolute;inset:0;padding:var(--space-16);display:flex;flex-direction:column;background:var(--colour-background);color:var(--colour-text);opacity:0}.scene.active{opacity:1;z-index:2}.scene.dark{background:var(--colour-surface-inverse);color:var(--colour-text-inverse)}header{display:flex;justify-content:space-between;align-items:center;gap:var(--space-4);font-size:var(--type-body)}.unofficial{border:var(--stroke-width) solid currentColor;border-radius:var(--radius-pill);padding:var(--space-3) var(--space-4);white-space:nowrap}.content{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-16);align-items:center;flex:1;min-height:0}.words{min-width:0}.index{font-size:var(--type-body);margin:0 0 var(--space-8)}h1{font-size:var(--type-display);font-weight:var(--type-display-weight);line-height:var(--type-display-leading);letter-spacing:var(--type-display-tracking);margin:0 0 var(--space-8);overflow-wrap:anywhere}.description{font-size:var(--type-lead);line-height:var(--type-lead-leading);max-width:35ch;margin:0}.media{height:80%;min-height:0;border-radius:var(--card-radius);background:var(--imagery-fallback);position:relative;overflow:hidden;isolation:isolate;display:grid;align-items:center;padding:var(--space-8)}.photo{position:absolute;inset:0;z-index:-1;background-image:var(--slot-image,var(--imagery-fallback));background-size:cover;background-position:center}.ai{position:absolute;right:var(--space-4);bottom:var(--space-4);font-size:var(--type-small);background:var(--colour-background);color:var(--colour-text);padding:var(--space-2) var(--space-3);border-radius:var(--radius-pill)}footer{font-size:var(--type-body);line-height:var(--type-body-leading);padding-top:var(--space-8);max-width:95ch}.specimen{font-size:var(--type-display);font-weight:var(--type-display-weight);line-height:var(--type-display-leading);letter-spacing:var(--type-display-tracking);color:var(--colour-text);margin:0}.swatches{display:flex;flex-wrap:wrap;gap:var(--space-3)}.swatches>div{width:calc(50% - var(--space-2));height:var(--space-32);border-radius:var(--radius-small);padding:var(--space-4);display:flex;align-items:flex-end;font-size:var(--type-body)}.columns{display:grid;grid-template-columns:repeat(var(--layout-columns),1fr);gap:var(--space-2);height:var(--space-32)}.columns i{background:var(--colour-action-alt);border-radius:var(--radius-small);color:var(--colour-text);font-style:normal;font-size:var(--type-body);text-align:center;padding-top:var(--space-4)}.sample-card{padding:var(--card-padding);border-radius:var(--card-radius);background:var(--card-fill);color:var(--card-text);display:grid;gap:var(--space-8)}.sample-card strong{font-size:var(--type-h2);font-weight:var(--type-h2-weight)}.sample-card button{font:var(--button-size)/var(--type-body-leading) var(--font-family);min-height:var(--button-height);padding:var(--space-3) var(--button-padding-x);background:var(--button-fill);color:var(--button-text);border:0;border-radius:var(--button-radius)}pre{padding:var(--card-padding);background:var(--colour-surface-inverse);color:var(--colour-text-inverse);font:var(--type-lead)/var(--type-body-leading) var(--font-mono);border-radius:var(--card-radius);white-space:pre-wrap}.scene:first-child h1{font-size:var(--type-h1)}${(all[3].colours||[]).map((c,i)=>{const role=Object.entries(model.colourRoles).find(([,hex])=>hex===c)[0];return `.colour-${i}{background:var(--colour-${role});color:var(--colour-${['#1c1c1c','#000000'].includes(c)?'text-inverse':'text'})}`}).join('')}${Object.entries(images).map(([slot,data])=>`.slot-${slot}{--slot-image:url("${data}")}`).join('')}
  ${height>width?`.scene{padding:var(--space-12)}.content{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);gap:var(--space-8);padding-top:var(--space-12)}.media{height:100%;min-height:0}.description{font-size:var(--type-h4)}h1,.scene:first-child h1{font-size:var(--type-h1)}.index{margin-bottom:var(--space-4)}footer{font-size:var(--type-body);padding-top:var(--space-6)}`:''}
  @media(prefers-reduced-motion:reduce){.photo{transform:none!important}}
  </style></head><body>${scopedBody}<script>const animated=${animated};const list=[...document.querySelectorAll('.scene')];window.showScene=i=>{for(const [n,s]of list.entries())s.classList.toggle('active',n===i)};if(!animated){window.showScene(0)}else{const total=45000,step=total/list.length,fade=500;for(const [i,s]of list.entries()){const start=Math.max(0,i*step-fade),end=Math.min(total,(i+1)*step+fade),duration=end-start;const a=s.animate([{opacity:i===0?1:0,transform:'scale(1.015)',filter:'blur(4px)',offset:0},{opacity:1,transform:'scale(1)',filter:'blur(0px)',offset:Math.min(fade/duration,.2)},{opacity:1,transform:'scale(1)',filter:'blur(0px)',offset:1-Math.min(fade/duration,.2)},{opacity:i===list.length-1?1:0,transform:'scale(.995)',filter:'blur(3px)',offset:1}],{duration,delay:start,fill:'both',easing:'linear'});a.pause();for(const [j,el]of [...s.querySelectorAll('.index,h1,.description,.columns i,.swatches>div')].entries()){const b=el.animate([{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0px)'}],{duration:650,delay:i*step+120+j*60,fill:'both',easing:getComputedStyle(document.documentElement).getPropertyValue('--motion-easing').trim()});b.pause()}const z=s.querySelector('.photo').animate([{transform:'scale(1)'},{transform:'scale(1.045)'}],{duration:duration+600,delay:start,fill:'both',easing:'linear'});z.pause()}window.seek=t=>{for(const a of document.getAnimations()) {a.pause();a.currentTime=t*1000}};window.seek(0)}window.mediaReady=true;</script></body></html>`;
}

export async function exportSlides(out,model,tokens,images) {
  const browser=await launch();
  try {
    for(const [format,width,height,selection]of [['instagram',1080,1350,[0,1,3,4,5,7,8,10]],['x',1600,900,[0,1,3,5]]]) {
      const folder=resolve(out,'slides',format);await mkdir(folder,{recursive:true});
      const file=resolve(folder,'slides.html');await writeFile(file,presentation(model,tokens,images,{width,height,selection}));
      const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
      await page.goto(pathToFileURL(file).href);await page.evaluate(()=>document.fonts.ready);
      for(let i=0;i<selection.length;i++) {await page.evaluate(i=>window.showScene(i),i);await page.screenshot({path:resolve(folder,`${String(i+1).padStart(2,'0')}.png`)});}
      await page.close();
    }
  } finally {await browser.close();}
}

export async function exportVideo(out,model,tokens,images,{stills=true,render=true}={}) {
  const directory=resolve(out,'video');await mkdir(directory,{recursive:true});
  const html=resolve(directory,'presentation.html');await writeFile(html,presentation(model,tokens,images,{animated:true}));
  const browser=await launch();
  try {
    const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'no-preference'});
    await page.goto(pathToFileURL(html).href);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>window.mediaReady);
    if(stills) {
      const folder=resolve(directory,'stills');await mkdir(folder,{recursive:true});
      for(let i=0;i<11;i++){await page.evaluate(t=>window.seek(t),i*45/11+1.5);await page.screenshot({path:resolve(folder,`${String(i+1).padStart(2,'0')}.png`)});}
    }
    if(!render)return {frames:0,stills:11,status:'stills only; video not rendered'};
    const name=new URL(model.source).hostname;
    const file=resolve(directory,`${name}-presentation-1920x1080-60fps.mp4`);
    const args=['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','png','-framerate','60','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','14','-pix_fmt','yuv420p','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-bsf:v','h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0','-r','60','-movflags','+faststart',file];
    const encoder=spawn(process.env.FFMPEG_PATH||'ffmpeg',args,{stdio:['pipe','ignore','pipe']});
    let stderr='';encoder.stderr.on('data',data=>stderr+=data.toString());
    // Register immediately: missing ffmpeg and early encoder exits must reject, not leave Chrome running.
    const completion=new Promise((ok,no)=>{encoder.once('error',no);encoder.once('close',code=>code===0?ok():no(new Error(`ffmpeg exited ${code}: ${stderr}`)));});
    completion.catch(()=>{});
    let pipeError;encoder.stdin.on('error',error=>{pipeError=error;});
    try {
      for(let i=0;i<2700;i++) {
        if(pipeError)throw pipeError;
        await page.evaluate(t=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t*1000}},i/60);
        const frame=await page.screenshot({type:'png'});
        if(!encoder.stdin.write(frame))await Promise.race([once(encoder.stdin,'drain'),completion.then(()=>{throw new Error('ffmpeg closed before all frames were sent.');})]);
        if(i%600===0)console.log(`Video ${i}/2700 frames`);
      }
      encoder.stdin.end();await completion;
      await writeFile(resolve(directory,'render.json'),JSON.stringify({width:1920,height:1080,fps:60,frames:2700,duration:45,codec:'libx264',crf:14,pixelFormat:'yuv420p',range:'tv',matrix:'bt709',timing:'Every Web Animation paused and sought to i/60. One screenshot per encoded frame.'},null,2));
      return {frames:2700,stills:11,file,status:'rendered'};
    } catch(error) {encoder.stdin.destroy();encoder.kill();await completion.catch(()=>{});throw new Error(`${error.message}\n${stderr}`);}
  } finally {await browser.close();}
}
