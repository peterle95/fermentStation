// Run: node prototypes/new_design/check.mjs. No dependencies or browser needed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

for (const device of ['phone', 'desktop']) {
  const html = fs.readFileSync(new URL(`./${device}/index.html`, import.meta.url), 'utf8');
  assert(!html.includes('__PHOTOS__') && !html.includes('__DEVICE__'), 'All assets embedded');
  assert(!/<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:/i.test(html), 'No external assets');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 3, 'No premature inline script closing tags');
  const module = scripts.find(([_, attributes]) => attributes.includes('module'))[2];
  const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: module, encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const source = scripts.find(([_, attributes, script]) => script.includes('const photos ='))[2];
  const nodes = new Map(), handlers = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', textContent: '', value: '', hidden: false, open: false,
      classList: { add() {}, remove() {} },
      addEventListener(event, fn) { handlers.set(`${selector}:${event}`, fn); },
      setAttribute() {}, removeAttribute() {}, focus() {},
      showModal() { this.open = true; }, close() { this.open = false; },
    });
    return nodes.get(selector);
  };
  const context = vm.createContext({
    document: {
      querySelector: node, querySelectorAll: () => [],
      addEventListener: (event, fn) => handlers.set(`document:${event}`, fn),
    },
    URLSearchParams, location: { search: '' }, setTimeout: () => 1, clearTimeout() {},
    FormData: class { constructor(form) { this.values = form.values; } get(name) { return this.values[name] ?? ''; } },
  });
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  const click = dataset => handlers.get('document:click')({ target: { closest: () => ({ dataset }) } });
  assert.equal(run('batches.length'), 4);
  assert.equal(run('visibleBatches().length'), 4);
  click({ filter: 'active' });
  assert.equal(run('visibleBatches().length'), 2);
  click({ filter: 'ready' });
  assert.equal(run('visibleBatches()[0].name'), 'Ginger kombucha');
  click({ filter: 'to-fridge' });
  assert.equal(run('visibleBatches()[0].name'), 'Classic sauerkraut');
  click({ filter: 'all' });
  handlers.get('#search:input')({ target: { value: 'KOMBUCHA' } });
  assert.equal(run('visibleBatches().length'), 1);
  handlers.get('#search:input')({ target: { value: 'nothing matches' } });
  assert.equal(run('visibleBatches().length'), 0);
  assert.match(node('#batch-list').innerHTML, /No batches found/);
  handlers.get('#see-all:click')();
  assert.equal(run('visibleBatches().length'), 4);
  handlers.get('#sort:click')();
  assert.equal(run('visibleBatches()[0].profile'), 'kraut');
  click({ batch: '2' });
  assert.match(node('#batch-detail').innerHTML, /Ginger kombucha/);
  click({ batch: '1' });
  click({ check: '1' });
  assert.equal(run('checks[0].done'), true);
  assert.equal(run('checks[0].next'), '2026-11-08');
  assert.equal(run('batches[0].entries[0].title'), 'Check completed');
  const submit = (id, values) => handlers.get('document:submit')({
    preventDefault() {}, target: { id, values },
  });
  submit('observation-form', { note: '<script>alert(1)</script>', temperature: '22.5' });
  assert.match(node('#batch-detail').innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(run('batches[0].temp'), 21, 'Historical reading does not change current batch input');
  submit('start-form', { name: 'Weekend batch', profile: 'kimchi', start: '2026-11-07' });
  assert.equal(run('batches.length'), 5);
  assert.equal(run('batches[0].finish'), '2026-11-14');
  assert.equal(run('checks.at(-1).due'), '8 Nov');
  assert.equal(run('batches[0].status'), 'active');
  submit('start-form', { name: 'Earlier batch', profile: 'kimchi', start: '2026-10-01' });
  assert.equal(run('batches[0].status'), 'ready', 'Past finish date becomes ready');
  assert.equal(run('daysBetween("2026-10-28","2026-11-07")'), 10);
  console.log(`${device}: PASS · embedded assets, syntax, filters, search, sort, details, checks, observations, batch creation`);
}
