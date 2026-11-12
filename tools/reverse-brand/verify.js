import { readFile, stat, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { launch } from './browser.js';
import { sectionNames, sectionId } from './guide.js';
import { flattenTokens } from './tokens.js';

export async function verify(out,{screenshots=true}={}) {
  const checks=[],failures=[];
  async function check(name,fn){try{await fn();checks.push({name,pass:true});}catch(error){const failure={name,pass:false,error:error.stack||error.message};checks.push(failure);failures.push(failure);}}
  const tokenJson=JSON.parse(await readFile(resolve(out,'tokens.json'),'utf8'));
  const flat=flattenTokens(tokenJson);
  const browser=await launch();
  try {
    for(const [filename,budget]of [['brand-guide.html',150000],['brand-guide-hero.html',4000000]]) {
      await check(`${filename}: byte budget`,async()=>assert.ok((await stat(resolve(out,filename))).size<=budget));
      const html=await readFile(resolve(out,filename),'utf8');
      await check(`${filename}: token JSON`,()=>{assert.ok(flat.length>70);for(const token of flat)assert.ok(token.$type&&token.$extensions['reverse-brand'].cssVariable);});
      await check(`${filename}: no copied assets or remote dependencies`,()=>{
        assert.ok(!/<(?:img|link|iframe|video)\b/i.test(html));
        assert.ok(!/@import|@font-face|url\(\s*["']?https?:/i.test(html));
        if(filename==='brand-guide.html')assert.ok(!html.includes('data:image/'));
        const embeds=html.match(/data:image\/webp;base64,[\w+/=]+/g)||[];assert.equal(new Set(embeds).size,embeds.length,'Images must be embedded only once and reused.');
      });
      const context=await browser.newContext({offline:true,reducedMotion:'reduce',serviceWorkers:'block'});
      const page=await context.newPage(),requests=[],errors=[];
      page.on('request',r=>{if(/^https?:/i.test(r.url()))requests.push(r.url());});page.on('pageerror',error=>errors.push(error.message));
      await page.goto(pathToFileURL(resolve(out,filename)).href);await page.evaluate(()=>window.fontCheck);
      await check(`${filename}: offline, no network attempts or script errors`,()=>{assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);});
      await check(`${filename}: required sections and disclosures`,async()=>{
        for(const name of sectionNames)assert.equal(await page.locator(`#${sectionId(name)}`).count(),1,name);
        assert.ok((await page.locator('#cover').innerText()).includes('Unofficial analysis'));
        for(const selector of ['.topbar','footer','main>section'])for(const element of await page.locator(selector).all())assert.ok((await element.innerText()).includes('Unofficial analysis'),selector);
        assert.ok((await page.locator('footer').innerText()).includes('Trademarks belong to their owners.'));
        assert.ok((await page.locator('#cover').innerText()).includes('Not affiliated with or endorsed by'));
      });
      await check(`${filename}: quotes, rules and inline tokens`,async()=>{
        assert.equal(await page.locator('[data-quote]').count(),5);assert.equal(await page.locator('[data-rule]').count(),3);
        for(const q of await page.locator('[data-quote] p').all())assert.ok((await q.innerText()).trim().split(/\s+/).length<=15);
        assert.deepEqual(await page.locator('#token-data').evaluate(el=>JSON.parse(el.textContent)),tokenJson);
      });
      await check(`${filename}: AI attribution`,async()=>{
        const results=await page.locator('.visual').evaluateAll(elements=>elements.map(el=>({image:getComputedStyle(el).getPropertyValue('--slot-image').trim(),label:el.querySelector('.ai-credit')?.textContent,flag:el.dataset.ai})));
        for(const r of results)if(r.image){assert.equal(r.label,'AI-generated image');assert.equal(r.flag,'true');}
      });
      await check(`${filename}: token rebuild computed styles`,async()=>{
        const results=await page.evaluate(()=>{
          const probe=document.createElement('div');probe.style.cssText='position:absolute;visibility:hidden;background:var(--button-fill);color:var(--button-text);border-radius:var(--button-radius);font-family:var(--button-font);font-size:var(--button-size);font-weight:var(--button-weight);min-height:var(--button-height);padding-left:var(--button-padding-x)';document.body.append(probe);
          const props=['backgroundColor','color','borderRadius','fontFamily','fontSize','fontWeight','minHeight','paddingLeft'];
          const pairs=props.map(p=>[p,getComputedStyle(document.getElementById('rebuild-button'))[p],getComputedStyle(probe)[p]]);
          probe.style.cssText='position:absolute;visibility:hidden;background:var(--card-fill);color:var(--card-text);border-radius:var(--card-radius);padding:var(--card-padding);font-family:var(--font-family)';
          for(const p of ['backgroundColor','color','borderRadius','paddingTop','paddingRight','paddingBottom','paddingLeft','fontFamily'])pairs.push(['card.'+p,getComputedStyle(document.getElementById('rebuild-card'))[p],getComputedStyle(probe)[p]]);probe.remove();return pairs;
        });
        for(const [property,actual,expected]of results)assert.equal(actual,expected,property);
      });
      await check(`${filename}: typography tabs use distinct role sizes`,async()=>{
        const sizes=[];for(const role of ['display','h1','h3','lead','body']){await page.locator(`[data-role="${role}"]`).click();sizes.push(await page.locator('#type-specimen').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)));}
        assert.ok(new Set(sizes).size>=4);await page.locator('[data-role="display"]').click();
      });
      await check(`${filename}: keyboard focus visible on light and dark grounds`,async()=>{
        await page.keyboard.press('Tab');
        for(const selector of ['#rebuild-button','#demo-input','#copy-css']){
          await page.locator(selector).focus();
          const focus=await page.locator(selector).evaluate(el=>{const s=getComputedStyle(el);return {visible:el.matches(':focus-visible'),width:parseFloat(s.outlineWidth),style:s.outlineStyle,shadow:s.boxShadow};});
          assert.ok(focus.visible&&focus.width>=3&&focus.style==='solid'&&focus.shadow!=='none',JSON.stringify(focus));
        }
        await page.locator('#copy-css').evaluate(el=>el.blur());
      });
      for(const [width,height,label]of [[1440,900,'desktop'],[1024,768,'tablet-wide'],[768,1024,'tablet'],[390,844,'mobile']]) {
        await page.setViewportSize({width,height});
        await check(`${filename}: no horizontal scroll at ${width}px`,async()=>{
          const overflow=await page.evaluate(()=>({body:document.body.scrollWidth,root:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(Math.max(overflow.body,overflow.root)<=width,JSON.stringify(overflow));
        });
        if(screenshots) {
          const folder=resolve(out,'screenshots',filename.replace('.html',''),label);await mkdir(folder,{recursive:true});
          // Crop one real full-page screenshot. Element screenshots of tall chapters move fixed chrome
          // into the middle of the clipped image, producing misleading apparent collisions.
          await page.evaluate(()=>scrollTo(0,0));
          const screenshot=await page.screenshot({fullPage:true,animations:'disabled'});
          for(const element of await page.locator('main>section').all()) {
            const id=await element.getAttribute('id');
            const rect=await element.evaluate(el=>{const r=el.getBoundingClientRect();return {left:Math.round(r.x),top:Math.round(r.y+scrollY),width:Math.round(r.width),height:Math.floor(r.height)};});
            await sharp(screenshot).extract(rect).toFile(resolve(folder,`${id}.png`));
          }
        }
      }
      await check(`${filename}: no delayed network attempts`,()=>assert.deepEqual(requests,[]));
      await context.close();
    }
    // Check produced social decks and scene still sources, not only their filenames.
    for(const format of ['instagram','x']) {
      const folder=resolve(out,'slides',format);
      await check(`${format}: dimensions, counts and disclaimers`,async()=>{
        const [width,height,count]=format==='instagram'?[1080,1350,8]:[1600,900,4];
        const page=await browser.newPage({viewport:{width,height},offline:true,reducedMotion:'reduce'});
        try {
          await page.goto(pathToFileURL(resolve(folder,'slides.html')).href);assert.equal(await page.locator('.scene').count(),count);
          for(let i=0;i<count;i++) {
            await page.evaluate(i=>window.showScene(i),i);
            const s=page.locator('.scene').nth(i),text=await s.innerText();assert.ok(text.includes('Unofficial analysis')&&text.includes('Trademarks belong to their owners.'));
            const bounds=await s.evaluate(el=>{const main=el.querySelector('.content').getBoundingClientRect(),words=el.querySelector('.words').getBoundingClientRect(),foot=el.querySelector('footer').getBoundingClientRect();return {wordBottom:words.bottom,footerTop:foot.top,mainBottom:main.bottom,width:innerWidth,height:innerHeight};});
            assert.ok(bounds.wordBottom<=bounds.footerTop,JSON.stringify(bounds));
            const file=await readFile(resolve(folder,`${String(i+1).padStart(2,'0')}.png`));assert.equal(file.readUInt32BE(16),width);assert.equal(file.readUInt32BE(20),height);
            for(const image of await s.locator('.media').all())if(await image.evaluate(el=>getComputedStyle(el).getPropertyValue('--slot-image').includes('data:image')))
              assert.equal(await image.locator('.ai').innerText(),'AI-generated image');
          }
        } finally {await page.close();}
      });
    }
    await check('video: 11 scenes, seekable paused animations and labelled images',async()=>{
      const page=await browser.newPage({viewport:{width:1920,height:1080},offline:true,reducedMotion:'no-preference'});
      try{await page.goto(pathToFileURL(resolve(out,'video/presentation.html')).href);assert.equal(await page.locator('.scene').count(),11);
        for(let i=0;i<11;i++){await page.evaluate(t=>window.seek(t),i*45/11+1.5);assert.ok(await page.evaluate(()=>document.getAnimations().every(a=>a.playState==='paused')));const scene=page.locator('.scene').nth(i),text=await scene.innerText();assert.ok(text.includes('Unofficial analysis')&&text.includes('Trademarks belong to their owners.'));for(const image of await scene.locator('.media').all())if(await image.evaluate(el=>getComputedStyle(el).getPropertyValue('--slot-image').includes('data:image')))assert.equal(await image.locator('.ai').innerText(),'AI-generated image');}
      }finally{await page.close();}
    });
    const host=new URL((JSON.parse(await readFile(resolve(out,'snapshot.json'),'utf8'))).target).hostname;
    const mp4=resolve(out,'video',`${host}-presentation-1920x1080-60fps.mp4`);
    let encoded=false;try{await access(mp4);encoded=true;}catch{}
    if(encoded)await check('video: encoded frame count, duration, colour and frame rate',async()=>{
      const probe=spawnSync(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,avg_frame_rate,nb_read_frames,pix_fmt,color_range,color_space,color_transfer,color_primaries:format=duration','-of','json',mp4],{encoding:'utf8',timeout:60000});
      if(probe.error)throw probe.error;assert.equal(probe.status,0,probe.stderr);
      const result=JSON.parse(probe.stdout),stream=result.streams[0];
      await writeFile(resolve(out,'video/probe.json'),JSON.stringify(result,null,2));
      assert.equal(stream.width,1920);assert.equal(stream.height,1080);assert.equal(stream.r_frame_rate,'60/1');assert.equal(stream.avg_frame_rate,'60/1');assert.equal(Number(stream.nb_read_frames),2700);assert.equal(stream.pix_fmt,'yuv420p');assert.equal(stream.color_range,'tv');assert.equal(stream.color_space,'bt709');assert.equal(stream.color_transfer,'bt709');assert.equal(stream.color_primaries,'bt709');assert.equal(Number(result.format.duration),45);
    });
  }finally{await browser.close();}
  const result={passed:failures.length===0,checks,failures,checkedAt:new Date().toISOString()};
  await writeFile(resolve(out,'verification.json'),JSON.stringify(result,null,2));
  console.log(`${result.passed?'PASS':'FAIL'}: ${checks.length-failures.length}/${checks.length} checks`);
  if(failures.length)throw new Error(failures.map(f=>`${f.name}\n${f.error}`).join('\n\n'));
  return result;
}

if(process.argv[1]&&basename(process.argv[1])==='verify.js')verify(resolve(process.argv[2]||'out')).catch(error=>{console.error(error.stack);process.exitCode=1;});
