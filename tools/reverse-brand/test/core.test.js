import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { contrast, oklch, fluid, dedupeChrome, voiceStats, analyse } from '../analysis.js';
import { scoreLinks } from '../capture.js';
import { publicUrl, launch } from '../browser.js';
import { makeTokens, flattenTokens } from '../tokens.js';
import { guide } from '../guide.js';
import { extract, devtoolsSnippet } from '../extractor.js';
import { makePrompts, importImages, embeddedImages } from '../images.js';

test('colour conversion and WCAG reference pairs',()=>{
  assert.equal(contrast('#000000','#ffffff'),21);assert.equal(contrast('#ffffff','#ffffff'),1);
  assert.equal(oklch('#ffffff'),'oklch(100% 0 0)');assert.equal(oklch('#000000'),'oklch(0% 0 0)');
  assert.throws(()=>contrast('red','#ffffff'),/normalised/);
});
test('fluid size interpolates between the actual capture widths',()=>{
  assert.equal(fluid(18,18),'18px');assert.equal(fluid(48,96),'clamp(48px, 30.1714px + 4.5714vw, 96px)');
});
test('chrome dedupe only removes identical counts present on every page',()=>{
  const element={tag:'a',region:'header',text:'Home',font:'Arial',size:16,weight:'400',colour:'#000000',background:null,radius:'0px',padding:[0,0,0,0]};
  const result=dedupeChrome([{elements:[element,element]},{elements:[element,element]}]);assert.equal(result.removed,2);assert.equal(result.elements.length,2);
  assert.equal(dedupeChrome([{elements:[element]},{elements:[element,element]}]).removed,0);
});
test('crawl chooses one top-level path and rejects unwanted links',()=>{
  const links=[['/product/a',false],['/product/b',true],['/pricing',true],['/privacy',true],['/en',true],['/login',true],['https://elsewhere.example/about',true],['/file.png',true],['/about#team',true]].map(([path,nav])=>({url:new URL(path,'https://brand.example').href,nav,text:path}));
  assert.deepEqual(scoreLinks(links,'https://brand.example').map(l=>new URL(l.url).pathname),['/pricing','/product/b']);
});
test('public URL validation rejects credentials and private literal targets',()=>{
  for(const url of ['file:///secret','https://a:b@example.com','http://127.0.0.1','http://2130706433','http://169.254.169.254','http://[::1]','http://192.168.1.1'])assert.throws(()=>publicUrl(url));
  assert.equal(publicUrl('https://example.com/path#anchor').href,'https://example.com/path');
});
test('voice stats are explicit about corpus size',()=>{
  const stats=voiceStats(['You can try 2 drinks!','We share, you choose.'],['Two drinks'],['Try drinks']);
  assert.equal(stats.corpusLines,2);assert.equal(stats.you,2);assert.equal(stats.we,1);assert.equal(stats.exclamations,1);assert.equal(stats.numbers,1);assert.equal(stats.meanHeadlineWords,2);assert.deepEqual(stats.ctaVerbs,[['try',1]]);
});
test('extractor captures modern colour, painted children and excludes consent UI',async()=>{
  const browser=await launch();
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.setContent(`<style>:root{--brand:oklch(70% .1 130)}body{margin:0;color:#111}h1{font:500 64px/1.1 Arial;letter-spacing:-2px}.paint{display:block;background:var(--brand);padding:16px 24px;border-radius:24px}a{display:inline-block}.card{width:300px;height:200px;background:lab(90% 0 0)}@media(max-width:640px){h1{font-size:32px}}</style><header><a href="/">Home</a></header><h1>Drinks</h1><a href="/product"><span class="paint">Choose drinks</span></a><article class="card">Product</article><p>Visible source paragraph.</p><div id="cookie-consent"><button>Accept all cookies</button></div><div role="dialog">Privacy preferences <button>Consent</button></div>`);
    await page.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<svg width="80" height="80"><defs><linearGradient id="paint-test"><stop stop-color="red"/></linearGradient></defs><rect width="60" height="60" fill="url(#paint-test)"/></svg>'));
    const data=await page.evaluate(extract);
    assert.equal(data.headings[0].style.size,64);assert.equal(data.root['--brand'],'oklch(70% .1 130)');assert.ok(data.breakpoints.includes('640px'));
    assert.ok(!data.elements.some(e=>/Accept all|Privacy preferences|Consent/.test(e.text)));
    const button=data.buttons.find(b=>b.text==='Choose drinks');assert.match(button.background,/^#[a-f\d]{6}$/i);assert.equal(button.radius,'24px');assert.deepEqual(button.padding,[16,24,16,24]);
    assert.ok(data.cards.length>0);assert.ok(data.elements.some(e=>e.background&&e.tag==='article'));
    assert.equal(data.elements.find(e=>e.tag==='rect').fill,null);assert.ok(data.elements.find(e=>e.tag==='rect').fillSource.includes('paint-test'));
  }finally{await browser.close();}
});
test('fallback serialises the same self-contained extractor',()=>{
  const snippet=devtoolsSnippet();assert.ok(snippet.includes(extract.toString()));assert.ok(snippet.includes('1440,900'));assert.ok(snippet.includes('390,844'));assert.ok(snippet.includes("download='snapshot.json'"));
  new Function(snippet);
});

