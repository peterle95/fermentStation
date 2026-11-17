export const round = (n, p = 2) => Number(n.toFixed(p));
export const frequency = (values, weight = () => 1) => {
  const counts = new Map();
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) || 0) + weight(v));
  return [...counts].sort((a, b) => b[1] - a[1]);
};
export function rgb(hex) {
  if (!/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(hex)) throw new Error(`Not a normalised colour: ${hex}`);
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
}
const linear = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
export function contrast(a, b) {
  const luminance = hex => rgb(hex).map(linear).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return round((Math.max(x, y) + .05) / (Math.min(x, y) + .05));
}
export function oklch(hex) {
  const [r, g, b] = rgb(hex).map(linear);
  const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
  const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
  const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
  const L = .2104542553*l + .793617785*m - .0040720468*s;
  const a = 1.9779984951*l - 2.428592205*m + .4505937099*s;
  const bb = .0259040371*l + .7827717662*m - .808675766*s;
  const C = Math.hypot(a, bb);
  return `oklch(${round(L * 100, 2)}% ${round(C, 4)} ${C < .00001 ? 0 : round((Math.atan2(bb, a)*180/Math.PI+360)%360)})`;
}
export function fluid(mobile, desktop) {
  if (mobile === desktop) return `${desktop}px`;
  const slope = (desktop - mobile) / (1440 - 390);
  return `clamp(${Math.min(mobile, desktop)}px, ${round(mobile - slope * 390, 4)}px + ${round(slope * 100, 4)}vw, ${Math.max(mobile, desktop)}px)`;
}
export function dedupeChrome(pages) {
  const signature = e => JSON.stringify([e.tag, e.text, e.font, e.size, e.weight, e.colour, e.background, e.radius, e.padding, e.region]);
  const common = new Map();
  for (const p of pages) for (const [key, count] of frequency(p.elements.filter(e => e.region !== 'main').map(signature))) {
    if (!common.has(key)) common.set(key, []);
    common.get(key).push(count);
  }
  const repeated = new Set([...common].filter(([, counts]) => counts.length === pages.length && counts.every(c => c === counts[0])).map(([key]) => key));
  const elements = pages.flatMap((p, index) => p.elements.filter(e => index === 0 || e.region === 'main' || !repeated.has(signature(e))));
  return { elements, removed: pages.reduce((n, p) => n+p.elements.length, 0) - elements.length };
}
function palette(elements) {
  const map = new Map();
  for (const e of elements) for (const [kind, colour, amount] of [['text', e.colour, e.chars], ['background', e.background, e.rect.width*e.rect.height]]) {
    if (!colour || amount <= 0 || colour.length !== 7) continue;
    if (!map.has(colour)) map.set(colour, { hex: colour, oklch: oklch(colour), text: 0, background: 0 });
    map.get(colour)[kind] += amount;
  }
  const totals = [...map.values()].reduce((a, c) => ({ text: a.text+c.text, background: a.background+c.background }), { text: 0, background: 0 });
  return [...map.values()].map(c => ({ ...c, textShare: round(c.text/(totals.text || 1)*100), backgroundShare: round(c.background/(totals.background || 1)*100) })).sort((a,b) => b.background-a.background);
}
export function voiceStats(lines, headings = lines, ctas = []) {
  const words = s => s.match(/\b[\p{L}\p{N}]+(?:[’'-][\p{L}]+)*\b/gu) || [];
  const all = lines.join(' '), tokens = words(all);
  return { corpusLines: lines.length, words: tokens.length, meanHeadlineWords: round(headings.reduce((n,s)=>n+words(s).length,0)/(headings.length||1)),
    you: (all.match(/\byou(?:r)?\b/gi)||[]).length, we: (all.match(/\bwe(?:’re|'re)?\b/gi)||[]).length,
    numbers: (all.match(/\b\d+(?:\.\d+)?\b/g)||[]).length, exclamations: (all.match(/!/g)||[]).length,
    commaPattern: lines.filter(s=>/^[^,]+,[^,]+[.!]?$/.test(s)).length,
    sentenceCase: lines.filter(s=>/^[A-Z][a-z]/.test(s)).length,
    ctaVerbs: frequency(ctas.map(s=>words(s)[0]?.toLowerCase()).filter(Boolean)) };
}
export function analyse(snapshot, profile = null) {
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.pages) || !snapshot.pages.length) throw new Error('Unsupported or empty snapshot.');
  const desktop = snapshot.pages.filter(p=>p.viewport.width===1440);
  if (!desktop.length) throw new Error('Snapshot needs a 1440px desktop pass.');
  const { elements, removed } = dedupeChrome(desktop);
  const colours = palette(elements);
  const spacingValues = frequency(elements.flatMap(e=>[...e.padding,...e.margin,...e.gap]).filter(x=>Number.isFinite(x)&&x>0).map(x=>round(x)));
  const base = [8,4,2].find(n=>spacingValues.filter(([v])=>Math.abs(v/n-Math.round(v/n))<.03).reduce((sum,[,c])=>sum+c,0)/Math.max(1,spacingValues.reduce((s,[,c])=>s+c,0))>=.75) || 2;
  const headings = desktop.flatMap(p=>p.headings.filter(h=>h.text && h.style));
  const clusters = [];
  for (const h of [...headings].sort((a,b)=>b.style.size-a.style.size)) {
    const cluster = clusters.find(c=>Math.abs(c[0].style.size-h.style.size)/c[0].style.size<=.12);
    if (cluster) cluster.push(h); else clusters.push([h]);
  }
  const body = elements.filter(e=>e.chars>20 && e.tag==='p');
  const bodySize = frequency(body.map(e=>e.size))[0]?.[0] || 16;
  const roles = {};
  for (const [index, name] of ['display','h1','h2','h3','h4','lead','body','small'].entries()) {
    const cluster = clusters[Math.min(index, clusters.length-1)];
    const h = cluster?.[0], style = h?.style;
    const fallback = { display:64,h1:48,h2:36,h3:28,h4:24,lead:20,body:bodySize,small:14 }[name];
    const size = index<5 ? style?.size || fallback : fallback;
    const mobile = snapshot.pages.filter(p=>p.viewport.width===390).flatMap(p=>p.headings).find(m=>m.text===h?.text)?.style;
    roles[name] = { desktop:size, mobile:index<5 ? mobile?.size||size : size, weight:Number(style?.weight)||400,
      lineHeight:style?.lineHeight ? round(style.lineHeight/style.size,3) : 1.4, tracking:style ? round(style.tracking/style.size,4) : 0,
      status:index<5&&style ? 'measured host DOM; role assigned' : 'inferred role', font:style?.font||body[0]?.font||'Arial, sans-serif' };
  }
  const main = desktop.find(p=>p.url===snapshot.target)||desktop[0];
  const quotes = [...new Set(main.headings.map(h=>h.text).concat(main.paragraphs.map(p=>p.text)).filter(s=>s.trim()&&s.split(/\s+/).length<=15))].slice(0,5).map(text=>({text,source:main.url,status:'host DOM quote'}));
  const bg = colours.find(c=>c.background>0)?.hex||'#ffffff';
  const text = [...colours].sort((a,b)=>b.text-a.text)[0]?.hex||'#1c1c1c';
  const buttons = main.buttons;
  const variants = [...new Map(buttons.map(b=>[JSON.stringify([b.background,b.borderWidth,b.radius]),b])).values()].slice(0,6);
  const rolesColour = { background:bg, surface:colours.find(c=>c.hex!==bg)?.hex||bg, 'surface-inverse':text, text,
    'text-muted':text, 'text-inverse':bg, action:variants.find(b=>b.background)?.background||text, 'on-action':bg, 'action-alt':bg, accent:colours[2]?.hex||text, border:text };
  const model = {
    brand:new URL(snapshot.target).hostname.replace(/^www\./,''), source:snapshot.target, scope:'website', elements:elements.length, removedChrome:removed,
    pages:desktop.map(p=>({url:p.url,elements:p.elements.length})), colours, colourRoles:rolesColour, roles,
    families:frequency(elements.filter(e=>e.chars).map(e=>e.font)).map(([name,count])=>({name,share:round(count/elements.filter(e=>e.chars).length*100),weights:[...new Set(elements.filter(e=>e.font===name).map(e=>e.weight))],status:'host DOM'})),
    spacing:{base,onGrid:spacingValues.filter(([v])=>v%base===0),offGrid:spacingValues.filter(([v])=>v%base!==0)},
    layout:{container:frequency(elements.map(e=>parseFloat(e.maxWidth)).filter(n=>n>600&&n<1440))[0]?.[0]||1200,columns:12,gutter:24,breakpoints:[...new Set(desktop.flatMap(p=>p.breakpoints))],status:'container measured when available; columns and gutter reconstructed'},
    buttons:variants, cards:main.cards.slice(0,8), input:main.forms[0]||null, nav:main.header,
    radii:frequency(elements.map(e=>e.radius).filter(r=>r!=='0px')).slice(0,12),
    gradients:frequency(elements.map(e=>e.gradient).filter(Boolean)), easings:frequency(elements.map(e=>e.easing)),
    imagery:{count:main.media.length,mediaAreaShare:round(main.media.reduce((n,m)=>n+m.rect.width*m.rect.height,0)/(1440*main.height)*100),fullBleedShare:round(main.media.filter(m=>m.rect.width>=1440*.9).length/Math.max(1,main.media.length)*100),objectFit:frequency(main.media.map(m=>m.objectFit)),formats:frequency(main.media.map(m=>m.source?.split(/[?#]/)[0].split('.').pop()||m.tag)),themes:main.media.map(m=>m.alt).filter(Boolean).slice(0,18)},
    rhythm:main.sections.map(s=>({heading:s.heading,background:s.background,y:s.rect.y})), quotes,
    voice:voiceStats(quotes.map(q=>q.text),main.headings.map(h=>h.text).filter(Boolean),buttons.map(b=>b.text)),
    rules:[], assumptions:[...new Set(desktop.flatMap(p=>p.limitations)),'Colour roles are assigned, not original named variables.','Offline fonts use locally installed families only; unavailable fonts fall back to Arial.','Missing role sizes, grid columns, gutters and form components are explicitly reconstructed.'],
    declaredVariables:main.root,
  };
  if (profile) {
    if (profile.source !== snapshot.target) throw new Error('Profile source does not match snapshot target.');
    for (const key of ['brand','scope','colourRoles','roles','families','layout','quotes','rules','reconstruction','rasterEvidence','photography']) if (profile[key]) model[key]=profile[key];
    model.assumptions.push(...(profile.assumptions||[]));
    if (profile.scope==='embedded-artwork') {
      model.hostMeasurements={spacing:model.spacing,buttons:model.buttons,cards:model.cards,input:model.input,nav:model.nav,radii:model.radii,rhythm:model.rhythm,declaredVariables:model.declaredVariables,imagery:model.imagery};
      model.spacing={base:4,onGrid:[4,8,12,16,24,32,48,64,96].map(v=>[v,null]),offGrid:[],status:'reconstructed; original app spacing unavailable'};
      model.buttons=[];model.cards=[];model.input=null;model.nav=null;model.radii=[];model.gradients=[];model.rhythm=[];model.declaredVariables={};
      model.voice=voiceStats(model.quotes.map(q=>q.text),model.quotes.map(q=>q.text),profile.ctas||[]);
    }
  }
  if (!model.rules.length) model.rules=[
    `Keep headlines near the observed mean of ${model.voice.meanHeadlineWords} words; this is a sample, not a rule from the owner.`,
    `Use the observed address balance: ${model.voice.you} “you/your” and ${model.voice.we} “we” in the quote corpus.`,
    `Match punctuation deliberately: ${model.voice.exclamations} exclamation marks and ${model.voice.commaPattern} single-comma lines in ${model.voice.corpusLines} quotes.`,
  ];
  const sizes=[...new Set(Object.values(model.roles).map(r=>r.desktop))].sort((a,b)=>a-b);
  const ratios=sizes.slice(1).map((n,i)=>n/sizes[i]);
  model.scaleRatio=round(ratios.reduce((n,r)=>n+r,0)/Math.max(1,ratios.length),3);
  model.scaleInterval=[['minor second',1.067],['major second',1.125],['minor third',1.2],['major third',1.25],['perfect fourth',1.333],['augmented fourth',1.414],['perfect fifth',1.5],['golden ratio',1.618]].sort((a,b)=>Math.abs(a[1]-model.scaleRatio)-Math.abs(b[1]-model.scaleRatio))[0][0];
  model.contrastPairs=[['text','background'],['text','surface'],['text-inverse','surface-inverse'],['on-action','action'],['text-muted','background']].map(([fg,bg])=>({fg,bg,ratio:contrast(model.colourRoles[fg],model.colourRoles[bg]),status:'reconstructed role pair; not claimed as most-read app pairs'}));
  return model;
}
