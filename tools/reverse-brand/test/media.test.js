import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { launch } from '../browser.js';
import { makeTokens } from '../tokens.js';
import { presentation } from '../media.js';

test('presentation seeking is repeatable, paused and independently disclosed in every scene',async()=>{
  const profile=JSON.parse(await readFile(new URL('../profiles/swipe.json',import.meta.url)));
  const model={...profile,spacing:{base:4},cards:[],buttons:[],radii:[],input:null,nav:null,easings:[],voice:{corpusLines:5,words:41,exclamations:4,you:0,we:0}};
  const browser=await launch();
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    await page.setContent(presentation(model,makeTokens(model),{},{animated:true}));await page.waitForFunction(()=>window.mediaReady);
    const hash=async t=>{await page.evaluate(t=>window.seek(t),t);return createHash('sha256').update(await page.screenshot()).digest('hex');};
    const first=await hash(2);assert.notEqual(await hash(16),first);assert.equal(await hash(2),first);
    assert.ok(await page.evaluate(()=>document.getAnimations().length>30&&document.getAnimations().every(a=>a.playState==='paused')));
    assert.equal(await page.locator('.scene').count(),11);
    for(const scene of await page.locator('.scene').all())assert.ok((await scene.innerText()).includes('Unofficial analysis')&&(await scene.innerText()).includes('Trademarks belong to their owners.'));
    assert.equal(await page.locator('pre').innerText(),':root {\n  --colour-action: #b6f074;\n  --radius-card: 32px;\n}\n/* geometry inferred */');
  }finally{await browser.close();}
});
