import { fluid, oklch, rgb } from './analysis.js';

export function makeTokens(model) {
  const tokens = {}, vars = {};
  function add(group, name, css, type='string', value=css, status='reconstructed') {
    const key = `${group}-${name}`;
    (tokens[group] ||= {})[name] = { $type:type, $value:value,
      $extensions:{ 'reverse-brand':{ cssVariable:`--${key}`, css, status, source:model.source, ...(type==='color'?{hex:css,oklch:oklch(css)}:{}) } } };
    vars[key]=css;
  }
  function dim(group,name,value,status) { add(group,name,`${value}px`,'dimension',{value,unit:'px'},status); }
  const family=(model.families[0]?.name?.split(',')[0]||'Arial').replace(/[^\p{L}\p{N} _-]/gu,'');
  add('font','family',`"${family}", Arial, sans-serif`,'fontFamily',[family,'Arial','sans-serif'],model.families[0]?.status);
  add('font','mono','Consolas, monospace','fontFamily',['Consolas','monospace']);
  for (const [name, role] of Object.entries(model.roles)) {
    add('type',name,fluid(role.mobile,role.desktop),'string',fluid(role.mobile,role.desktop),role.status);
    add('type',`${name}-weight`,`${role.weight}`,'number',role.weight,role.status);
    add('type',`${name}-leading`,`${role.lineHeight}`,'number',role.lineHeight,role.status);
    add('type',`${name}-tracking`,`${role.tracking}em`,'string',`${role.tracking}em`,role.status);
  }
  for (const [name,hex] of Object.entries(model.colourRoles)) add('colour',name,hex,'color',{colorSpace:'srgb',components:rgb(hex),alpha:1},model.scope==='embedded-artwork'?'declared/sampled palette; role inferred':'measured host colour; role inferred');
  for (const n of [1,2,3,4,6,8,12,16,24,32]) dim('space',String(n),n*model.spacing.base,model.spacing.status||'derived from measured spacing distribution');
  const rec = model.reconstruction||{};
  dim('layout','container',model.layout.container,model.layout.status);
  dim('layout','gutter',model.layout.gutter,model.layout.status);
  add('layout','columns',String(model.layout.columns),'number',model.layout.columns,model.layout.status);
  dim('layout','edge',24); dim('layout','page-height',900); dim('layout','mobile-height',844);
  for (const [i, bp] of model.layout.breakpoints.entries()) add('layout',`breakpoint-${i+1}`,bp,'string',bp,model.layout.status);
  dim('radius','card',rec.cardRadius||parseFloat(model.cards[0]?.radius)||parseFloat(model.radii[0]?.[0])||24);
  dim('radius','control',rec.buttonRadius||parseFloat(model.buttons[0]?.radius)||999);
  dim('radius','pill',999);dim('radius','small',12);
  dim('button','height',rec.buttonHeight||model.buttons[0]?.rect.height||52);
  dim('button','padding-x',24);add('button','fill','var(--colour-action)');add('button','text','var(--colour-on-action)');add('button','radius','var(--radius-control)');
  add('button','font','var(--font-family)');add('button','size','var(--type-body)');add('button','weight','var(--type-h4-weight)');
  add('card','fill','var(--colour-surface)');add('card','text','var(--colour-text)');add('card','radius','var(--radius-card)');dim('card','padding',rec.cardPadding||model.cards[0]?.padding?.[0]||24);
  add('card','backdrop','blur(16px)');dim('card','media-height',240);
  dim('input','height',rec.inputHeight||model.input?.rect.height||52);dim('input','padding',model.input?.padding?.[1]||16);add('input','radius','var(--radius-control)');add('input','fill','var(--colour-background)');add('input','text','var(--colour-text)');
  dim('nav','height',rec.navHeight||model.nav?.rect.height||76);add('nav','fill','var(--colour-background)');add('nav','text','var(--colour-text)');
  dim('logo','width',144);dim('logo','height',40);add('logo','colour','var(--colour-text)');
  dim('stroke','width',1);dim('stroke','focus',3);
  const easingSource=rec.easing||model.easings?.find(([v])=>v!=='ease')?.[0]||'ease-out';
  const easing=easingSource.match(/^(?:cubic-bezier\(\s*[\d.+-]+\s*,\s*[\d.+-]+\s*,\s*[\d.+-]+\s*,\s*[\d.+-]+\s*\)|ease-in-out|ease-in|ease-out|ease|linear)(?=\s*(?:,|$))/)?.[0]||'ease-out';
  const named={linear:[0,0,1,1],ease:[.25,.1,.25,1],'ease-in':[.42,0,1,1],'ease-out':[0,0,.58,1],'ease-in-out':[.42,0,.58,1]};
  add('motion','easing',easing,'cubicBezier',named[easing]||easing.match(/[-+]?(?:\d*\.)?\d+/g).map(Number));
  add('motion','duration','650ms','duration',{value:650,unit:'ms'});add('motion','photo-duration','12000ms','duration',{value:12000,unit:'ms'});
  add('imagery','fallback','linear-gradient(135deg, var(--colour-surface) 0%, var(--colour-action) 46%, var(--colour-accent) 100%)');
  add('imagery','fallback-alt','linear-gradient(145deg, var(--colour-action-alt), var(--colour-surface), var(--colour-accent))');
  return { json:{ $description:`Unofficial analysis of ${model.brand}. Not affiliated with or endorsed by ${model.brand}. Trademarks belong to their owners.`,...tokens },
    css:`/* Unofficial analysis. All inferred values carry provenance in tokens.json. */\n:root {\n${Object.entries(vars).map(([key,value])=>`  --${key}: ${value};`).join('\n')}\n}\n`, vars };
}

export function flattenTokens(tokens) {
  return Object.values(tokens).filter(g=>g&&typeof g==='object').flatMap(g=>Object.values(g).filter(t=>t?.$value!==undefined));
}