const style={tag:'h1',region:'main',text:'Example brand',chars:13,font:'Arial, sans-serif',size:64,weight:'500',lineHeight:70.4,tracking:-2,colour:'#1c1c1c',background:'#ffffff',padding:[0,0,0,0],margin:[0,0,0,0],gap:[0,0],rect:{x:0,y:0,width:800,height:71},radius:'0px',maxWidth:'1200px',easing:'ease',columns:'none'};
function snapshot(){return {schemaVersion:1,target:'https://example.com/',pages:[{url:'https://example.com/',viewport:{width:1440,height:900},height:2000,elements:[style],headings:[{text:'Example brand',style,rect:style.rect}],paragraphs:[],buttons:[],cards:[],forms:[],media:[],sections:[],breakpoints:['640px'],root:{},header:null}]};}
test('profile cannot silently change the target identity',()=>assert.throws(()=>analyse(snapshot(),{source:'https://other.example'}),/does not match/));
test('CSS and DTCG JSON have identical token sets and colour provenance',()=>{
  const model=analyse(snapshot()),tokens=makeTokens(model),flat=flattenTokens(tokens.json);
  for(const token of flat)assert.ok(tokens.css.includes(`${token.$extensions['reverse-brand'].cssVariable}: `));
  assert.equal(flat.length,Object.keys(tokens.vars).length);assert.equal(tokens.json.colour.background.$value.colorSpace,'srgb');assert.ok(tokens.json.colour.background.$extensions['reverse-brand'].oklch.startsWith('oklch('));
});
test('guide escapes target text and stays within the light budget',async()=>{
  const profile=JSON.parse(await readFile(new URL('../profiles/swipe.json',import.meta.url)));
  const data=snapshot();data.target=profile.source;data.pages[0].url=profile.source;
  const model=analyse(data,profile);model.brand='<script>alert(1)</script>';
  const html=guide(model,makeTokens(model),{},makePrompts(model));assert.ok(Buffer.byteLength(html)<150000);assert.ok(!html.includes('<script>alert(1)</script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('data:image/'));
});
test('font names cannot escape the generated style element',()=>{
  const model=analyse(snapshot());model.families[0].name='Evil</style><script>alert(1)</script>';
  const tokens=makeTokens(model);assert.ok(!tokens.css.includes('</style>'));assert.ok(!tokens.css.includes('<script>'));
});
test('typography image attribution stays clear of the explanatory text',async()=>{
  const profile=JSON.parse(await readFile(new URL('../profiles/swipe.json',import.meta.url)));
  const data=snapshot();data.target=profile.source;data.pages[0].url=profile.source;
  const model=analyse(data,profile),tokens=makeTokens(model);
  const image=await sharp({create:{width:16,height:9,channels:3,background:'#b6e1fa'}}).webp().toBuffer();
  const browser=await launch();
  try{
    const page=await browser.newPage({reducedMotion:'reduce'});
    await page.setContent(guide(model,tokens,{horizon:`data:image/webp;base64,${image.toString('base64')}`},makePrompts(model)));
    await page.evaluate(()=>window.fontCheck);
    for(const width of [1440,1024,768,390]){
      await page.setViewportSize({width,height:900});
      const bounds=await page.locator('#typography').evaluate(el=>{
        const text=el.querySelector('.wrap>p.small').getBoundingClientRect(),credit=el.querySelector('.ai-credit').getBoundingClientRect(),section=el.getBoundingClientRect();
        return {textBottom:text.bottom,creditTop:credit.top,creditBottom:credit.bottom,sectionBottom:section.bottom};
      });
      assert.ok(bounds.creditTop>=bounds.textBottom+8,`${width}px: ${JSON.stringify(bounds)}`);
      assert.ok(bounds.creditBottom<=bounds.sectionBottom,`${width}px: credit outside section`);
    }
  }finally{await browser.close();}
});
test('multiple CSS easing values become one valid animation easing',()=>{
  const model=analyse(snapshot());model.easings=[['cubic-bezier(0.2, 0.8, 0.2, 1), ease',20]];
  const tokens=makeTokens(model);assert.equal(tokens.vars['motion-easing'],'cubic-bezier(0.2, 0.8, 0.2, 1)');assert.deepEqual(tokens.json.motion.easing.$value,[.2,.8,.2,1]);
});
test('manual import preserves originals and embeds a WebP only once',async()=>{
  const tempBase=process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'Temp','opencode'):tmpdir();
  await mkdir(tempBase,{recursive:true});
  const temp=await mkdtemp(join(tempBase,'reverse-brand-test-'));
  try{
    await mkdir(join(temp,'images'));const original=await sharp({create:{width:2200,height:1100,channels:3,background:'#b6f074'}}).png().toBuffer();await writeFile(join(temp,'images/hero.png'),original);
    const model=analyse(snapshot()),prompts=makePrompts(model),manifest=await importImages(temp,prompts);assert.equal(manifest.length,1);assert.equal(manifest[0].width,2000);assert.deepEqual(await readFile(join(temp,'images/hero.png')),original);
    const images=await embeddedImages(temp,manifest),html=guide(model,makeTokens(model),images,prompts);assert.equal((html.match(/data:image\/webp;base64/g)||[]).length,1);assert.ok(html.includes('AI-generated image'));
    await assert.rejects(()=>embeddedImages(temp,[{slot:'hero',path:'../../secret'}]),/Invalid image manifest/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
