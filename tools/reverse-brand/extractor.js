// This function is deliberately self-contained: Playwright and the DevTools fallback use it unchanged.
export function extract() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const hex = value => {
    if (!value || value === 'none') return null;
    // SVG paint-server URLs are not colours; canvas otherwise silently retains its previous fill.
    if (!CSS.supports('color', value)) return null;
    if (cache.has(value)) return cache.get(value);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const rgba = [...ctx.getImageData(0, 0, 1, 1).data];
    const result = rgba[3] === 0 ? null : '#' + rgba.map(x => x.toString(16).padStart(2, '0')).slice(0, rgba[3] === 255 ? 3 : 4).join('');
    cache.set(value, result);
    return result;
  };
  const round = n => Math.round(n * 100) / 100;
  const rect = el => {
    const r = el.getBoundingClientRect();
    return { x: round(r.x), y: round(r.y + scrollY), width: round(r.width), height: round(r.height) };
  };
  const excluded = el => {
    if (el.closest('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],script,style,noscript,template')) return true;
    const dialog = el.closest('[role="dialog"],dialog');
    return dialog && /cookies|consent|privacy preferences|accept all/i.test(dialog.innerText);
  };
  const visible = el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return !excluded(el) && s.display !== 'none' && s.visibility === 'visible' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
  };
  const text = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  const elements = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el), r = rect(el), t = text(el);
    const region = el.closest('header,[role="banner"]') ? 'header' : el.closest('footer,[role="contentinfo"]') ? 'footer' : 'main';
    elements.push({
      tag: el.tagName.toLowerCase(), region, text: t, chars: t.length, rect: r,
      font: s.fontFamily, size: parseFloat(s.fontSize), weight: s.fontWeight,
      lineHeight: s.lineHeight === 'normal' ? null : parseFloat(s.lineHeight), tracking: s.letterSpacing === 'normal' ? 0 : parseFloat(s.letterSpacing),
      colour: hex(s.color), background: hex(s.backgroundColor), border: hex(s.borderTopColor), fill: hex(s.fill), fillSource:s.fill,
      borderWidth: parseFloat(s.borderTopWidth), gradient: /gradient\(/.test(s.backgroundImage) ? s.backgroundImage : null,
      padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat),
      margin: [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft].map(parseFloat),
      gap: [parseFloat(s.rowGap) || 0, parseFloat(s.columnGap) || 0], radius: s.borderRadius,
      shadow: s.boxShadow, maxWidth: s.maxWidth, columns: s.gridTemplateColumns, easing: s.transitionTimingFunction,
      backdrop: s.backdropFilter, position: s.position,
    });
  }
  const compact = el => {
    const s = getComputedStyle(el);
    const painted = [el, ...el.querySelectorAll('*')].filter(visible).find(x => {
      const c = getComputedStyle(x);
      return hex(c.backgroundColor) || parseFloat(c.borderTopWidth) > 0;
    }) || el;
    const p = getComputedStyle(painted);
    return { text: el.innerText?.replace(/\s+/g, ' ').trim().slice(0, 180) || '', rect: rect(el),
      paintedRect: rect(painted), background: hex(p.backgroundColor), colour: hex(s.color), border: hex(p.borderTopColor),
      borderWidth: parseFloat(p.borderTopWidth), radius: p.borderRadius,
      padding: [p.paddingTop, p.paddingRight, p.paddingBottom, p.paddingLeft].map(parseFloat),
      backdrop: p.backdropFilter, font: s.fontFamily, size: parseFloat(s.fontSize), weight: s.fontWeight,
      media: painted.querySelectorAll('img,video,picture').length,
    };
  };
  const headings = [...document.querySelectorAll('h1,h2,h3,h4')].filter(visible).map(el => ({ ...compact(el), tag: el.tagName.toLowerCase(), text: el.innerText.replace(/\s+/g, ' ').trim(), style: elements.find(e => e.tag === el.tagName.toLowerCase() && e.rect.y === rect(el).y) }));
  const paragraphs = [...document.querySelectorAll('p')].filter(visible).map(el => ({ text: el.innerText.replace(/\s+/g, ' ').trim(), rect: rect(el), region: el.closest('header,footer') ? 'chrome' : 'main' }));
  const buttons = [...document.querySelectorAll('button,[role="button"],a')].filter(visible).filter(el => {
    const c = compact(el);
    return c.text && c.text.length <= 90 && c.rect.height >= 28 && c.rect.height < 130 && (el.tagName !== 'A' || c.background || c.borderWidth > 0);
  }).map(compact);
  const cards = [...document.querySelectorAll('article,[class*="card" i],a')].filter(visible).filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 180 && r.height > 140 && r.width < innerWidth * .96;
  }).map(compact);
  const media = [...document.querySelectorAll('img,video,svg')].filter(visible).map(el => {
    const s = getComputedStyle(el);
    return { tag: el.tagName.toLowerCase(), rect: rect(el), alt: el.getAttribute('alt') || el.getAttribute('aria-label') || '',
      source: el.currentSrc || el.getAttribute('src') || null, objectFit: s.objectFit,
      naturalWidth: el.naturalWidth || el.videoWidth || null, naturalHeight: el.naturalHeight || el.videoHeight || null };
  });
  const root = {}, breakpoints = new Set(), inaccessibleStylesheets = [];
  const rs = getComputedStyle(document.documentElement);
  for (const key of rs) if (key.startsWith('--')) root[key] = rs.getPropertyValue(key).trim();
  function rules(list) {
    for (const rule of list) {
      if (rule.media) for (const m of rule.conditionText.matchAll(/(?:min|max)-width\s*:\s*([\d.]+)(px|em|rem)/g)) breakpoints.add(m[1] + m[2]);
      if (rule.cssRules) rules(rule.cssRules);
      if (rule.selectorText?.includes(':root') && rule.style) for (const key of rule.style) if (key.startsWith('--')) root[key] = rs.getPropertyValue(key).trim();
    }
  }
  for (const sheet of document.styleSheets) { try { rules(sheet.cssRules); } catch { inaccessibleStylesheets.push(sheet.href); } }
  const header = document.querySelector('header,[role="banner"]');
  const nav = document.querySelector('nav');
  const logo = header?.querySelector('[class*="logo" i],img,svg');
  const sections = [...document.querySelectorAll('main > section,main > div > section,section')].filter(visible).map(el => ({ rect: rect(el), background: hex(getComputedStyle(el).backgroundColor), heading: el.querySelector('h1,h2,h3')?.innerText || '' }));
  return { url: location.href, title: document.title, viewport: { width: innerWidth, height: innerHeight }, height: document.documentElement.scrollHeight,
    elements, headings, paragraphs, buttons, cards, media, root, breakpoints: [...breakpoints], inaccessibleStylesheets,
    forms: [...document.querySelectorAll('input:not([type="hidden"]),textarea,select')].filter(visible).map(compact),
    header: header ? { ...compact(header), position: getComputedStyle(header).position, links: [...header.querySelectorAll('a')].filter(visible).map(compact),
      logo: logo ? { rect: rect(logo), colour: hex(getComputedStyle(logo).color), fill: hex(getComputedStyle(logo).fill) } : null } : null,
    nav: nav ? compact(nav) : null, sections,
    links: [...document.querySelectorAll('a[href]')].filter(visible).map(a => ({ url: a.href, text: a.innerText.trim(), nav: !!a.closest('header,nav') })),
    limitations: ['Computed DOM styles describe the host page, not typography or layout rasterised inside artwork.', 'Background areas overlap; painted-area weights are estimates, not exclusive pixel coverage.', 'Normal line-height is unknown; no font files or source images are exported.'] };
}

export function devtoolsSnippet() {
  return `/* Unofficial analysis. Run on the source origin after completing any browser check yourself. */\n(async()=>{const extract=${extract.toString()};const pages=[];for(const [width,height] of [[1440,900],[390,844]]){const f=document.createElement('iframe');f.style.cssText='position:fixed;z-index:2147483647;top:0;left:0;border:0;width:'+width+'px;height:'+height+'px';document.body.append(f);f.src=location.href;try{await new Promise((ok,no)=>{f.onload=ok;f.onerror=no});const w=f.contentWindow;await w.document.fonts.ready;for(let y=0;y<w.document.documentElement.scrollHeight;y+=height){w.scrollTo(0,y);await new Promise(r=>setTimeout(r,150))}w.scrollTo(0,0);pages.push(w.eval('('+extract.toString()+')()'))}finally{f.remove()}}const blob=new Blob([JSON.stringify({schemaVersion:1,capturedAt:new Date().toISOString(),target:location.href,pages,limitations:['Manual same-origin iframe capture; crawl not performed.']},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='snapshot.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)})().catch(console.error);`;
}
