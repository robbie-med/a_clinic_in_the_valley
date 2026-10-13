// Headless play-test (adapted from dont get lost): serves the game on 127.0.0.1:3411, opens a clinic
// in Chromium, walks, gathers a herb, makes a remedy, sees a patient through the whole consultation
// (talk, tap the body, diagnose, prescribe, finish), opens every panel, sleeps, reloads. Screenshots
// go to outDir. Fails on any page error.
//   node tools/playtest.mjs [outDir] [--mobile] [--lang ko]
// With --lang, every screenshot also scans the visible text for leftover English and the run fails on any,
// or on any key the language pack lacks (i18n.js MISSING).
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'playtest-out';
const mobile = process.argv.includes('--mobile');
const lang = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : null;
mkdirSync(out, { recursive: true });
const PORT = +process.env.PORT || 3411;
const server = await serve(PORT);
const errors = [];
let browser;
const leftovers = new Map(); // English word → where seen
// words that may stay in Latin script on a translated screen: units, abbreviations, credits, key names
const KEEP = /^(mg|ml|kg|mmHg|min|MUAC|WTND|HIV|AIDS|ORS|TB|BCG|DMPA|INH|PID|MIC|MRSA|IU|EN|English|Esc|Tab|Shift|Enter|Space|Phaser|ZzFX|nipplejs|Dungeon|Crawl|Stone|Soup|CC0|CC|BY|OFL|Hesperian|Health|Guides|David|Werner|Where|There|Is|No|Doctor|game-icons|net|Galmuri|IndexedDB|ec50|WASD|L|g|h)$/i;
async function scan(page, name) {
  if (!lang) return;
  const words = await page.evaluate(async () => {
    // Latin names and families, and citations (class "cite"), stay as written in every language
    const latin = new Set((await import('/js/core/content/flora.js')).FLORA.flatMap((f) => [f.n, f.f]));
    for (const h of (await import('/js/core/content/herbs.js')).HERBS) { latin.add(h.latin); latin.add(h.family); }
    const read = (sel) => { const el = document.querySelector(sel); if (!el) return ''; const c = el.cloneNode(true); c.querySelectorAll('.cite').forEach((x) => x.remove()); document.body.append(c); const s = c.innerText; c.remove(); return s; };
    let text = [read('#ui'), read('#title:not(.hidden)')].join('\n');
    for (const n of [...latin].sort((a, b) => b.length - a.length)) text = text.split(n).join(' ');
    return text.match(/[A-Za-z][A-Za-z'-]{2,}/g) || [];
  });
  for (const w of words) if (!KEEP.test(w) && !leftovers.has(w)) leftovers.set(w, name);
}
// a label as the page shows it now (the English key through i18n.js t(); with no --lang it is the English)
const tr = (page, key) => page.evaluate(async (k) => (await import('/js/core/i18n.js')).t(k), key);
const shot = async (page, name) => { await scan(page, name); return page.screenshot({ path: `${out}/${name}.png` }); };
try {
  await sleep(700);
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext(mobile ? { viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (lang) await ctx.addInitScript((l) => { try { localStorage.setItem('nd.settings', JSON.stringify({ ...JSON.parse(localStorage.getItem('nd.settings') || '{}'), lang: l })); } catch {} }, lang);
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForSelector('#start', { timeout: 20000 });
  await page.fill('#wseed', 'playtest');
  await shot(page, '0-title');
  await page.click('#start');
  await page.waitForFunction(() => window.nd?.scene?.walkers, null, { timeout: 30000 });
  await sleep(1200);
  await shot(page, '1-start');
  const start = await page.evaluate(() => { const G = window.nd; return { x: G.p.x, y: G.p.y, village: G.W.R.village.name, hamlets: G.W.R.hamlets.map((h) => h.name), vendors: [...G.scene.walkers.values()].filter((w) => w.kind === 'vendor').map((w) => w.vendor.id) }; });
  console.log('start', JSON.stringify(start));
  if (!mobile) { await page.keyboard.down('s'); await sleep(900); await page.keyboard.up('s'); }
  else { await page.evaluate(() => { window.nd.input.joy.y = 1; }); await sleep(900); await page.evaluate(() => { window.nd.input.joy.y = 0; }); }

  // gather the nearest guava, make a decoction at the hearth
  const herb = await page.evaluate(() => {
    const G = window.nd, { W, p } = G;
    let best = null;
    for (let y = 0; y < W.N; y++) for (let x = 0; x < W.N; x++) { const o = W.objDef(x, y); if (o?.herb === 'guava') { const d = Math.hypot(x - p.x, y - p.y); if (!best || d < best.d) best = { x, y, d }; } }
    p.x = best.x + 0.5; p.y = best.y + 1.5;
    G.scene.act(best.x, best.y);
    const got = p.inv.slots.find((s) => s?.id === 'fresh_guava');
    const hearth = (() => { for (let y = 0; y < W.N; y++) for (let x = 0; x < W.N; x++) if (W.obj(x, y) === 'hearth') return { x, y }; })();
    p.x = hearth.x + 0.5; p.y = hearth.y + 1.5;
    G.scene.sampleStations();
    return { got: got && { n: got.n, q: got.q }, hearth, stations: [...G.stations] };
  });
  console.log('herb', JSON.stringify(herb));
  await page.evaluate(() => window.nd.ui.open('make'));
  await sleep(300);
  await page.locator('.recipe', { hasText: await page.evaluate(() => window.nd.C.items.get('decoction_guava').name) }).first().click();
  await page.locator('.detail button.primary', { hasText: await tr(page, 'Make') }).click();
  await sleep(300);
  await shot(page, '2-make');
  const brew = await page.evaluate(() => { const s = window.nd.p.inv.slots.find((x) => x?.id === 'decoction_guava'); return s && { n: s.n, q: s.q }; });
  console.log('made', JSON.stringify(brew));
  if (!brew) throw new Error('decoction not made');
  await page.evaluate(() => window.nd.ui.close());

  // a patient: jump the clock to the first arrival, let them walk in
  const arrival = await page.evaluate(() => {
    const G = window.nd;
    const d = Math.floor(G.meta.time / 1440) + 1;
    const plan = G.meta.clinic.sched[d] || [];
    return plan.length;
  });
  await page.evaluate(() => { window.nd.meta.time = Math.floor(window.nd.meta.time / 1440) * 1440 + 9.5 * 60; });
  await page.waitForFunction(() => Object.values(window.nd.meta.clinic.patients).some((p) => p.status === 'waiting'), null, { timeout: 90000 });
  await sleep(500);
  await shot(page, '3-waiting');
  await page.click('.waitbtn');
  await page.waitForSelector('.panel.encounter');
  const pt = await page.evaluate(() => { const p = Object.values(window.nd.meta.clinic.patients).find((q) => q.status === 'consult'); return { id: p.id, name: p.name, age: p.age, cond: p.mainCond, complaint: p.complaint }; });
  console.log('patient', JSON.stringify(pt), 'planned today', arrival);
  // talk
  const qs = await page.evaluate(async () => { const { QUESTIONS } = await import('/js/core/content/findings.js'); return ['q_duration', 'q_fever', 'q_stool', 'q_cough'].map((id) => QUESTIONS.find((q) => q.id === id)?.label).filter(Boolean); });
  const talk = await tr(page, 'Talk'), examineTab = await tr(page, 'Examine'), notesTab = await tr(page, 'Notes'), treatTab = await tr(page, 'Treat');
  for (const q of qs) { const b = page.locator('.qchips button', { hasText: q }).first(); if (await b.count()) { if (mobile) await page.click(`.etabs button:has-text("${talk}")`); await b.click(); await sleep(120); } }
  await shot(page, '4-talk');
  // examine: tap chest and belly on the body
  if (mobile) await page.click(`.etabs button:has-text("${examineTab}")`);
  for (const reg of ['chest', 'belly', 'head', 'face']) {
    await page.locator(`svg.body [data-region="${reg}"]`).first().click({ force: true });
    await sleep(120);
    const btns = page.locator('.regmenu button:not([disabled])');
    if (await btns.count()) await btns.first().click();
    await sleep(120);
  }
  await shot(page, '5-exam');
  // notes and treat
  if (mobile) await page.click(`.etabs button:has-text("${notesTab}")`); else await page.click(`.etabs2 button:has-text("${notesTab}")`);
  await sleep(150);
  await shot(page, '6-notes');
  if (mobile) await page.click(`.etabs button:has-text("${treatTab}")`); else await page.click(`.etabs2 button:has-text("${treatTab}")`);
  await sleep(150);
  await page.locator('.treatbox .chips button').first().click();
  const addBtn = page.locator('.rxform button', { hasText: await tr(page, 'Add') });
  if (await addBtn.count() && await addBtn.isEnabled()) await addBtn.click();
  await page.locator('.checks input').first().check();
  await shot(page, '7-treat');
  page.once('dialog', (d) => d.accept());
  await page.click('.treatbox button.primary');
  await sleep(400);
  const after = await page.evaluate((id) => { const G = window.nd; const p = G.meta.clinic.patients[id]; return { status: p.status, visits: p.visits.length, rx: p.rx.length, coins: G.p.coins, judged: p.visits[0]?.judged }; }, pt.id);
  console.log('after visit', JSON.stringify(after));
  if (after.visits !== 1) throw new Error('visit not recorded');
  await shot(page, '8-after');

  // every panel
  for (const name of ['bag', 'make', 'build', 'handbook', 'ledger', 'map', 'menu']) {
    await page.evaluate((n) => window.nd.ui.open(n), name);
    await sleep(300);
    await shot(page, `9-${name}`);
    await page.evaluate(() => window.nd.ui.close());
  }
  // the handbook's plant list and the import catalogue: hundreds of species, so both are searchable
  await page.evaluate(() => window.nd.ui.open('handbook'));
  await page.click(`.panel .chips button:has-text("${await tr(page, 'Plants')}")`);
  await page.fill('.panel input[type=search]', 'will');
  await sleep(250);
  if (!(await page.locator('.panel .rlist button.recipe').count())) throw new Error('plant search found nothing');
  await shot(page, '9-plants');
  await page.evaluate(() => window.nd.ui.close());
  await page.evaluate(() => window.nd.ui.open('ledger'));
  await page.click(`.panel .chips button:has-text("${await tr(page, 'Order by post')}")`);
  const seedWord = (await page.evaluate(async () => (await import('/js/core/i18n.js')).t('{herb} seed', { herb: '' }))).trim();
  await page.fill('.panel input[type=search]', seedWord);
  await sleep(300);
  const imports = await page.locator('.panel .trow', { hasText: seedWord }).count();
  console.log('import rows', imports);
  if (!imports) throw new Error('the import catalogue found nothing');
  await shot(page, '9-imports');
  await page.evaluate(() => window.nd.ui.close());

  // a trader
  await page.evaluate(() => { const w = [...window.nd.scene.walkers.values()].find((x) => x.kind === 'vendor'); if (w) window.nd.ui.trade(w.vendor, w.key); });
  await sleep(300);
  await shot(page, '9-trade');
  await page.evaluate(() => window.nd.ui.close());
  // night, sleep, and the patient's fate unfolds at home
  await page.evaluate(() => { window.nd.meta.time = Math.floor(window.nd.meta.time / 1440) * 1440 + 20 * 60; });
  await sleep(800);
  await shot(page, '10-night');
  await page.evaluate(() => window.nd.scene.sleep());
  await sleep(400);
  const morning = await page.evaluate((id) => { const G = window.nd; const p = G.meta.clinic.patients[id]; return { day: Math.floor(G.meta.time / 1440) + 1, status: p.status, dead: !!p.dead, conds: p.conds.map((c) => c.id), ledger: G.meta.ledger.length }; }, pt.id);
  console.log('morning', JSON.stringify(morning));
  await shot(page, '11-morning');
  console.log('saved', await page.evaluate(async () => window.nd.save()));
  await page.reload();
  await page.waitForSelector('.play', { timeout: 20000 });
  await page.click('.play');
  await page.waitForFunction(() => window.nd?.scene?.walkers, null, { timeout: 30000 });
  await sleep(800);
  const reloaded = await page.evaluate((id) => { const G = window.nd; return { day: Math.floor(G.meta.time / 1440) + 1, patient: !!G.meta.clinic.patients[id], decoction: G.p.inv.slots.some((s) => s?.id === 'decoction_guava'), coins: G.p.coins }; }, pt.id);
  console.log('reloaded', JSON.stringify(reloaded));
  if (!reloaded.patient) throw new Error('patient lost on reload');
  await shot(page, '12-reloaded');
  if (lang) {
    // the toggle: to English and back, with a panel open; then nothing the pack lacks was asked for
    await page.evaluate(() => window.nd.ui.toggle('ledger'));
    await page.evaluate(() => window.nd.ui.setLang('en'));
    await sleep(300);
    const enText = await page.evaluate(() => document.querySelector('#ui').innerText);
    if (!/Ledger|Day /.test(enText)) errors.push('test: switching to English left the screen untranslated');
    await page.evaluate((l) => window.nd.ui.setLang(l), lang);
    await sleep(300);
    await shot(page, '13-ledger-after-toggle');
    const missing = await page.evaluate(async () => [...(await import('/js/core/i18n.js')).MISSING]);
    if (missing.length) errors.push(`i18n: ${missing.length} keys with no ${lang}: ` + missing.slice(0, 20).map((k) => JSON.stringify(k)).join(', '));
    if (leftovers.size) errors.push(`i18n: English left on ${lang} screens: ` + [...leftovers].slice(0, 40).map(([w, at]) => `${w} (${at})`).join(', '));
  }
  console.log('fps (swiftshader)', await page.evaluate(() => window.nd.scene.game.loop.actualFps.toFixed(1)));
} catch (e) {
  errors.push('test: ' + e.message);
} finally {
  await browser?.close();
  server.close();
}
if (errors.length) { console.log('ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('OK');
