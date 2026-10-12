// Headless play-test (adapted from dont get lost): serves the game on 127.0.0.1:3411, opens a clinic
// in Chromium, walks, gathers a herb, makes a remedy, sees a patient through the whole consultation
// (talk, tap the body, diagnose, prescribe, finish), opens every panel, sleeps, reloads. Screenshots
// go to outDir. Fails on any page error.
//   node tools/playtest.mjs [outDir] [--mobile]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'playtest-out';
const mobile = process.argv.includes('--mobile');
mkdirSync(out, { recursive: true });
const PORT = 3411;
const server = await serve(PORT);
const errors = [];
let browser;
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
try {
  await sleep(700);
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext(mobile ? { viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
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
  await page.locator('.recipe', { hasText: 'Guava decoction' }).first().click();
  await page.locator('.detail button.primary', { hasText: 'Make' }).click();
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
  for (const q of ['How long', 'Fever?', 'Any loose stools', 'Cough?']) { const b = page.locator('.qchips button', { hasText: q }).first(); if (await b.count()) { if (mobile) await page.click('.etabs button:has-text("Talk")'); await b.click(); await sleep(120); } }
  await shot(page, '4-talk');
  // examine: tap chest and belly on the body
  if (mobile) await page.click('.etabs button:has-text("Examine")');
  for (const reg of ['chest', 'belly', 'head', 'face']) {
    await page.locator(`svg.body [data-region="${reg}"]`).first().click({ force: true });
    await sleep(120);
    const btns = page.locator('.regmenu button:not([disabled])');
    if (await btns.count()) await btns.first().click();
    await sleep(120);
  }
  await shot(page, '5-exam');
  // notes and treat
  if (mobile) await page.click('.etabs button:has-text("Notes")'); else await page.click('.etabs2 button:has-text("Notes")');
  await sleep(150);
  await shot(page, '6-notes');
  if (mobile) await page.click('.etabs button:has-text("Treat")'); else await page.click('.etabs2 button:has-text("Treat")');
  await sleep(150);
  await page.locator('.treatbox .chips button').first().click();
  const addBtn = page.locator('.rxform button', { hasText: 'Add' });
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
  console.log('fps (swiftshader)', await page.evaluate(() => window.nd.scene.game.loop.actualFps.toFixed(1)));
} catch (e) {
  errors.push('test: ' + e.message);
} finally {
  await browser?.close();
  server.close();
}
if (errors.length) { console.log('ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('OK');
